"""
ProctoGrade - Proctoring Session Manager
Fixes:
  - Camera retry (browser releases after enroll)
  - Max 2 images per event_type (can_save_fn from api.py)
  - Proper stop/release
"""

import cv2
import numpy as np
import threading
import time
import datetime
import tempfile
import os

from ultralytics import YOLO
import speech_recognition as sr
from resemblyzer import VoiceEncoder, preprocess_wav

from db_connect import get_db

try:
    import pygetwindow as gw
    import pyautogui
    APP_SWITCH_AVAILABLE = True
except Exception:
    APP_SWITCH_AVAILABLE = False

from monitor_exam import (
    GazeCalibrator,
    GazeAndEarDetector,
    GazeBehaviourAnalyser,
    L2CSGazeEstimator,
    FaceVerifier,
    SuspicionScorer,
    cosine_similarity,
    rms_energy,
    log_event_once,
    save_event,
    L2CS_WEIGHTS_PATH,
    YOLO_CONF,
    EVENT_COOLDOWN,
    EXAM_WINDOW_TITLE,
    SUSPICIOUS_DEVICES,
    EARBUD_KEYWORDS,
    VOICE_SIM_THRESHOLD,
    VOICE_WINDOW_SIZE,
    VOICE_FAIL_COUNT,
    VOICE_ENERGY_MIN,
    APP_SWITCH_SCORER_COOLDOWN,
)

import torch


def _open_camera(retries=6, delay=2.0):
    for attempt in range(retries):
        for idx in [0, 1, 2]:
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
            if cap.isOpened():
                ret, frame = cap.read()
                if ret and frame is not None:
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    cap.set(cv2.CAP_PROP_FPS, 30)
                    print(f"[Camera] Opened on index {idx} (attempt {attempt+1})")
                    return cap
                cap.release()
        print(f"[Camera] Not ready, retrying in {delay}s... ({attempt+1}/{retries})")
        time.sleep(delay)
    return None


