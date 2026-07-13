"""
====================================
ProctoGrade — monitor_exam_fixed.py
====================================
"""

import cv2
import numpy as np
from ultralytics import YOLO
import mediapipe as mp
import time
import os
import threading
import speech_recognition as sr
import datetime
import tempfile
from save_event import save_event
from resemblyzer import VoiceEncoder, preprocess_wav
from db_connect import get_db
import pygetwindow as gw
import pyautogui
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from PIL import Image
from collections import deque
from insightface.app import FaceAnalysis

# ─────────────────────────────────────────────
#  CONFIGURATION
# ─────────────────────────────────────────────
FACE_SIM_THRESHOLD   = 0.40
FACE_VOTE_FRAMES     = 3
EAR_BLINK_THRESHOLD  = 0.22
LIVENESS_BLINK_MIN   = 1

VOICE_SIM_THRESHOLD  = 0.75
VOICE_WINDOW_SIZE    = 3
VOICE_FAIL_COUNT     = 2
# FIX 5: energy threshold — silence skip karo
VOICE_ENERGY_MIN     = 350    # RMS below this = silence, skip processing

YOLO_CONF            = 0.20
EVENT_COOLDOWN       = 8
EXAM_WINDOW_TITLE    = "Exam Monitoring"

L2CS_WEIGHTS_PATH    = "models/L2CSNet_gaze360.pkl"
L2CS_INPUT_SIZE      = 448
GAZE_YAW_THRESHOLD   = 25.0
GAZE_PITCH_THRESHOLD = 20.0

# FIX 8: 10s → 4s (realistic cheating window)
GAZE_SUSTAINED_SEC   = 4.0
GAZE_FREQ_WINDOW     = 60.0
GAZE_FREQ_LIMIT      = 8
GAZE_IGNORE_SEC      = 1.0
HEAD_YAW_THRESHOLD   = 18.0
HEAD_PITCH_THRESHOLD = 15.0
HEATMAP_DECAY        = 0.97

# Gaze Calibration
CALIB_DURATION_SEC   = 5
CALIB_MARGIN_H       = 0.10
CALIB_MARGIN_V       = 0.08

# Suspicion Scorer
SUSPICION_SAVE_THRESHOLD = 55
SUSPICION_LOG_THRESHOLD  = 35

# FIX 7: hard cooldown for app-switch scorer signal (seconds)
APP_SWITCH_SCORER_COOLDOWN = 15.0

SUSPICIOUS_DEVICES = {
    'cell phone', 'phone', 'headset', 'earphone', 'earbuds',
    'laptop', 'tablet', 'smartwatch', 'book', 'remote',
    'keyboard', 'mouse', 'tv', 'monitor'
}
EARBUD_KEYWORDS = {'ear', 'bud', 'pod', 'airpod', 'headphone', 'headset','earphone', 'earbud', 'bluetooth'}

# ─────────────────────────────────────────────
#  DATABASE & EVIDENCE
# ─────────────────────────────────────────────
def _save_image_worker(student_id, event_type, frame, score):
    try:
        db = get_db()
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        db['evidence'].insert_one({
            "student_id":      student_id,
            "event_type":      event_type,
            "timestamp":       datetime.datetime.now(),
            "image":           buffer.tobytes(),
            "suspicion_score": score,
        })
        print(f"[DB] Evidence saved: {event_type}  score={score}")
    except Exception as e:
        print(f"Evidence save error: {e}")


def save_image_evidence(student_id, event_type, frame, score=None):
    threading.Thread(
        target=_save_image_worker,
        args=(student_id, event_type, frame.copy(), score),
        daemon=True
    ).start()


def _save_audio_worker(student_id, event_type, audio_bytes, score):
    try:
        db = get_db()
        db["voice_evidence"].insert_one({
            "student_id":      student_id,
            "event_type":      event_type,
            "timestamp":       datetime.datetime.now(),
            "audio":           audio_bytes,
            "suspicion_score": score,
        })
        print(f"[DB] Audio evidence saved: {event_type}  score={score}")
    except Exception as e:
        print(f"Audio evidence save error: {e}")


def save_audio_evidence(student_id, event_type, audio_bytes, score=None):
    threading.Thread(
        target=_save_audio_worker,
        args=(student_id, event_type, audio_bytes, score),
        daemon=True
    ).start()


# ─────────────────────────────────────────────
#  UTILITIES
# ─────────────────────────────────────────────
def load_reference_embeddings(student_id):
    path = f"data/{student_id}/reference_embeddings.npy"
    if not os.path.exists(path):
        print("No reference embeddings found! Run enroll.py first.")
        return None
    return np.load(path)


def cosine_similarity(a, b):
    a, b  = np.array(a, dtype=np.float64), np.array(b, dtype=np.float64)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom > 1e-8 else 0.0


def rms_energy(audio_bytes):
    """FIX 5: compute RMS so silence is skipped in voice thread."""
    try:
        arr = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
        return float(np.sqrt(np.mean(arr ** 2)))
    except Exception:
        return 0.0


event_lock = threading.Lock()

def log_event_once(user_id, event_type, last_event_time, cooldown=EVENT_COOLDOWN):
    with event_lock:
        now = time.time()
        if event_type not in last_event_time or (now - last_event_time[event_type]) > cooldown:
            save_event(user_id, event_type)
            last_event_time[event_type] = now
            return True
        return False


