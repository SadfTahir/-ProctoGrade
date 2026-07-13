"""
ProctoGrade - Python FastAPI Microservice
Run with: uvicorn api:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import uuid, os, io
from datetime import datetime
from bson import ObjectId

from db_connect import get_db
from proctoring_session import ProctoringSession

app = FastAPI(title="ProctoGrade Proctoring Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_sessions: dict[str, ProctoringSession] = {}

_evidence_count: dict[str, dict[str, int]] = {}
MAX_EVIDENCE_PER_EVENT = 2

def can_save_evidence(session_id: str, event_type: str) -> bool:
    if session_id not in _evidence_count:
        _evidence_count[session_id] = {}
    count = _evidence_count[session_id].get(event_type, 0)
    if count < MAX_EVIDENCE_PER_EVENT:
        _evidence_count[session_id][event_type] = count + 1
        return True
    return False

def clear_evidence_count(session_id: str):
    _evidence_count.pop(session_id, None)

class StartSessionRequest(BaseModel):
    student_id: str
    exam_id: str

class StopSessionRequest(BaseModel):
    session_id: str


# ─────────────────────────────────────────────
#  VALIDATE FACE — enrollment photo check
# ─────────────────────────────────────────────
@app.post("/validate-face")
async def validate_face(image: UploadFile = File(...)):
    import numpy as np
    import cv2
    from insightface.app import FaceAnalysis

    try:
        contents = await image.read()
        nparr    = np.frombuffer(contents, np.uint8)
        img      = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        face_app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
        face_app.prepare(ctx_id=-1, det_size=(320, 320))
        faces = face_app.get(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))

        face_count = len(faces)
        if face_count == 0:
            return {"ok": False, "face_count": 0,
                    "msg": "No face detected. Please sit in front of camera and retake."}
        if face_count > 1:
            return {"ok": False, "face_count": face_count,
                    "msg": "Multiple faces detected. Only one person should be visible."}
        return {"ok": True, "face_count": 1, "msg": "Face validated"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"validate-face error: {e}")
        return {"ok": True, "face_count": 1, "msg": "Validation skipped"}


# ─────────────────────────────────────────────
#  ENROLL
# ─────────────────────────────────────────────
@app.post("/enroll")
async def enroll_student(
    student_id: str = Form(...),
    images: List[UploadFile] = File(...),
    voice: Optional[UploadFile] = File(None),
):
    import numpy as np
    import cv2
    from insightface.app import FaceAnalysis
    from resemblyzer import VoiceEncoder, preprocess_wav

    face_app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
    face_app.prepare(ctx_id=-1, det_size=(320, 320))

    student_folder = os.path.join("data", student_id)
    os.makedirs(student_folder, exist_ok=True)

    embeddings = []
    for idx, img_file in enumerate(images):
        img_path = os.path.join(student_folder, f"reference_image_{idx+1}.jpg")
        contents = await img_file.read()
        with open(img_path, "wb") as f:
            f.write(contents)
        try:
            img   = cv2.imread(img_path)
            faces = face_app.get(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
            if not faces:
                print(f"No face in image {idx+1}")
                continue
            embeddings.append(np.array(faces[0].normed_embedding))
            print(f"Image {idx+1} enrolled: 512-dim embedding")
        except Exception as e:
            print(f"Image {idx+1} skipped: {e}")

    if len(embeddings) == 0:
        raise HTTPException(status_code=400, detail="No face detected in any image.")

    np.save(os.path.join(student_folder, "reference_embeddings.npy"), np.array(embeddings))

    voice_embed, voice_path = None, None
    if voice:
        voice_path = os.path.join(student_folder, "reference_voice.wav")
        try:
            raw_bytes = await voice.read()
            print(f"Voice received: {len(raw_bytes)} bytes, header: {raw_bytes[:4]}")
            from pydub import AudioSegment
            audio_seg = AudioSegment.from_file(io.BytesIO(raw_bytes))
            audio_seg = audio_seg.set_frame_rate(16000).set_channels(1)
            audio_seg.export(voice_path, format="wav")
            print(f"Voice converted to WAV: {os.path.getsize(voice_path)} bytes")
            wav         = preprocess_wav(voice_path)
            encoder     = VoiceEncoder()
            voice_embed = encoder.embed_utterance(wav).tolist()
            print("Voice embedding saved successfully")
        except Exception as e:
            print(f"Voice embedding failed: {e}")
            voice_embed = None

    db  = get_db()
    doc = {
        "id":              student_id,
        "enrolled_on":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "image_folder":    student_folder,
        "embeddings_path": os.path.join(student_folder, "reference_embeddings.npy"),
        "status":          "enrolled",
    }
    if voice_embed: doc["voice_embed"] = voice_embed
    if voice_path:  doc["voice_path"]  = voice_path

    db["students"].update_one({"id": student_id}, {"$set": doc}, upsert=True)
    return {"success": True, "student_id": student_id, "message": "Enrollment complete"}


# ─────────────────────────────────────────────
#  HEALTH
# ─────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ProctoGrade Proctoring", "timestamp": datetime.now().isoformat()}


# ─────────────────────────────────────────────
#  SESSION START
# ─────────────────────────────────────────────
@app.post("/session/start")
def start_session(req: StartSessionRequest, background_tasks: BackgroundTasks):
    db      = get_db()
    student = db["students"].find_one({"id": req.student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not enrolled.")
    for sid, sess in active_sessions.items():
        if sess.student_id == req.student_id and sess.is_running:
            raise HTTPException(status_code=409, detail=f"Session already active: {sid}")
    session_id = str(uuid.uuid4())
    session    = ProctoringSession(session_id=session_id, student_id=req.student_id,
                                   exam_id=req.exam_id, can_save_fn=can_save_evidence)
    active_sessions[session_id] = session
    background_tasks.add_task(session.start)
    return {"success": True, "session_id": session_id, "student_id": req.student_id,
            "exam_id": req.exam_id, "message": "Proctoring session started"}


# ─────────────────────────────────────────────
#  SESSION STOP
# ─────────────────────────────────────────────
@app.post("/session/stop")
def stop_session(req: StopSessionRequest):
    session = active_sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.stop()
    clear_evidence_count(req.session_id)
    del active_sessions[req.session_id]
    return {"success": True, "session_id": req.session_id, "message": "Proctoring session stopped"}


# ─────────────────────────────────────────────
#  SESSION STATUS
# ─────────────────────────────────────────────
@app.get("/session/{session_id}/status")
def get_session_status(session_id: str):
    session = active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": session_id, "student_id": session.student_id,
            "is_running": session.is_running,
            "started_at": session.started_at.isoformat() if session.started_at else None}


# ─────────────────────────────────────────────
#  EVENTS
# ─────────────────────────────────────────────
@app.get("/events/{student_id}")
def get_events(student_id: str, exam_id: Optional[str] = None):
    db    = get_db()
    query = {"student_id": student_id}
    if exam_id: query["exam_id"] = exam_id
    events = list(db["events"].find(query, {"_id": 0}).sort("timestamp", -1))
    for e in events:
        if isinstance(e.get("timestamp"), datetime):
            e["timestamp"] = e["timestamp"].isoformat()
    return {"student_id": student_id, "total": len(events), "events": events}


# ─────────────────────────────────────────────
#  IMAGE EVIDENCE
# ─────────────────────────────────────────────
@app.get("/evidence/{student_id}/images")
def get_image_evidence(student_id: str, exam_id: Optional[str] = None, event_type: Optional[str] = None):
    import base64
    db    = get_db()
    query = {"student_id": student_id}
    if exam_id:     query["exam_id"]    = exam_id
    if event_type:  query["event_type"] = event_type
    docs   = list(db["evidence"].find(query).sort("timestamp", -1).limit(50))
    result = []
    for doc in docs:
        img_b64 = None
        if doc.get("image"):
            img_b64 = base64.b64encode(doc["image"]).decode("utf-8")
        result.append({
            "id": str(doc["_id"]), "student_id": doc.get("student_id"),
            "exam_id": doc.get("exam_id"), "session_id": doc.get("session_id"),
            "event_type": doc.get("event_type"), "suspicion_score": doc.get("suspicion_score"),
            "timestamp": doc["timestamp"].isoformat() if isinstance(doc.get("timestamp"), datetime) else str(doc.get("timestamp")),
            "image_base64": img_b64
        })
    return {"student_id": student_id, "total": len(result), "evidence": result}


# ─────────────────────────────────────────────
#  AUDIO EVIDENCE LIST
# ─────────────────────────────────────────────
@app.get("/evidence/{student_id}/audio")
def get_audio_evidence(student_id: str, exam_id: Optional[str] = None):
    db    = get_db()
    query = {"student_id": student_id}
    if exam_id: query["exam_id"] = exam_id
    docs   = list(db["voice_evidence"].find(query).sort("timestamp", -1).limit(20))
    result = []
    for doc in docs:
        result.append({
            "id": str(doc["_id"]), "student_id": doc.get("student_id"),
            "exam_id": doc.get("exam_id"), "session_id": doc.get("session_id"),
            "event_type": doc.get("event_type"), "suspicion_score": doc.get("suspicion_score"),
            "timestamp": doc["timestamp"].isoformat() if isinstance(doc.get("timestamp"), datetime) else str(doc.get("timestamp")),
        })
    return {"student_id": student_id, "total": len(result), "audio_evidence": result}


# ─────────────────────────────────────────────
#  AUDIO STREAM
# ─────────────────────────────────────────────
@app.get("/evidence/audio/stream/{doc_id}")
def stream_audio(doc_id: str):
    db = get_db()
    try:
        obj_id = ObjectId(doc_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document ID")
    doc = db["voice_evidence"].find_one({"_id": obj_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Audio clip not found")
    audio_bytes = doc.get("audio")
    if not audio_bytes:
        raise HTTPException(status_code=404, detail="No audio data in this record")
    content_type = "audio/wav"
    if isinstance(audio_bytes, bytes):
        if audio_bytes[:3] == b'ID3' or audio_bytes[:2] == b'\xff\xfb':
            content_type = "audio/mpeg"
        elif audio_bytes[:4] == b'OggS':
            content_type = "audio/ogg"
    return StreamingResponse(io.BytesIO(audio_bytes), media_type=content_type,
        headers={"Content-Disposition": f"inline; filename=audio_{doc_id}.wav", "Accept-Ranges": "bytes"})


# ─────────────────────────────────────────────
#  FULL REPORT
# ─────────────────────────────────────────────
@app.get("/report/{student_id}")
def get_full_report(student_id: str, exam_id: Optional[str] = None):
    db    = get_db()
    query = {"student_id": student_id}
    if exam_id: query["exam_id"] = exam_id
    events      = list(db["events"].find(query, {"_id": 0}).sort("timestamp", -1))
    image_count = db["evidence"].count_documents({"student_id": student_id})
    audio_count = db["voice_evidence"].count_documents({"student_id": student_id})
    event_summary = {}
    for e in events:
        et = e.get("event_type", "Unknown")
        event_summary[et] = event_summary.get(et, 0) + 1
    for e in events:
        if isinstance(e.get("timestamp"), datetime):
            e["timestamp"] = e["timestamp"].isoformat()
    return {
        "student_id": student_id, "exam_id": exam_id,
        "total_events": len(events),
        "image_evidence_count": image_count,
        "audio_evidence_count": audio_count,
        "event_summary": event_summary,
        "events": events
    }