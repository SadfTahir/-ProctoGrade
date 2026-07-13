// src/components/StudentComponents/StudentExamAttempt.jsx
// v3.7 — Face validation added (no face, multiple faces, blur check)

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import "../../Pages/Dashboards/StudentDashboard.css";

const BACKEND_URL = "http://localhost:5000";
const PROCTOR_URL = "http://localhost:8000";

function getStudentId() {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    return user?.id || user?._id || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
//  ANTI-CHEAT HOOK
// ─────────────────────────────────────────────
function useAntiCheat() {
  useEffect(() => {
    const block = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
    const blockKeys = (e) => {
      const key = e.key?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a"].includes(key)) {
        e.preventDefault(); e.stopPropagation(); return false;
      }
      if (e.key === "F12") { e.preventDefault(); return false; }
    };
    document.addEventListener("copy",        block,     true);
    document.addEventListener("cut",         block,     true);
    document.addEventListener("paste",       block,     true);
    document.addEventListener("contextmenu", block,     true);
    document.addEventListener("keydown",     blockKeys, true);
    document.body.style.userSelect       = "none";
    document.body.style.webkitUserSelect = "none";
    document.body.style.mozUserSelect    = "none";
    document.body.style.msUserSelect     = "none";
    return () => {
      document.removeEventListener("copy",        block,     true);
      document.removeEventListener("cut",         block,     true);
      document.removeEventListener("paste",       block,     true);
      document.removeEventListener("contextmenu", block,     true);
      document.removeEventListener("keydown",     blockKeys, true);
      document.body.style.userSelect       = "";
      document.body.style.webkitUserSelect = "";
      document.body.style.mozUserSelect    = "";
      document.body.style.msUserSelect     = "";
    };
  }, []);
}

// ─────────────────────────────────────────────
//  ANSWER TEXTAREA
// ─────────────────────────────────────────────
function AnswerTextarea({ value, onChange, maxLength }) {
  const ref     = useRef(null);
  const lastVal = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const blockAll = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
    el.addEventListener("paste",       blockAll, true);
    el.addEventListener("drop",        blockAll, true);
    el.addEventListener("contextmenu", blockAll, true);
    return () => {
      el.removeEventListener("paste",       blockAll, true);
      el.removeEventListener("drop",        blockAll, true);
      el.removeEventListener("contextmenu", blockAll, true);
    };
  }, []);

  const handleKeyDown = (e) => {
    const allowed = ["Backspace","Delete","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","Tab","Enter"];
    if ((e.ctrlKey || e.metaKey) && ["v","c","x","a"].includes(e.key.toLowerCase())) {
      e.preventDefault(); e.stopPropagation(); return;
    }
    if (allowed.includes(e.key)) return;
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) return;
    e.preventDefault();
  };

  const handleInput = (e) => {
    const newVal = e.target.value;
    const prev   = lastVal.current || "";
    if (newVal.length - prev.length > 1) {
      e.target.value = prev;
      onChange({ target: { value: prev } });
      return;
    }
    lastVal.current = newVal;
    onChange(e);
  };

  useEffect(() => { lastVal.current = value; }, [value]);

  return (
    <textarea
      ref={ref} rows={4}
      className="answer-textarea exam-textarea"
      placeholder="Type your answer here (max 220 characters)..."
      value={value}
      onChange={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={(e)  => { e.preventDefault(); e.stopPropagation(); }}
      onCopy={(e)   => { e.preventDefault(); e.stopPropagation(); }}
      onCut={(e)    => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e)   => { e.preventDefault(); e.stopPropagation(); }}
      maxLength={maxLength}
      autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
      style={{ WebkitUserSelect: "text", userSelect: "text" }}
    />
  );
}

// ─────────────────────────────────────────────
//  FACE VALIDATION HELPERS
// ─────────────────────────────────────────────

// Brightness check — dark/covered image detect karo
function getImageBrightness(canvas) {
  const ctx  = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let total  = 0;
  for (let i = 0; i < data.length; i += 4)
    total += (data[i] + data[i+1] + data[i+2]) / 3;
  return total / (data.length / 4);
}