# ─────────────────────────────────────────────
#  SUSPICION SCORER
# ─────────────────────────────────────────────
class SuspicionScorer:
    WEIGHTS = {
        "gaze_sustained"  : 20,
        "gaze_freq"       : 15,
        "head_eye_fusion" : 20,
        "face_unknown"    : 35,
        "face_missing"    : 25,
        "multi_face"      : 30,
        "earbud_mp"       : 25,
        "earbud_yolo"     : 30,
        "device_yolo"     : 25,
        "voice_mismatch"  : 30,
        "app_switch"      : 20,
    }

    def __init__(self):
        self._recent            = deque()
        self._WINDOW            = 10.0
        self._lock              = threading.Lock()
        # FIX 7: track last time each signal was added to scorer
        self._signal_last_time  = {}

    def _clean_old(self):
        cutoff = time.time() - self._WINDOW
        while self._recent and self._recent[0][0] < cutoff:
            self._recent.popleft()

    def add_signal(self, signal_name: str, cooldown: float = 0.0):
        """
        FIX 7: optional per-signal cooldown so app_switch doesn't
        spam the scorer every second.
        """
        if signal_name not in self.WEIGHTS:
            return
        now = time.time()
        with self._lock:
            last = self._signal_last_time.get(signal_name, 0.0)
            if now - last < cooldown:
                return
            self._signal_last_time[signal_name] = now
            self._recent.append((now, signal_name))

    def compute(self):
        with self._lock:
            self._clean_old()
            active = list({s for _, s in self._recent})
        raw   = sum(self.WEIGHTS[s] for s in active)
        bonus = 10 if len(active) >= 3 else 0
        return min(100, raw + bonus), active

    def should_save(self):
        score, active = self.compute()
        return score >= SUSPICION_SAVE_THRESHOLD, score, active


# ─────────────────────────────────────────────
#  GAZE CALIBRATOR
# ─────────────────────────────────────────────
class GazeCalibrator:
    def __init__(self):
        self._h_samples  = []
        self._v_samples  = []
        self._start_time = None
        self.calibrated  = False
        self.h_base      = 0.50
        self.v_base      = 0.45

    def feed(self, ah: float, av: float, face_present: bool) -> str:
        if self.calibrated:
            return "Calibrated"
        if not face_present:
            return "Waiting for face..."
        if self._start_time is None:
            self._start_time = time.time()
        elapsed   = time.time() - self._start_time
        remaining = max(0, CALIB_DURATION_SEC - elapsed)
        self._h_samples.append(ah)
        self._v_samples.append(av)
        if elapsed >= CALIB_DURATION_SEC and len(self._h_samples) >= 10:
            self.h_base     = float(np.median(self._h_samples))
            self.v_base     = float(np.median(self._v_samples))
            self.calibrated = True
            print(f"Gaze calibrated: h_base={self.h_base:.3f}  v_base={self.v_base:.3f}")
            return "Calibrated"
        return f"Look forward... {remaining:.1f}s"

    def is_off_screen(self, ah: float, av: float) -> str:
        if not self.calibrated:
            if ah < 0.28: return "Looking Left"
            if ah > 0.72: return "Looking Right"
            if av < 0.22: return "Looking Up"
            if av > 0.75: return "Looking Down"
            return "Looking Forward"
        dh = ah - self.h_base
        dv = av - self.v_base
        if dh < -CALIB_MARGIN_H: return "Looking Left"
        if dh >  CALIB_MARGIN_H: return "Looking Right"
        if dv < -CALIB_MARGIN_V: return "Looking Up"
        if dv >  CALIB_MARGIN_V: return "Looking Down"
        return "Looking Forward"


# ─────────────────────────────────────────────
#  FIX 2 — HEAD POSE ESTIMATOR (correct euler decomposition)
# ─────────────────────────────────────────────
class HeadPoseEstimator:
    """
    ORIGINAL BUG: pitch/yaw were computed with wrong arctan2 on rotation
    matrix columns — gave roll as yaw.

    FIX: use cv2.decomposeProjectionMatrix which correctly separates
    yaw (left/right), pitch (up/down), roll from the rotation matrix.
    """
    MODEL_POINTS = np.array([
        (0.0,    0.0,    0.0  ),   # Nose tip
        (0.0,   -330.0, -65.0 ),   # Chin
        (-225.0, 170.0, -135.0),   # Left eye outer corner
        (225.0,  170.0, -135.0),   # Right eye outer corner
        (-150.0,-150.0, -125.0),   # Left mouth corner
        (150.0, -150.0, -125.0),   # Right mouth corner
    ], dtype=np.float64)
    MP_INDICES = [1, 152, 33, 263, 61, 291]

    def __init__(self):
        self._cam  = None
        self._dist = np.zeros((4, 1))

    def _build(self, w, h):
        f = float(w)
        self._cam = np.array(
            [[f, 0, w/2],
             [0, f, h/2],
             [0, 0,   1]], dtype=np.float64)

    def estimate(self, lm, w, h):
        if self._cam is None:
            self._build(w, h)
        pts = np.array(
            [(lm[i].x * w, lm[i].y * h) for i in self.MP_INDICES],
            dtype=np.float64)
        ok, rvec, tvec = cv2.solvePnP(
            self.MODEL_POINTS, pts,
            self._cam, self._dist,
            flags=cv2.SOLVEPNP_ITERATIVE)
        if not ok:
            return None

        rmat, _ = cv2.Rodrigues(rvec)

        # ── FIX 2: correct decomposition ──
        proj_mat = np.hstack((rmat, tvec))
        _, _, _, _, _, _, euler = cv2.decomposeProjectionMatrix(proj_mat)
        pitch = float(euler[0])   # up/down
        yaw   = float(euler[1])   # left/right  ← was WRONG before
        roll  = float(euler[2])
        return yaw, pitch, roll