class ProctoringSession:
    def __init__(self, session_id: str, student_id: str, exam_id: str,
                 can_save_fn=None):
        self.session_id   = session_id
        self.student_id   = student_id
        self.exam_id      = exam_id
        self.is_running   = False
        self.started_at   = None
        self._stop_event  = threading.Event()
        self._cap         = None
        # Function from api.py: can_save_fn(session_id, event_type) -> bool
        self._can_save    = can_save_fn or (lambda sid, et: True)

    # ─────────────────────────────────────────────
    #  EVIDENCE SAVING (with 2-per-event cap)
    # ─────────────────────────────────────────────
    def _save_image_evidence(self, event_type, frame, score=None):
        if not self._can_save(self.session_id, event_type):
            return  # max 2 reached for this event type
        try:
            db = get_db()
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            db['evidence'].insert_one({
                "student_id":      self.student_id,
                "exam_id":         self.exam_id,
                "session_id":      self.session_id,
                "event_type":      event_type,
                "timestamp":       datetime.datetime.now(),
                "image":           buffer.tobytes(),
                "suspicion_score": score,
            })
            print(f"[DB] Image saved: {event_type}")
        except Exception as e:
            print(f"Evidence save error: {e}")

    def _save_audio_evidence(self, event_type, audio_bytes, score=None):
        if not self._can_save(self.session_id, f"audio_{event_type}"):
            return  # max 2 audio per type
        try:
            db = get_db()
            db["voice_evidence"].insert_one({
                "student_id":      self.student_id,
                "exam_id":         self.exam_id,
                "session_id":      self.session_id,
                "event_type":      event_type,
                "timestamp":       datetime.datetime.now(),
                "audio":           audio_bytes,
                "suspicion_score": score,
            })
            print(f"[DB] Audio saved: {event_type}")
        except Exception as e:
            print(f"Audio save error: {e}")

    def _log_event(self, event_type, last_event_time, cooldown=EVENT_COOLDOWN):
        return log_event_once(self.student_id, event_type, last_event_time, cooldown)

    # ─────────────────────────────────────────────
    #  AUDIO MONITOR
    # ─────────────────────────────────────────────
    def _audio_monitor(self, last_event_time, enrolled_voice, scorer):
        from collections import deque
        print("Audio monitoring started...")
        encoder        = VoiceEncoder()
        recognizer     = sr.Recognizer()
        recognizer.dynamic_energy_threshold = True
        sim_window     = []
        fail_streak    = 0
        energy_history = deque(maxlen=10)

        try:
            with sr.Microphone() as src:
                recognizer.adjust_for_ambient_noise(src, duration=2)
                print(f"[Audio] Noise floor: {recognizer.energy_threshold:.0f}")
        except Exception as e:
            print(f"Mic init error: {e}")
            return

        while not self._stop_event.is_set():
            try:
                with sr.Microphone() as src:
                    audio = recognizer.listen(src, timeout=5, phrase_time_limit=5)
                if audio is None:
                    continue

                wav_bytes = audio.get_wav_data()
                energy    = rms_energy(wav_bytes)
                if energy < VOICE_ENERGY_MIN:
                    continue

                energy_history.append(energy)
                floor = float(np.mean(energy_history)) if len(energy_history) > 2 else energy
                if energy > floor * 2.5:
                    scorer.add_signal("voice_mismatch")
                    s_ok, sc, _ = scorer.should_save()
                    if s_ok and self._log_event("Suspicious: Audio Spike",
                                                last_event_time, cooldown=15):
                        self._save_audio_evidence("AudioSpike", wav_bytes, score=sc)

                if enrolled_voice is None:
                    continue

                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                    tmp.write(wav_bytes)
                    tmp_path = tmp.name
                wav = preprocess_wav(tmp_path)
                emb = encoder.embed_utterance(wav)
                os.remove(tmp_path)

                sim = cosine_similarity(emb, enrolled_voice)
                print(f"Voice sim: {sim:.3f}")
                sim_window.append(sim)
                if len(sim_window) > VOICE_WINDOW_SIZE:
                    sim_window.pop(0)
                avg = sum(sim_window) / len(sim_window)
                fail_streak = fail_streak + 1 if avg < VOICE_SIM_THRESHOLD else 0

                if fail_streak >= VOICE_FAIL_COUNT:
                    scorer.add_signal("voice_mismatch")
                    s_ok, sc, _ = scorer.should_save()
                    if s_ok and self._log_event("Suspicious: Unmatched Voice",
                                                last_event_time):
                        self._save_audio_evidence("SuspiciousVoice", wav_bytes, score=sc)
                    fail_streak = 0

            except sr.WaitTimeoutError:
                pass
            except Exception as e:
                print(f"Audio error: {e}")

    # ─────────────────────────────────────────────
    #  APP SWITCH MONITOR
    # ─────────────────────────────────────────────
    def _app_switch_monitor(self, last_event_time, scorer):
        if not APP_SWITCH_AVAILABLE:
            return
        while not self._stop_event.is_set():
            try:
                active = gw.getActiveWindow()
                title  = active.title if active else "Unknown"
                if EXAM_WINDOW_TITLE not in title:
                    scorer.add_signal("app_switch",
                                      cooldown=APP_SWITCH_SCORER_COOLDOWN)
                    s_ok, sc, _ = scorer.should_save()
                    if s_ok and self._log_event(
                            f"Suspicious: App Switch ({title})",
                            last_event_time, cooldown=15):
                        shot = pyautogui.screenshot()
                        snp  = cv2.cvtColor(np.array(shot), cv2.COLOR_RGB2BGR)
                        self._save_image_evidence(
                            f"App Switch ({title})", snp, score=sc)
            except Exception:
                pass
            time.sleep(1)

    # ─────────────────────────────────────────────
    #  MAIN START
    # ─────────────────────────────────────────────
    def start(self):
        self.is_running = True
        self.started_at = datetime.datetime.now()
        self._stop_event.clear()

        db      = get_db()
        student = db["students"].find_one({"id": self.student_id})
        if not student:
            print("Student not found.")
            self.is_running = False
            return

        enrolled_voice = (np.array(student["voice_embed"])
                          if "voice_embed" in student else None)
        if enrolled_voice is None:
            print("[WARN] No voice embedding. Energy spike check still active.")

        ref_path = f"data/{self.student_id}/reference_embeddings.npy"
        if not os.path.exists(ref_path):
            print("No reference embeddings found!")
            self.is_running = False
            return
        ref_embeddings = np.load(ref_path)

        print("[Camera] Waiting for camera...")
        time.sleep(3)
        cap = _open_camera(retries=6, delay=2.0)
        if cap is None:
            print("[Camera] Could not open. Aborting.")
            self.is_running = False
            return
        self._cap = cap

        print("Loading models...")
        dev           = "cuda" if torch.cuda.is_available() else "cpu"
        yolo_model    = YOLO('yolov8m.pt')
        l2cs          = L2CSGazeEstimator(L2CS_WEIGHTS_PATH, device=dev)
        calibrator    = GazeCalibrator()
        ged           = GazeAndEarDetector(l2cs=l2cs, calibrator=calibrator)
        gaze_analyser = GazeBehaviourAnalyser(frame_w=640, frame_h=480)
        face_verifier = FaceVerifier(ref_embeddings)
        scorer        = SuspicionScorer()
        print(f"Models loaded! Device: {dev.upper()}")

        last_event_time  = {}
        frame_count      = 0
        verified         = False
        n_f              = 0
        consecutive_fail = 0

        audio_th = threading.Thread(
            target=self._audio_monitor,
            args=(last_event_time, enrolled_voice, scorer),
            daemon=True)
        app_th = threading.Thread(
            target=self._app_switch_monitor,
            args=(last_event_time, scorer),
            daemon=True)
        audio_th.start()
        app_th.start()

        print(f"Proctoring started: {self.session_id}")

        try:
            while not self._stop_event.is_set():
                ret, frame = cap.read()
                if not ret or frame is None:
                    consecutive_fail += 1
                    if consecutive_fail >= 10:
                        print("Too many frame failures — stopping.")
                        break
                    time.sleep(0.5)
                    continue
                consecutive_fail = 0
                frame_count += 1

                # ── 1. GAZE ──
                (gaze, n_mp, earbud_det, ear_boxes,
                 head_yaw, head_pitch, _,
                 calib_status) = ged.detect(frame.copy())

                if not calibrator.calibrated:
                    continue

                is_off = gaze not in ("Looking Forward", "No Face")
                beh    = gaze_analyser.update(is_off, head_yaw, head_pitch)

                if beh["sustained_alert"]: scorer.add_signal("gaze_sustained")
                if beh["freq_alert"]:      scorer.add_signal("gaze_freq")
                if beh["fusion_alert"]:    scorer.add_signal("head_eye_fusion")

                s_ok, sc, _ = scorer.should_save()

                if beh["sustained_alert"] and n_mp > 0:
                    key = f"Suspicious: Sustained Gaze ({gaze})"
                    if s_ok and self._log_event(key, last_event_time, cooldown=30):
                        self._save_image_evidence(key, frame, score=sc)

                if beh["freq_alert"] and n_mp > 0:
                    key = "Suspicious: Frequent Gaze Away"
                    if s_ok and self._log_event(key, last_event_time, cooldown=20):
                        self._save_image_evidence(key, frame, score=sc)

                if beh["fusion_alert"] and n_mp > 0:
                    key = f"Suspicious: Head+Eye Deviated ({gaze})"
                    if s_ok and self._log_event(key, last_event_time, cooldown=15):
                        self._save_image_evidence(key, frame, score=sc)

                # ── 2. EARBUD ──
                if earbud_det:
                    scorer.add_signal("earbud_mp")
                    s_ok, sc, _ = scorer.should_save()
                    if s_ok and self._log_event("Suspicious: Earbud Detected",
                                                last_event_time):
                        self._save_image_evidence("Suspicious: Earbud Detected",
                                                  frame, score=sc)

                # ── 3. FACE every 15 frames ──
                if frame_count % 15 == 0:
                    verified, n_f, _, _, _ = face_verifier.verify(frame)

                if n_f == 0:
                    scorer.add_signal("face_missing")
                    s_ok, sc, _ = scorer.should_save()
                    if s_ok and self._log_event("No Face Detected", last_event_time):
                        self._save_image_evidence("No Face Detected", frame, score=sc)
                    gaze_analyser.reset()
                elif n_f > 1:
                    scorer.add_signal("multi_face")
                    s_ok, sc, _ = scorer.should_save()
                    if s_ok and self._log_event("Suspicious: Multiple Faces",
                                                last_event_time):
                        self._save_image_evidence("Suspicious: Multiple Faces",
                                                  frame, score=sc)
                elif not verified:
                    scorer.add_signal("face_unknown")
                    s_ok, sc, _ = scorer.should_save()
                    if s_ok and self._log_event("Suspicious: Unknown Face",
                                                last_event_time):
                        self._save_image_evidence("Suspicious: Unknown Face",
                                                  frame, score=sc)

                # ── 4. YOLO every 3 frames ──
                if frame_count % 3 == 0:
                    yr = yolo_model(frame, conf=YOLO_CONF, verbose=False)[0]
                    for obj in yr.boxes:
                        rl  = yr.names[int(obj.cls)].lower()
                        isd = rl in SUSPICIOUS_DEVICES
                        ise = any(kw in rl for kw in EARBUD_KEYWORDS)
                        if isd or ise:
                            scorer.add_signal("earbud_yolo" if ise else "device_yolo")
                            s_ok, sc, _ = scorer.should_save()
                            ename = ("Suspicious: Earbud/Headphone Detected"
                                     if ise else f"Suspicious: Device ({rl})")
                            if s_ok and self._log_event(ename, last_event_time):
                                self._save_image_evidence(ename, frame, score=sc)

        finally:
            self._stop_event.set()
            if self._cap:
                self._cap.release()
                self._cap = None
            self.is_running = False
            print(f"Proctoring ended: {self.session_id}")

    # ─────────────────────────────────────────────
    #  STOP
    # ─────────────────────────────────────────────
    def stop(self):
        print(f"Stopping session: {self.session_id}")
        self._stop_event.set()
        if self._cap:
            self._cap.release()
            self._cap = None
        self.is_running = False