// Blur check — Laplacian variance (low = blurry)
function getBlurScore(canvas) {
  const ctx  = canvas.getContext("2d");
  const w    = canvas.width;
  const h    = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  // Convert to grayscale
  const gray = [];
  for (let i = 0; i < data.length; i += 4)
    gray.push((data[i] + data[i+1] + data[i+2]) / 3);

  // Laplacian kernel
  let sum = 0, count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap =
        -gray[(y-1)*w + x] -
        gray[(y+1)*w + x] -
        gray[y*w + (x-1)] -
        gray[y*w + (x+1)] +
        4 * gray[y*w + x];
      sum   += lap * lap;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

// Validate face via InsightFace API (quick check — send image to /validate-face)
// Fallback: brightness + blur check only (no extra API needed)
async function validateFaceImage(blob) {
  try {
    // Try backend face validation
    const fd = new FormData();
    fd.append("image", blob, "check.jpg");
    const res  = await fetch(`${PROCTOR_URL}/validate-face`, { method: "POST", body: fd });
    if (res.ok) {
      const data = await res.json();
      if (data.face_count === 0)  return { ok: false, msg: "No face detected. Please sit in front of camera and retake." };
      if (data.face_count > 1)   return { ok: false, msg: "Multiple faces detected. Only one person should be visible." };
      return { ok: true };
    }
  } catch {
    // Backend not available — fallback to client-side checks
  }

  // Client-side fallback checks
  return new Promise((resolve) => {
    const img    = new Image();
    const url    = URL.createObjectURL(blob);
    img.onload   = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const brightness = getImageBrightness(canvas);
      const blur       = getBlurScore(canvas);

      if (brightness < 30)  return resolve({ ok: false, msg: "Image too dark. Please improve lighting and retake." });
      if (brightness > 240) return resolve({ ok: false, msg: "Image too bright/overexposed. Please retake." });
      if (blur < 50)        return resolve({ ok: false, msg: "Image too blurry. Please hold still and retake." });

      resolve({ ok: true });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: true }); };
    img.src = url;
  });
}