# ─────────────────────────────────────────────
#  GAZE BEHAVIOUR ANALYSER
# ─────────────────────────────────────────────
class GazeBehaviourAnalyser:
    def __init__(self, frame_w, frame_h):
        self.fw            = frame_w
        self.fh            = frame_h
        self._off_start    = None
        self._total_off    = 0.0
        self._current_sus  = 0.0
        self._glance_times = deque()
        self._in_glance    = False
        self._glance_start = None
        self._fused        = False
        self._heatmap      = np.zeros((frame_h, frame_w), dtype=np.float32)

    def update(self, is_off, head_yaw, head_pitch, gaze_x=None, gaze_y=None):
        now      = time.time()
        head_dev = (abs(head_yaw) > HEAD_YAW_THRESHOLD or
                    abs(head_pitch) > HEAD_PITCH_THRESHOLD)
        self._fused = is_off and head_dev

        if is_off:
            if self._off_start is None:
                self._off_start = now
            self._current_sus = now - self._off_start
        else:
            if self._off_start is not None:
                self._total_off += now - self._off_start
            self._off_start   = None
            self._current_sus = 0.0

        sustained = self._current_sus >= GAZE_SUSTAINED_SEC   

        if is_off and not self._in_glance:
            self._in_glance    = True
            self._glance_start = now
        elif not is_off and self._in_glance:
            dur = now - self._glance_start
            self._in_glance = False
            if dur >= GAZE_IGNORE_SEC:
                self._glance_times.append(self._glance_start)

        cutoff = now - GAZE_FREQ_WINDOW
        while self._glance_times and self._glance_times[0] < cutoff:
            self._glance_times.popleft()
        freq_count = len(self._glance_times)
        freq_alert = freq_count >= GAZE_FREQ_LIMIT

        self._heatmap *= HEATMAP_DECAY
        if gaze_x is not None and gaze_y is not None:
            gx = int(np.clip(gaze_x, 0, 1) * (self.fw - 1))
            gy = int(np.clip(gaze_y, 0, 1) * (self.fh - 1))
            cv2.circle(self._heatmap, (gx, gy), 20, 1.0, -1)

        if self._fused and (sustained or freq_alert):
            level = "critical"
        elif sustained or freq_alert or self._fused:
            level = "warn"
        else:
            level = "none"

        return {
            "sustained_alert": sustained,
            "freq_alert"     : freq_alert,
            "fusion_alert"   : self._fused,
            "sustained_sec"  : self._current_sus,
            "glance_count"   : freq_count,
            "alert_level"    : level,
        }

    def get_heatmap_evidence_frame(self, base):
        norm = cv2.normalize(self._heatmap, None, 0, 255,
                             cv2.NORM_MINMAX).astype(np.uint8)
        return cv2.addWeighted(
            base, 0.6,
            cv2.applyColorMap(norm, cv2.COLORMAP_JET), 0.4, 0)

    def reset(self):
        self._off_start    = None
        self._current_sus  = 0.0
        self._in_glance    = False
        self._glance_times.clear()


# ─────────────────────────────────────────────
#  L2CS-Net  (FIX 1: clear startup warning + loaded flag respected everywhere)
# ─────────────────────────────────────────────
class L2CSNet(nn.Module):
    def __init__(self, num_bins=90):
        super().__init__()
        import torchvision.models as models
        base          = models.resnet50(weights=None)
        self.backbone = nn.Sequential(*list(base.children())[:-2])
        self.avgpool  = nn.AdaptiveAvgPool2d(1)
        self.fc_yaw   = nn.Linear(2048, num_bins)
        self.fc_pitch = nn.Linear(2048, num_bins)

    def forward(self, x):
        x = self.avgpool(self.backbone(x)).flatten(1)
        return self.fc_yaw(x), self.fc_pitch(x)


class L2CSGazeEstimator:
    NUM_BINS = 90

    def __init__(self, weights_path, device="cpu"):
        self.device  = torch.device(device)
        self.model   = L2CSNet(self.NUM_BINS).to(self.device)
        self.loaded  = False

        if os.path.exists(weights_path):
            state = torch.load(weights_path, map_location=self.device)
            if any(k.startswith("module.") for k in state):
                state = {k.replace("module.", ""): v for k, v in state.items()}
            self.model.load_state_dict(state, strict=False)
            self.loaded = True
            print(f"[L2CS] Loaded: {weights_path}")
        else:
            # FIX 1: loud, unmissable warning — no silent degraded mode
            print("\n" + "=" * 60)
            print("  WARNING: L2CS weights NOT FOUND at:")
            print(f"  '{weights_path}'")
            print()
            print("  GAZE TRACKING → MediaPipe iris fallback only.")
            print("  Accuracy will be REDUCED for gaze detection.")
            print()
            print("  Download weights:")
            print("  https://github.com/Ahmednull/L2CS-Net (gaze360.pkl)")
            print("  Place in:  models/L2CSNet_gaze360.pkl")
            print("=" * 60 + "\n")

        self.model.eval()
        self._idx = torch.arange(self.NUM_BINS, dtype=torch.float32).to(self.device)
        self.tf   = transforms.Compose([
            transforms.Resize((L2CS_INPUT_SIZE, L2CS_INPUT_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406],
                                  [0.229, 0.224, 0.225]),
        ])

    def predict(self, face_bgr):
        if not self.loaded:
            return None, None
        try:
            t = self.tf(Image.fromarray(
                cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB))
            ).unsqueeze(0).to(self.device)
            with torch.no_grad():
                yl, pl = self.model(t)
            yaw   = (torch.sum(torch.softmax(yl, 1) * self._idx, 1).item()
                     * (360 / self.NUM_BINS) - 180)
            pitch = (torch.sum(torch.softmax(pl, 1) * self._idx, 1).item()
                     * (180 / self.NUM_BINS) - 90)
            return yaw, pitch
        except Exception:
            return None, None


