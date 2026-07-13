/**
 * ProctoGrade - Proctoring Service Integration
 * Place this file in your Node.js backend (e.g., services/proctoringService.js)
 * 
 * This connects your Node.js backend to the Python FastAPI proctoring service.
 */

const axios = require('axios');

const PROCTOR_URL = process.env.PROCTOR_SERVICE_URL || 'http://localhost:8000';

// ─────────────────────────────────────────────
//  CHECK IF PROCTORING SERVICE IS RUNNING
// ─────────────────────────────────────────────
const checkProctoringHealth = async () => {
  try {
    const res = await axios.get(`${PROCTOR_URL}/health`, { timeout: 3000 });
    return res.data;
  } catch (err) {
    throw new Error('Proctoring service is not running. Start it with: uvicorn api:app --port 8000');
  }
};

// ─────────────────────────────────────────────
//  START PROCTORING SESSION
//  Called when student gives consent and starts exam
// ─────────────────────────────────────────────
const startProctoringSession = async (studentId, examId) => {
  try {
    const res = await axios.post(`${PROCTOR_URL}/session/start`, {
      student_id: studentId,
      exam_id: examId,
    });
    return res.data; // { success, session_id, student_id, exam_id, message }
  } catch (err) {
    const msg = err.response?.data?.detail || err.message;
    throw new Error(`Failed to start proctoring: ${msg}`);
  }
};

// ─────────────────────────────────────────────
//  STOP PROCTORING SESSION
//  Called when student submits exam or time runs out
// ─────────────────────────────────────────────
const stopProctoringSession = async (sessionId) => {
  try {
    const res = await axios.post(`${PROCTOR_URL}/session/stop`, {
      session_id: sessionId,
    });
    return res.data; // { success, session_id, message }
  } catch (err) {
    const msg = err.response?.data?.detail || err.message;
    throw new Error(`Failed to stop proctoring: ${msg}`);
  }
};

// ─────────────────────────────────────────────
//  GET SESSION STATUS
// ─────────────────────────────────────────────
const getSessionStatus = async (sessionId) => {
  try {
    const res = await axios.get(`${PROCTOR_URL}/session/${sessionId}/status`);
    return res.data;
  } catch (err) {
    throw new Error(`Session not found: ${sessionId}`);
  }
};

// ─────────────────────────────────────────────
//  GET EVENTS (for teacher dashboard)
// ─────────────────────────────────────────────
const getStudentEvents = async (studentId, examId = null) => {
  try {
    const params = examId ? { exam_id: examId } : {};
    const res = await axios.get(`${PROCTOR_URL}/events/${studentId}`, { params });
    return res.data; // { student_id, total, events: [...] }
  } catch (err) {
    throw new Error(`Failed to fetch events: ${err.message}`);
  }
};

// ─────────────────────────────────────────────
//  GET IMAGE EVIDENCE (for teacher dashboard)
// ─────────────────────────────────────────────
const getImageEvidence = async (studentId, examId = null, eventType = null) => {
  try {
    const params = {};
    if (examId)    params.exam_id    = examId;
    if (eventType) params.event_type = eventType;
    const res = await axios.get(`${PROCTOR_URL}/evidence/${studentId}/images`, { params });
    return res.data;
  } catch (err) {
    throw new Error(`Failed to fetch image evidence: ${err.message}`);
  }
};

// ─────────────────────────────────────────────
//  GET AUDIO EVIDENCE (for teacher dashboard)
// ─────────────────────────────────────────────
const getAudioEvidence = async (studentId, examId = null) => {
  try {
    const params = {};
    if (examId) params.exam_id = examId;
    const res = await axios.get(`${PROCTOR_URL}/evidence/${studentId}/audio`, { params });
    return res.data;
  } catch (err) {
    throw new Error(`Failed to fetch audio evidence: ${err.message}`);
  }
};

// ─────────────────────────────────────────────
//  GET FULL REPORT (for teacher dashboard)
// ─────────────────────────────────────────────
const getProctoringReport = async (studentId, examId = null) => {
  try {
    const params = examId ? { exam_id: examId } : {};
    const res = await axios.get(`${PROCTOR_URL}/report/${studentId}`, { params });
    return res.data;
  } catch (err) {
    throw new Error(`Failed to fetch report: ${err.message}`);
  }
};

module.exports = {
  checkProctoringHealth,
  startProctoringSession,
  stopProctoringSession,
  getSessionStatus,
  getStudentEvents,
  getImageEvidence,
  getAudioEvidence,
  getProctoringReport,
};