// ─────────────────────────────────────────────
//  CONSENT + ENROLLMENT MODAL
// ─────────────────────────────────────────────
function ConsentModal({ onDone, onCancel, examTitle }) {
  const videoRef         = useRef(null);
  const streamRef        = useRef(null);
  const mediaRecorderRef = useRef(null);

  const [step, setStep]             = useState("intro");
  const [photos, setPhotos]         = useState([]);
  const [photoBlobs, setPhotoBlobs] = useState([]);
  const [recording, setRecording]   = useState(false);
  const [audioBlob, setAudioBlob]   = useState(null);
  const [countdown, setCountdown]   = useState(null);
  const [error, setError]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [validating, setValidating] = useState(false);

  const videoCallbackRef = useCallback((node) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setStep("camera");
    } catch {
      setError("Camera or microphone access denied. Please allow permissions and try again.");
    }
  };

  // ── FIX: capturePhoto with face validation ──
  const capturePhotoWithValidation = async () => {
    const video = videoRef.current;
    if (!video) return null;

    const canvas  = document.createElement("canvas");
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return resolve(null);

        setValidating(true);
        const result = await validateFaceImage(blob);
        setValidating(false);

        if (!result.ok) {
          setError(result.msg);
          return resolve(null);
        }

        const b64 = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ blob, b64 });
      }, "image/jpeg", 0.85);
    });
  };

  const startAutoCapture = async () => {
    setPhotos([]);
    setPhotoBlobs([]);
    setError("");

    let captured = 0;
    const newPhotos = [];
    const newBlobs  = [];

    const captureNext = async () => {
      if (captured >= 3) {
        setTimeout(() => setStep("voice"), 700);
        return;
      }

      setCountdown(3 - captured);
      await new Promise(r => setTimeout(r, 800));

      const result = await capturePhotoWithValidation();
      if (!result) {
        // Validation failed — reset and let user retry
        setCountdown(null);
        setPhotos([]);
        setPhotoBlobs([]);
        return;
      }

      newBlobs.push(result.blob);
      newPhotos.push(result.b64);
      captured++;
      setPhotos([...newPhotos]);
      setPhotoBlobs([...newBlobs]);

      await new Promise(r => setTimeout(r, 500));
      captureNext();
    };

    captureNext();
  };

  const startVoiceRecording = () => {
    if (!streamRef.current) return;
    setRecording(true);
    setAudioBlob(null);
    setError("");
    const chunks = [];
    const mr = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => chunks.push(e.data);
    mr.onstop = () => { setAudioBlob(new Blob(chunks, { type: "audio/wav" })); setRecording(false); };
    mr.start();
    setTimeout(() => { if (mr.state === "recording") mr.stop(); }, 6000);
  };

  const saveEnrollment = async () => {
    setSaving(true);
    setError("");
    const studentId = getStudentId();
    if (!studentId) {
      setError("Could not get student ID. Please log in again.");
      setSaving(false);
      return;
    }
    try {
      const formData = new FormData();
      formData.append("student_id", studentId);
      photoBlobs.forEach((blob, i) => formData.append("images", blob, `photo_${i + 1}.jpg`));
      if (audioBlob) formData.append("voice", audioBlob, "voice.wav");

      const res  = await fetch(`${PROCTOR_URL}/enroll`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Enrollment failed");

      streamRef.current?.getTracks().forEach((t) => t.stop());
      setStep("done");
      setTimeout(() => onDone(studentId), 800);
    } catch (err) {
      setError(err.message || "Failed to save. Make sure proctoring service is running.");
      setSaving(false);
    }
  };

  const handleCancel = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCancel();
  };

  return (
    <div style={cs.overlay}>
      <div style={cs.modal}>
        {step === "intro" && (
          <>
            <h2 style={cs.title}>🎥 Proctored Exam</h2>
            <p style={cs.subtitle}><strong>{examTitle}</strong></p>
            <p style={cs.desc}>This exam uses <strong>ProctoGrade AI Proctoring</strong>. Before starting, we need to:</p>
            <ul style={cs.list}>
              <li>📷 Capture <strong>3 photos</strong> of your face</li>
              <li>🎤 Record a <strong>short voice sample</strong></li>
              <li>🖥️ Monitor your screen during the exam</li>
              <li>👁️ Track gaze & detect suspicious activity</li>
            </ul>
            <p style={cs.warning}>⚠️ Any suspicious activity will be reported to your instructor.</p>
            {error && <p style={cs.error}>{error}</p>}
            <div style={cs.btnRow}>
              <button style={cs.primaryBtn} onClick={startCamera}>✅ I Agree — Continue</button>
              <button style={cs.cancelBtn}  onClick={handleCancel}>❌ Cancel</button>
            </div>
          </>
        )}

        {step === "camera" && (
          <>
            <h2 style={cs.title}>📷 Face Registration</h2>
            <p style={cs.desc}>Sit straight, look at the camera. We will take <strong>3 photos</strong> automatically.</p>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <video ref={videoCallbackRef} autoPlay muted playsInline
                onLoadedMetadata={(e) => e.target.play().catch(() => {})} style={cs.video} />
              {countdown !== null && <div style={cs.countdownOverlay}>{countdown}</div>}
              {validating && (
                <div style={cs.validatingOverlay}>
                  <div style={cs.validatingSpinner} />
                  <span>Checking face...</span>
                </div>
              )}
            </div>
            <div style={cs.photoRow}>
              {[0, 1, 2].map((i) =>
                photos[i]
                  ? <img key={i} src={photos[i]} alt={`Photo ${i+1}`} style={cs.thumb} />
                  : <div key={i} style={cs.thumbEmpty}>📷</div>
              )}
            </div>
            {error && (
              <div style={cs.faceError}>
                ⚠️ {error}
                <p style={{ margin: "6px 0 0", fontSize: 12, opacity: 0.8 }}>Please fix the issue and try again.</p>
              </div>
            )}
            <div style={cs.btnRow}>
              {photos.length < 3 && (
                <button style={cs.primaryBtn} onClick={startAutoCapture} disabled={validating}>
                  {validating ? "Validating..." : "📸 Capture 3 Photos"}
                </button>
              )}
              {photos.length === 3 && (
                <button style={cs.primaryBtn} onClick={() => setStep("voice")}>✅ Done — Next</button>
              )}
              <button style={cs.cancelBtn} onClick={handleCancel}>Cancel</button>
            </div>
          </>
        )}

        {step === "voice" && (
          <>
            <h2 style={cs.title}>🎤 Voice Registration</h2>
            <p style={cs.desc}>Please <strong>read aloud</strong> the sentence below clearly:</p>
            <div style={cs.voicePrompt}>"I am ready to start my exam."</div>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>Recording auto-stops after 6 seconds.</p>
            {recording && <div style={cs.recordingRow}><span style={cs.recordingDot} />Recording... speak now</div>}
            {audioBlob && !recording && <p style={{ color: "#22c55e", fontSize: 13, marginBottom: 12 }}>✅ Voice recorded successfully!</p>}
            {error && <p style={cs.error}>{error}</p>}
            <div style={cs.btnRow}>
              {!audioBlob && !recording && <button style={cs.primaryBtn} onClick={startVoiceRecording}>🎤 Start Recording</button>}
              {recording && <button style={{ ...cs.primaryBtn, background: "#ef4444" }} disabled>⏺ Recording (6s)...</button>}
              {audioBlob && !recording && (
                <>
                  <button style={cs.primaryBtn} onClick={saveEnrollment} disabled={saving}>{saving ? "Saving..." : "✅ Save & Start Exam"}</button>
                  <button style={cs.cancelBtn} onClick={startVoiceRecording}>🔄 Re-record</button>
                </>
              )}
              {!recording && <button style={cs.cancelBtn} onClick={handleCancel}>Cancel</button>}
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <h2 style={cs.title}>✅ All Set!</h2>
            <p style={cs.desc}>Registration complete. Starting exam and proctoring...</p>
            <div style={cs.spinner} />
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  PROCTORING LOADING SCREEN
// ─────────────────────────────────────────────
function ProctoringLoadingScreen() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const id = setInterval(() => setDots((d) => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f172a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ width: 70, height: 70, border: "5px solid #1e293b", borderTop: "5px solid #22c55e", borderRadius: "50%", marginBottom: 28, animation: "proctoSpin 1s linear infinite" }} />
      <style>{`@keyframes proctoSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes proctoFade{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
      <h2 style={{ color: "#f8fafc", fontSize: 22, fontWeight: 700, marginBottom: 10 }}>🎥 Starting AI Proctoring{dots}</h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24, textAlign: "center", maxWidth: 300 }}>Please wait while we initialize the monitoring system</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 260 }}>
        {[{ icon: "✅", text: "Face enrollment complete" }, { icon: "✅", text: "Voice enrollment complete" }, { icon: "⏳", text: "Connecting proctoring engine..." }].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "#1e293b", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: item.icon === "✅" ? "#22c55e" : "#94a3b8", animation: item.icon === "⏳" ? "proctoFade 1.5s ease-in-out infinite" : "none" }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>{item.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN EXAM ATTEMPT COMPONENT
// ─────────────────────────────────────────────
export default function StudentExamAttempt() {
  const { examId }  = useParams();
  const location    = useLocation();
  const navigate    = useNavigate();
  const initialExam = location.state?.exam || null;

  const [exam, setExam]       = useState(initialExam);
  const [loading, setLoading] = useState(!initialExam);
  const [error, setError]     = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]           = useState({});
  const [submitting, setSubmitting]     = useState(false);
  const [timeLeft, setTimeLeft]         = useState(null);

  const [showConsent, setShowConsent]             = useState(false);
  const [examStarted, setExamStarted]             = useState(false);
  const [proctoringLoading, setProctoringLoading] = useState(false);
  const [proctoringSessionId, setProctoringSessionId] = useState(null);
  const [proctoringError, setProctoringError]     = useState("");

  useAntiCheat();

  useEffect(() => {
    if (initialExam) { setShowConsent(true); return; }
    if (!examId) return;
    (async () => {
      try {
        setLoading(true);
        const res  = await fetch(`${BACKEND_URL}/api/exams/${examId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.msg || "Failed to load exam");
        setExam(data);
        setShowConsent(true);
      } catch (err) {
        setError(err.message || "Error loading exam");
      } finally {
        setLoading(false);
      }
    })();
  }, [examId, initialExam]);

  useEffect(() => {
    if (!exam || !examStarted) return;
    const storageKey   = `exam_start_${exam._id}`;
    let startTimeStr   = localStorage.getItem(storageKey);
    if (!startTimeStr) { startTimeStr = Date.now().toString(); localStorage.setItem(storageKey, startTimeStr); }
    const startTime    = parseInt(startTimeStr, 10);
    const elapsedSec   = Math.floor((Date.now() - startTime) / 1000);
    const allowedMin   = exam.duration || exam.durationMinutes || 30;
    const totalAllowed = allowedMin * 60;
    let windowLeft     = Infinity;
    if (exam.endTime) windowLeft = Math.max(0, Math.floor((new Date(exam.endTime).getTime() - Date.now()) / 1000));
    const finalTime    = Math.min(totalAllowed - elapsedSec, windowLeft);
    setTimeLeft(finalTime > 0 ? finalTime : 0);
  }, [exam, examStarted]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { if (!submitting) handleSubmit(true); return; }
    const id = setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : t)), 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  const startProctoring = async (studentId) => {
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(`${BACKEND_URL}/api/proctoring/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId, examId: exam._id || examId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setProctoringError(data?.message || "Proctoring unavailable");
      else setProctoringSessionId(data.sessionId);
    } catch { setProctoringError("Proctoring service not reachable"); }
  };

  const stopProctoring = async (sessionId) => {
    if (!sessionId) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${BACKEND_URL}/api/proctoring/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId }),
      });
    } catch {}
  };

  const handleConsentDone = async (studentId) => {
    setShowConsent(false);
    setProctoringLoading(true);
    await startProctoring(studentId);
    setProctoringLoading(false);
    setExamStarted(true);
  };

  const handleSubmit = async (autoSubmit = false) => {
    const token = localStorage.getItem("token");
    if (!token) { alert("Not authenticated."); return; }
    if (!autoSubmit && !allAttempted) { alert("Please attempt all questions before submitting."); return; }
    const questionsArr   = Array.isArray(exam.questions) ? exam.questions : [];
    const payloadAnswers = questionsArr.map((q, index) => {
      const questionId = q._id || q.id || index.toString();
      const val        = answers[questionId];
      const type       = q.type || "mcq";
      const base       = { questionId, questionText: q.text || q.questionText || `Question ${index + 1}`, type };
      if (type === "mcq") return { ...base, selectedOptionIndex: typeof val === "number" ? val : null };
      return { ...base, textAnswer: typeof val === "string" ? val.slice(0, 220) : "" };
    });
    try {
      setSubmitting(true);
      await stopProctoring(proctoringSessionId);
      const res = await fetch(`${BACKEND_URL}/api/exams/${exam._id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers: payloadAnswers, classId: exam.classId, autoSubmit, proctoringSessionId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { alert(data?.msg || "Failed to submit"); return; }
      alert(autoSubmit ? "Time is over. Exam submitted automatically." : "Exam submitted successfully.");
      navigate("/student-dashboard", { state: { refreshAttempts: Date.now() } });
    } catch (err) {
      alert(err.message || "Error submitting exam");
    } finally {
      setSubmitting(false);
    }
  };

  const isAttempted = (q, index) => {
    const id  = q._id || q.id || index.toString();
    const val = answers[id];
    if ((q.type || "mcq") === "mcq") return typeof val === "number";
    return typeof val === "string" && val.trim().length > 0;
  };

  const allAttempted = exam?.questions?.length > 0 && exam.questions.every((q, i) => isAttempted(q, i));
  const minutes      = Math.floor((timeLeft || 0) / 60);
  const seconds      = (timeLeft || 0) % 60;

  if (loading)           return <div className="student-page"><p>Loading exam...</p></div>;
  if (error)             return <div className="student-page"><p className="join-error">{error}</p></div>;
  if (!exam)             return <div className="student-page"><p className="muted-text">Exam not found.</p></div>;
  if (showConsent)       return <ConsentModal examTitle={exam.title} onDone={handleConsentDone} onCancel={() => navigate(-1)} />;
  if (proctoringLoading) return <ProctoringLoadingScreen />;

  const questions       = Array.isArray(exam.questions) ? exam.questions : [];
  const total           = questions.length;
  const currentQuestion = questions[currentIndex] || {};
  const qId             = currentQuestion._id || currentQuestion.id || currentIndex.toString();
  const qText           = currentQuestion.text || currentQuestion.questionText || "Question text";
  const qType           = currentQuestion.type || "mcq";
  const options         = currentQuestion.options || currentQuestion.choices || [];
  const selectedValue   = answers[qId] ?? "";

  return (
    <div className="student-page">
      <style>{`
        .exam-no-select, .exam-no-select * { -webkit-user-select:none!important; -moz-user-select:none!important; -ms-user-select:none!important; user-select:none!important; -webkit-touch-callout:none!important; }
        .exam-textarea { -webkit-user-select:text!important; -moz-user-select:text!important; user-select:text!important; caret-color:auto!important; }
        .exam-textarea::selection { background:transparent!important; }
      `}</style>

      <div className="student-header exam-no-select">
        <div>
          <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
          <h2 className="student-title">{exam.title}</h2>
          <p className="student-subtitle">
            Question {currentIndex + 1} of {total || "?"}
            {timeLeft !== null && (
              <span style={{ marginLeft: 8 }}>
                • Time left: {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
              </span>
            )}
            <span style={{ marginLeft: 12, fontSize: 13, color: proctoringSessionId ? "#22c55e" : "#f59e0b" }}>
              {proctoringSessionId ? "🟢 Proctoring Active" : "🟡 Connecting..."}
            </span>
          </p>
          {proctoringError && <p style={{ color: "#f59e0b", fontSize: 12 }}>⚠️ {proctoringError}</p>}
        </div>
      </div>

      <div className="student-main exam-main-layout">
        <aside className="exam-question-sidebar exam-no-select">
          <h4 className="exam-sidebar-title">Questions</h4>
          <ul className="exam-question-list">
            {questions.map((q, index) => {
              const id        = q._id || q.id || index.toString();
              const attempted = isAttempted(q, index);
              const isActive  = index === currentIndex;
              return (
                <li key={id}
                  className={"exam-question-pill" + (isActive ? " exam-question-pill-active" : "") + (attempted ? " exam-question-pill-attempted" : "")}
                  onClick={() => setCurrentIndex(index)}
                >
                  <span className="pill-index">{index + 1}</span>
                  {attempted && <span className="pill-status">✓</span>}
                </li>
              );
            })}
          </ul>
        </aside>

        <main className="student-content">
          <div className="student-tab-panel">
            {total === 0 ? (
              <p className="muted-text">No questions found.</p>
            ) : (
              <>
                <div className="exam-question-card exam-no-select">
                  <p className="exam-question-text">{qText}</p>
                </div>

                {qType === "mcq" ? (
                  <div className="exam-options-card exam-no-select">
                    <ul className="exam-options-list">
                      {options.map((opt, idx) => (
                        <li key={idx}
                          className={"exam-option-item" + (selectedValue === idx ? " exam-option-item-active" : "")}
                          onClick={() => setAnswers((p) => ({ ...p, [qId]: idx }))}
                        >{opt}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="exam-options-card">
                    <AnswerTextarea
                      value={typeof selectedValue === "string" ? selectedValue : ""}
                      onChange={(e) => setAnswers((p) => ({ ...p, [qId]: e.target.value }))}
                      maxLength={220}
                    />
                    <div className="char-counter">{(typeof selectedValue === "string" ? selectedValue : "").length}/220</div>
                  </div>
                )}

                <div className="exam-nav-row exam-no-select">
                  <button className="class-secondary-btn" disabled={currentIndex === 0 || submitting} onClick={() => setCurrentIndex((i) => i - 1)}>Previous</button>
                  {currentIndex < total - 1 ? (
                    <button className="class-primary-btn" disabled={submitting} onClick={() => setCurrentIndex((i) => i + 1)}>Next</button>
                  ) : (
                    <button className="class-primary-btn" disabled={submitting || !allAttempted} onClick={() => handleSubmit(false)}>
                      {submitting ? "Submitting..." : allAttempted ? "Submit" : "Attempt all questions"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

const cs = {
  overlay:           { position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  modal:             { background: "#1e1e2e", borderRadius: 16, padding: "32px 28px", maxWidth: 500, width: "90%", color: "#e2e8f0", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", maxHeight: "90vh", overflowY: "auto" },
  title:             { fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#f8fafc" },
  subtitle:          { fontSize: 15, color: "#94a3b8", marginBottom: 12 },
  desc:              { fontSize: 14, marginBottom: 12, lineHeight: 1.6 },
  list:              { paddingLeft: 20, marginBottom: 12, fontSize: 14, lineHeight: 2.2 },
  warning:           { fontSize: 13, color: "#fbbf24", marginBottom: 16, padding: "8px 12px", background: "rgba(251,191,36,0.1)", borderRadius: 8 },
  error:             { color: "#ef4444", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 8 },
  faceError:         { color: "#fbbf24", fontSize: 13, marginBottom: 12, padding: "10px 14px", background: "rgba(251,191,36,0.1)", borderRadius: 8, border: "1px solid rgba(251,191,36,0.3)" },
  btnRow:            { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 },
  primaryBtn:        { flex: 1, padding: "10px 16px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 },
  cancelBtn:         { flex: 1, padding: "10px 16px", borderRadius: 8, border: "1px solid #475569", background: "transparent", color: "#94a3b8", fontWeight: 600, cursor: "pointer", fontSize: 14 },
  video:             { width: "100%", borderRadius: 10, background: "#111", maxHeight: 220, display: "block" },
  countdownOverlay:  { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 72, fontWeight: 900, color: "#fff", textShadow: "0 0 20px rgba(0,0,0,0.8)" },
  validatingOverlay: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#fff", fontSize: 14, fontWeight: 600, borderRadius: 10 },
  validatingSpinner: { width: 20, height: 20, border: "3px solid rgba(255,255,255,0.3)", borderTop: "3px solid #fff", borderRadius: "50%", animation: "proctoSpin 0.8s linear infinite" },
  photoRow:          { display: "flex", gap: 8, marginBottom: 12, justifyContent: "center" },
  thumb:             { width: 90, height: 70, objectFit: "cover", borderRadius: 8, border: "2px solid #22c55e" },
  thumbEmpty:        { width: 90, height: 70, borderRadius: 8, border: "2px dashed #475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#475569" },
  voicePrompt:       { background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: "14px 18px", fontSize: 15, fontStyle: "italic", color: "#e2e8f0", marginBottom: 12, lineHeight: 1.6 },
  recordingRow:      { display: "flex", alignItems: "center", gap: 10, color: "#ef4444", fontWeight: 600, fontSize: 14, marginBottom: 12 },
  recordingDot:      { width: 12, height: 12, borderRadius: "50%", background: "#ef4444" },
  spinner:           { width: 40, height: 40, border: "4px solid #334155", borderTop: "4px solid #22c55e", borderRadius: "50%", margin: "20px auto" },
};