# ─────────────────────────────────────────────
#  FACE VERIFIER
# ─────────────────────────────────────────────
class FaceVerifier:
    def __init__(self, ref_embeddings):
        self.ref = ref_embeddings
        self.app = FaceAnalysis(name="buffalo_sc",
                                providers=["CPUExecutionProvider"])
        self.app.prepare(ctx_id=-1, det_size=(320, 320))

        fm = mp.solutions.face_mesh
        self.mesh = fm.FaceMesh(max_num_faces=2, refine_landmarks=True,
                                min_detection_confidence=0.5,
                                min_tracking_confidence=0.5)
        self.LEE = [362, 385, 387, 263, 373, 380]
        self.REE = [33,  160, 158, 133, 153, 144]

        self._votes       = []
        self._blinks      = 0
        self._eye_closed  = False
        self._liveness_ok = False

    def _ear(self, lm, idx, w, h):
        pts = np.array([(lm[i].x * w, lm[i].y * h) for i in idx])
        A   = np.linalg.norm(pts[1] - pts[5])
        B   = np.linalg.norm(pts[2] - pts[4])
        C   = np.linalg.norm(pts[0] - pts[3])
        return (A + B) / (2 * C) if C > 0 else 0.0

    def _liveness(self, frame):
        h, w = frame.shape[:2]
        r    = self.mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        if not r.multi_face_landmarks:
            return
        lm  = r.multi_face_landmarks[0].landmark
        avg = (self._ear(lm, self.LEE, w, h) +
               self._ear(lm, self.REE, w, h)) / 2
        closed = avg < EAR_BLINK_THRESHOLD
        if closed and not self._eye_closed:
            self._blinks += 1
        self._eye_closed  = closed
        self._liveness_ok = self._blinks >= LIVENESS_BLINK_MIN

    def verify(self, frame):
        faces = self.app.get(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        if not faces:
            self._votes.clear()
            return False, 0, [], self._blinks, self._liveness_ok

        n       = len(faces)
        boxes   = []
        matched = False

        for f in faces:
            sim = max(cosine_similarity(r, f.normed_embedding) for r in self.ref)
            b   = f.bbox.astype(int)
            if sim >= FACE_SIM_THRESHOLD:
                boxes.append((f"Verified ({sim:.2f})",
                               (b[0], b[1], b[2], b[3]),
                               (0, 220, 100)))
                matched = True
            else:
                boxes.append((f"Unknown ({sim:.2f})",
                               (b[0], b[1], b[2], b[3]),
                               (0, 0, 255)))

        self._votes.append(matched)
        if len(self._votes) > FACE_VOTE_FRAMES:
            self._votes.pop(0)

        majority = (len(self._votes) + 1) // 2
        final    = self._votes.count(True) >= majority

        self._liveness(frame)
        return final, n, boxes, self._blinks, self._liveness_ok


# ─────────────────────────────────────────────
#  FIX 3 + FIX 6 — GAZE + EAR DETECTOR
# ─────────────────────────────────────────────
class GazeAndEarDetector:
    """
    FIX 3: unified calibration — ear calibration completes together with
            gaze calibration (both use CALIB_DURATION_SEC window).
            Single self.calibrated flag for both.

    FIX 6: earbud detection uses tighter threshold + Canny edge density
            as a second signal (earbuds have hard plastic edges).
    """

    def __init__(self, l2cs: L2CSGazeEstimator, calibrator: GazeCalibrator):
        self.l2cs       = l2cs
        self.calibrator = calibrator
        self.head_pose  = HeadPoseEstimator()

        fm = mp.solutions.face_mesh
        self.mesh = fm.FaceMesh(max_num_faces=2, refine_landmarks=True,
                                min_detection_confidence=0.6,
                                min_tracking_confidence=0.6)
        fd = mp.solutions.face_detection
        self.fdet = fd.FaceDetection(model_selection=1,
                                     min_detection_confidence=0.6)

        self.LI  = [474, 475, 476, 477]
        self.RI  = [469, 470, 471, 472]
        self.LE  = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398]
        self.RE  = [33,  7, 163,144,145,153,154,155,133,173,157,158,159,160,161,246]
        self.LER = [234, 93, 132, 58, 172, 136, 150, 149]
        self.RER = [454,323, 361,288, 397, 365, 379, 378]

        # FIX 3: ear baseline tied to gaze calibration start time
        self._lb = self._rb = None
        self._ear_samples_l = []
        self._ear_samples_r = []
        self._ear_calib_done = False

        # FIX 3: single public flag
        self.calibrated = False

        self._yb = []
        self._pb = []
        self._SN = 5

    @property
    def _both_calibrated(self):
        return self.calibrator.calibrated and self._ear_calib_done

    def _sm(self, buf, v):
        buf.append(v)
        if len(buf) > self._SN:
            buf.pop(0)
        return sum(buf) / len(buf)

    def _ic(self, lm, idx, w, h):
        return np.array([(lm[i].x*w, lm[i].y*h) for i in idx]).mean(axis=0)

    def _eb(self, lm, idx, w, h):
        pts = np.array([(lm[i].x*w, lm[i].y*h) for i in idx])
        return pts.min(axis=0), pts.max(axis=0)

    def _ep(self, frame, lm, idx, w, h, pad=22):
        pts    = np.array([(int(lm[i].x*w), int(lm[i].y*h)) for i in idx])
        cx, cy = pts.mean(axis=0).astype(int)
        return (frame[max(0,cy-pad):min(h,cy+pad),
                      max(0,cx-pad):min(w,cx+pad)],
                (max(0,cx-pad), max(0,cy-pad),
                 min(w,cx+pad), min(h,cy+pad)))

    def _earbud(self, patch, base_mean, base_std):
        """
        FIX 6: THREE-signal earbud check:
          1) Brightness delta vs calibrated baseline
          2) Texture std delta — earbud raises local std
          3) Canny edge density — plastic earbud has strong edges
        Any 2 of 3 → earbud flagged  (reduces false alarms from lighting)
        """
        if patch.size == 0 or base_mean is None:
            return False

        gray     = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
        cur_mean = float(np.mean(gray))
        cur_std  = float(np.std(gray))

        # Signal 1: brightness shift
        sig1 = abs(cur_mean - base_mean) > 8

        # Signal 2: texture increase
        sig2 = (cur_std - base_std) > 6

        # Signal 3: edge density (Canny pixel ratio)
        edges     = cv2.Canny(gray, 40, 120)
        edge_dens = float(np.count_nonzero(edges)) / max(edges.size, 1)
        sig3      = edge_dens > 0.18

        # Need at least 2 of 3
        return (int(sig1) + int(sig2) + int(sig3)) >= 2

    def _l2cs(self, frame, h, w):
        if self.l2cs is None:
            return 0.0, 0.0
        r = self.fdet.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        if not r.detections:
            return None, None
        bb = r.detections[0].location_data.relative_bounding_box
        x1 = max(0, int(bb.xmin * w))
        y1 = max(0, int(bb.ymin * h))
        x2 = min(w, int((bb.xmin + bb.width)  * w))
        y2 = min(h, int((bb.ymin + bb.height) * h))
        if (x2 - x1) < 20 or (y2 - y1) < 20:
            return None, None
        try:
            return self.l2cs.predict(frame[y1:y2, x1:x2])
        except Exception as e:
            print(f"⚠️ L2CS prediction error: {e}")
            return 0.0, 0.0

    def _iris_ratios(self, lm, w, h):
        li  = self._ic(lm, self.LI, w, h)
        ri  = self._ic(lm, self.RI, w, h)
        lmn, lmx = self._eb(lm, self.LE, w, h)
        rmn, rmx = self._eb(lm, self.RE, w, h)
        lh = (li[0]-lmn[0]) / max(lmx[0]-lmn[0], 1)
        rh = (ri[0]-rmn[0]) / max(rmx[0]-rmn[0], 1)
        lv = (li[1]-lmn[1]) / max(lmx[1]-lmn[1], 1)
        rv = (ri[1]-rmn[1]) / max(rmx[1]-rmn[1], 1)
        return (lh+rh)/2, (lv+rv)/2

    def detect(self, frame):
        h, w    = frame.shape[:2]
        results = self.mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        hy = hp = 0.0

        if not results.multi_face_landmarks:
            calib_status = self.calibrator.feed(0.5, 0.45, False)
            self.calibrated = False
            return "No Face", 0, False, [], hy, hp, frame, calib_status

        n            = len(results.multi_face_landmarks)
        earbud_found = False
        ear_boxes    = []
        lm0          = results.multi_face_landmarks[0].landmark

        pr = self.head_pose.estimate(lm0, w, h)
        if pr:
            hy, hp, _ = pr

        ah, av       = self._iris_ratios(lm0, w, h)
        calib_status = self.calibrator.feed(ah, av, True)

        # Gaze from MediaPipe 
        raw_y, raw_p = self._l2cs(frame, h, w)
        if raw_y is not None:
            yaw   = self._sm(self._yb, raw_y)
            pitch = self._sm(self._pb, raw_p)
            if   yaw   < -GAZE_YAW_THRESHOLD:  gaze = "Looking Left"
            elif yaw   >  GAZE_YAW_THRESHOLD:  gaze = "Looking Right"
            elif pitch < -GAZE_PITCH_THRESHOLD: gaze = "Looking Up"
            elif pitch >  GAZE_PITCH_THRESHOLD: gaze = "Looking Down"
            else:                               gaze = "Looking Forward"
            cv2.putText(frame, f"Eye Yaw:{yaw:+.1f} Pitch:{pitch:+.1f}",
                        (10, h-55), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255,200,0), 1)
        else:
            gaze = self.calibrator.is_off_screen(ah, av)

        cv2.putText(frame, f"Head Yaw:{hy:+.1f} Pitch:{hp:+.1f}",
                    (10, h-35), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200,255,100), 1)

        # ── FIX 3: ear calibration unified with gaze calibration window ──
        for fl in results.multi_face_landmarks:
            lm = fl.landmark
            for idx in self.LI + self.RI:
                cv2.circle(frame,
                           (int(lm[idx].x*w), int(lm[idx].y*h)),
                           2, (0,255,255), -1)

            lp, lb = self._ep(frame, lm, self.LER, w, h)
            rp, rb = self._ep(frame, lm, self.RER, w, h)

            if not self._ear_calib_done:
                if lp.size > 0 and rp.size > 0:
                    lg = cv2.cvtColor(lp, cv2.COLOR_BGR2GRAY)
                    rg = cv2.cvtColor(rp, cv2.COLOR_BGR2GRAY)
                    self._ear_samples_l.append((float(np.mean(lg)), float(np.std(lg))))
                    self._ear_samples_r.append((float(np.mean(rg)), float(np.std(rg))))

                # Complete ear calib when gaze calib completes
                if self.calibrator.calibrated and not self._ear_calib_done:
                    if self._ear_samples_l:
                        lm_arr = np.array(self._ear_samples_l)
                        rm_arr = np.array(self._ear_samples_r)
                        self._lb = (float(np.median(lm_arr[:,0])),
                                    float(np.median(lm_arr[:,1])))
                        self._rb = (float(np.median(rm_arr[:,0])),
                                    float(np.median(rm_arr[:,1])))
                        self._ear_calib_done = True
                        print(f"Ear baseline ready: "
                              f"L_mean={self._lb[0]:.1f} L_std={self._lb[1]:.1f} | "
                              f"R_mean={self._rb[0]:.1f} R_std={self._rb[1]:.1f}")
            else:
                lb_mean, lb_std = self._lb
                rb_mean, rb_std = self._rb
                # FIX 6: 3-signal check
                if self._earbud(lp, lb_mean, lb_std):
                    earbud_found = True
                    ear_boxes.append(("Left", lb))
                if self._earbud(rp, rb_mean, rb_std):
                    earbud_found = True
                    ear_boxes.append(("Right", rb))

        # FIX 3: update public calibrated flag
        self.calibrated = self._both_calibrated

        return gaze, n, earbud_found, ear_boxes, hy, hp, frame, calib_status


# ─────────────────────────────────────────────
#  FIX 5 — AUDIO MONITOR THREAD
# ─────────────────────────────────────────────
def audio_monitor_thread(student_id, last_event_time, enrolled_voice,
                         stop_event, scorer: SuspicionScorer):
    """
    FIX 5: even without enrolled_voice, we monitor for:
      - Sudden loud audio spikes (someone whispering answers)
      - Persistent background voice energy
    enrolled_voice is only needed for speaker-identity check.
    """
    print("Audio monitoring started...")
    encoder    = VoiceEncoder()
    recognizer = sr.Recognizer()
    recognizer.dynamic_energy_threshold = True
    sim_window  = []
    fail_streak = 0
    energy_history = deque(maxlen=10)   # rolling noise floor

    try:
        with sr.Microphone() as src:
            recognizer.adjust_for_ambient_noise(src, duration=2)
            print(f"[Audio] Noise floor calibrated: {recognizer.energy_threshold:.0f}")
    except Exception as e:
        print(f"Microphone init error: {e}")
        return

    while not stop_event.is_set():
        audio = None
        try:
            with sr.Microphone() as src:
                audio = recognizer.listen(src, timeout=5, phrase_time_limit=5)
            if audio is None:
                continue

            wav_bytes = audio.get_wav_data()
            energy    = rms_energy(wav_bytes)

            # FIX 5a: skip silence
            if energy < VOICE_ENERGY_MIN:
                continue

            # FIX 5b: rolling floor — spike = sudden 2.5x jump
            energy_history.append(energy)
            floor = float(np.mean(energy_history)) if len(energy_history) > 2 else energy
            if energy > floor * 2.5:
                print(f"[Audio] Energy spike: {energy:.0f} (floor {floor:.0f})")
                scorer.add_signal("voice_mismatch")
                s_ok, sc, _ = scorer.should_save()
                if s_ok and log_event_once(student_id,
                                           "Suspicious: Audio Spike",
                                           last_event_time, cooldown=15):
                    save_audio_evidence(student_id, "AudioSpike",
                                        wav_bytes, score=sc)

            # FIX 5c: speaker identity (only if enrolled voice exists)
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
                if s_ok and log_event_once(student_id,
                                           "Suspicious: Unmatched Voice",
                                           last_event_time):
                    save_audio_evidence(student_id, "SuspiciousVoice",
                                        wav_bytes, score=sc)
                fail_streak = 0

        except sr.WaitTimeoutError:
            pass
        except Exception as e:
            print(f"Audio error: {e}")


# ─────────────────────────────────────────────
#  FIX 7 — APP SWITCH MONITOR THREAD
# ─────────────────────────────────────────────
def app_switch_monitor_thread(student_id, last_event_time,
                               stop_event, scorer: SuspicionScorer):
    """
    FIX 7: scorer signal throttled to APP_SWITCH_SCORER_COOLDOWN (15s)
    so one app-switch doesn't spam the scorer every second.
    """
    while not stop_event.is_set():
        try:
            active = gw.getActiveWindow()
            title  = active.title if active else "Unknown"
            if EXAM_WINDOW_TITLE not in title:
                # FIX 7: pass cooldown to add_signal
                scorer.add_signal("app_switch",
                                   cooldown=APP_SWITCH_SCORER_COOLDOWN)
                s_ok, sc, _ = scorer.should_save()
                if s_ok and log_event_once(
                        student_id,
                        f"Suspicious: App Switch ({title})",
                        last_event_time, cooldown=15):
                    shot = pyautogui.screenshot()
                    snp  = cv2.cvtColor(np.array(shot), cv2.COLOR_RGB2BGR)
                    save_image_evidence(student_id,
                                        f"App Switch ({title})",
                                        snp, score=sc)
        except Exception:
            pass
        time.sleep(1)


# ─────────────────────────────────────────────
#  DRAW HELPERS
# ─────────────────────────────────────────────
def draw_calibration_overlay(display, calib_status: str, calibrated: bool):
    if calibrated:
        cv2.putText(display, "Gaze+Ear: Calibrated",
                    (display.shape[1]-250, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,220,100), 2)
    else:
        overlay = display.copy()
        cv2.rectangle(overlay, (0,0), (display.shape[1], 70), (0,0,0), -1)
        cv2.addWeighted(overlay, 0.5, display, 0.5, 0, display)
        cv2.putText(display,
                    f"CALIBRATION: Look straight at camera  {calib_status}",
                    (15, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,220,255), 2)


def draw_gaze_hud(display, beh, score, active_sigs, fh):
    level = beh["alert_level"]
    col   = {"none":(0,220,100), "warn":(0,200,255), "critical":(0,0,255)}.get(
        level, (180,180,180))
    y = fh - 105
    cv2.putText(display,
                f"Off-screen: {beh['sustained_sec']:.1f}s / {GAZE_SUSTAINED_SEC}s",
                (10,y),    cv2.FONT_HERSHEY_SIMPLEX, 0.48, col, 1)
    cv2.putText(display,
                f"Glances/60s: {beh['glance_count']} / {GAZE_FREQ_LIMIT}",
                (10,y+17), cv2.FONT_HERSHEY_SIMPLEX, 0.48, col, 1)
    cv2.putText(display,
                f"Head+Eye: {'SUSPICIOUS' if beh['fusion_alert'] else 'OK'}",
                (10,y+34), cv2.FONT_HERSHEY_SIMPLEX, 0.48, col, 1)
    bar_w   = int((score/100)*160)
    bar_col = (0,220,100) if score < 35 else (0,165,255) if score < 55 else (0,0,255)
    cv2.rectangle(display, (10,y+50), (170,y+64), (60,60,60), -1)
    cv2.rectangle(display, (10,y+50), (10+bar_w,y+64), bar_col, -1)
    cv2.putText(display, f"Suspicion: {score}/100",
                (10,y+80), cv2.FONT_HERSHEY_SIMPLEX, 0.48, bar_col, 1)
    if level == "critical":
        cv2.putText(display, "!! GAZE CRITICAL !!",
                    (10,y+97), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)
    elif level == "warn":
        cv2.putText(display, "! Gaze Warning",
                    (10,y+97), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,200,255), 1)


def draw_liveness_warning(display, liveness_ok: bool):
    if not liveness_ok:
        cv2.putText(display, "LIVENESS CHECK: Please blink",
                    (20, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)


# ─────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────
def main():
    student_id = input("Enter Student ID: ").strip()

    db      = get_db()
    student = db["students"].find_one({"id": student_id})
    if not student:
        print("Student not found. Run enroll.py first.")
        return

    enrolled_voice = (np.array(student["voice_embed"])
                      if "voice_embed" in student else None)
    if enrolled_voice is None:
        print("[WARN] No voice embedding for this student. "
              "Speaker-identity check disabled. Energy spike still active.")

    ref_embeddings = load_reference_embeddings(student_id)
    if ref_embeddings is None:
        return

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)
    if not cap.isOpened():
        print("Camera could not be opened.")
        return

    cv2.namedWindow(EXAM_WINDOW_TITLE, cv2.WINDOW_NORMAL)

    print("Loading models...")
    yolo_model    = YOLO('yolov8m.pt')
    face_verifier = FaceVerifier(ref_embeddings)
    dev           = "cuda" if torch.cuda.is_available() else "cpu"
    l2cs          = L2CSGazeEstimator(L2CS_WEIGHTS_PATH, device=dev)
    calibrator    = GazeCalibrator()
    ged           = GazeAndEarDetector(l2cs, calibrator)
    gaze_analyser = GazeBehaviourAnalyser(frame_w=640, frame_h=480)
    scorer        = SuspicionScorer()
    print(f"Models loaded! Device: {dev.upper()}")
    if not l2cs.loaded:
        print("[WARN] Running in MediaPipe-only gaze mode.")

    print(f"\n>> Exam starts after {CALIB_DURATION_SEC}s calibration. "
          "Look straight at the camera.\n")

    last_event_time = {}
    frame_count     = 0

    # FIX 4: initialize as NOT verified — no free pass on first frames
    verified    = False
    n_f         = 0
    fboxes      = []
    blinks      = 0
    liveness_ok = False

    stop_event = threading.Event()
    audio_th = threading.Thread(
        target=audio_monitor_thread,
        args=(student_id, last_event_time, enrolled_voice, stop_event, scorer),
        daemon=True)
    app_th = threading.Thread(
        target=app_switch_monitor_thread,
        args=(student_id, last_event_time, stop_event, scorer),
        daemon=True)
    audio_th.start()
    app_th.start()

    print("Monitoring started... Press 'Q' to stop.")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Frame not received.")
                break

            frame_count += 1
            display = frame.copy()

            # ── 1. GAZE + HEAD POSE + EAR ──
            (gaze, n_mp, earbud_det, ear_boxes,
             head_yaw, head_pitch, display,
             calib_status) = ged.detect(display)

            draw_calibration_overlay(display, calib_status, calibrator.calibrated)

            if not calibrator.calibrated:
                ts = datetime.datetime.now().strftime("%H:%M:%S")
                cv2.putText(display,
                            f"{ts}  |  ProctoGrade  |  Calibrating...",
                            (10, display.shape[0]-12),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180,180,180), 1)
                cv2.imshow(EXAM_WINDOW_TITLE, display)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                continue

            # ── Gaze behaviour ──
            is_off = gaze not in ("Looking Forward", "No Face")
            beh    = gaze_analyser.update(is_off, head_yaw, head_pitch)

            if beh["sustained_alert"]: scorer.add_signal("gaze_sustained")
            if beh["freq_alert"]:      scorer.add_signal("gaze_freq")
            if beh["fusion_alert"]:    scorer.add_signal("head_eye_fusion")

            score, active_sigs = scorer.compute()
            draw_gaze_hud(display, beh, score, active_sigs, display.shape[0])

            s_ok, sc, sigs = scorer.should_save()

            if beh["sustained_alert"] and n_mp > 0:
                key = f"Suspicious: Sustained Gaze ({gaze})"
                if s_ok and log_event_once(student_id, key,
                                           last_event_time, cooldown=30):
                    hm = gaze_analyser.get_heatmap_evidence_frame(frame)
                    save_image_evidence(student_id, key, hm, score=sc)

            if beh["freq_alert"] and n_mp > 0:
                key = "Suspicious: Frequent Gaze Away"
                if s_ok and log_event_once(student_id, key,
                                           last_event_time, cooldown=20):
                    save_image_evidence(student_id,
                                        f"{key} [{beh['glance_count']}x]",
                                        frame, score=sc)

            if beh["fusion_alert"] and n_mp > 0:
                key = f"Suspicious: Head+Eye Deviated ({gaze})"
                if s_ok and log_event_once(student_id, key,
                                           last_event_time, cooldown=15):
                    save_image_evidence(student_id, key, frame, score=sc)

            # ── 2. EARBUD ──
            for (side, (x1,y1,x2,y2)) in ear_boxes:
                cv2.rectangle(display, (x1,y1), (x2,y2), (0,0,255), 2)
                cv2.putText(display, f"Earbud:{side}",
                            (x1, max(y1-5,10)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,0,255), 1)

            if earbud_det:
                scorer.add_signal("earbud_mp")
                cv2.putText(display, "EARBUD DETECTED!", (20,190),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,0,255), 2)
                s_ok, sc, _ = scorer.should_save()
                if s_ok and log_event_once(student_id,
                                           "Suspicious: Earbud Detected",
                                           last_event_time):
                    save_image_evidence(student_id,
                                        "Suspicious: Earbud Detected",
                                        frame, score=sc)

            # ── 3. FACE VERIFICATION — FIX 4: every 15 frames (was 30) ──
            if frame_count % 15 == 0:
                verified, n_f, fboxes, blinks, liveness_ok = face_verifier.verify(frame)

            for (lbl, (x1,y1,x2,y2), col) in fboxes:
                cv2.rectangle(display, (x1,y1), (x2,y2), col, 2)
                cv2.putText(display, lbl, (x1, max(y1-10,10)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.65, col, 2)

            blink_col = (0,220,100) if liveness_ok else (0,0,255)
            cv2.putText(display, f"Blinks:{blinks}",
                        (20,150), cv2.FONT_HERSHEY_SIMPLEX, 0.6, blink_col, 1)
            draw_liveness_warning(display, liveness_ok)

            if n_f == 0:
                scorer.add_signal("face_missing")
                cv2.putText(display, "No Face Detected", (20,50),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,0,255), 2)
                s_ok, sc, _ = scorer.should_save()
                if s_ok and log_event_once(student_id, "No Face Detected",
                                           last_event_time):
                    save_image_evidence(student_id, "No Face Detected",
                                        frame, score=sc)
                gaze_analyser.reset()

            elif n_f > 1:
                scorer.add_signal("multi_face")
                cv2.putText(display, f"Multiple Faces:{n_f}", (20,50),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,0,255), 2)
                s_ok, sc, _ = scorer.should_save()
                if s_ok and log_event_once(student_id,
                                           "Suspicious: Multiple Faces",
                                           last_event_time):
                    save_image_evidence(student_id,
                                        "Suspicious: Multiple Faces",
                                        frame, score=sc)

            elif not verified:
                scorer.add_signal("face_unknown")
                cv2.putText(display, "Unknown Face!", (20,50),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,0,255), 2)
                s_ok, sc, _ = scorer.should_save()
                if s_ok and log_event_once(student_id,
                                           "Suspicious: Unknown Face",
                                           last_event_time):
                    save_image_evidence(student_id, "Suspicious: Unknown Face",
                                        frame, score=sc)

            elif not liveness_ok:
                cv2.putText(display, "Verified (Liveness Pending)",
                            (20,50), cv2.FONT_HERSHEY_SIMPLEX,
                            0.9, (0,165,255), 2)
            else:
                cv2.putText(display, "Verified", (20,50),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0,220,100), 2)

            # ── 4. YOLO DEVICE DETECTION — every 3 frames ──
            if frame_count % 3 == 0:
                yr = yolo_model(frame, conf=YOLO_CONF, verbose=False)[0]
                for obj in yr.boxes:
                    rl  = yr.names[int(obj.cls)].lower()
                    cf  = float(obj.conf)
                    isd = rl in SUSPICIOUS_DEVICES
                    ise = any(kw in rl for kw in EARBUD_KEYWORDS)
                    if isd or ise:
                        x1,y1,x2,y2 = map(int, obj.xyxy[0])
                        col  = (0,0,255) if ise else (0,165,255)
                        dlbl = f"{'Earbud' if ise else 'Device'}:{rl}({cf:.2f})"
                        cv2.rectangle(display, (x1,y1), (x2,y2), col, 2)
                        cv2.putText(display, dlbl, (x1, max(y1-10,10)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, col, 2)
                        scorer.add_signal("earbud_yolo" if ise else "device_yolo")
                        s_ok, sc, _ = scorer.should_save()
                        ename = ("Suspicious: Earbud/Headphone Detected"
                                 if ise else f"Suspicious: Device ({rl})")
                        if s_ok and log_event_once(student_id, ename,
                                                    last_event_time):
                            save_image_evidence(student_id, ename,
                                                frame, score=sc)

            # ── 5. STATUS BAR ──
            ts       = datetime.datetime.now().strftime("%H:%M:%S")
            _, sc, _ = scorer.should_save()
            ear_st   = "Ear:Ready" if ged._ear_calib_done else "Ear:Calibrating"
            l2cs_st  = "L2CS" if l2cs.loaded else "MP-Fallback"
            cv2.putText(display,
                        f"{ts}  |  ProctoGrade  |  {ear_st}  |"
                        f"  {l2cs_st}  |  Score:{sc}",
                        (10, display.shape[0]-12),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180,180,180), 1)

            cv2.imshow(EXAM_WINDOW_TITLE, display)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                print("Monitoring stopped.")
                break

    finally:
        stop_event.set()
        cap.release()
        cv2.destroyAllWindows()
        print("Monitoring ended. All events saved to database.")


if __name__ == "__main__":
    main()