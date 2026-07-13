/**
 * ProctoGrade - Proctoring Routes
 * Place this in: proctograde-backend/routes/proctoringRoutes.js
 */

const express = require('express');
const router  = express.Router();
const {
  checkProctoringHealth,
  startProctoringSession,
  stopProctoringSession,
  getSessionStatus,
  getStudentEvents,
  getImageEvidence,
  getAudioEvidence,
  getProctoringReport,
} = require('../utils/proctoringService'); // ✅ FIXED: utils not services

// POST /api/proctoring/start
router.post('/start', async (req, res) => {
  try {
    const { studentId, examId } = req.body;
    if (!studentId || !examId) {
      return res.status(400).json({ success: false, message: 'studentId and examId are required' });
    }
    await checkProctoringHealth();
    const result = await startProctoringSession(studentId, examId);
    return res.json({
      success: true,
      sessionId: result.session_id,
      message: 'Proctoring started successfully',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/proctoring/stop
router.post('/stop', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId is required' });
    }
    const result = await stopProctoringSession(sessionId);
    return res.json({ success: true, message: result.message });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/proctoring/status/:sessionId
router.get('/status/:sessionId', async (req, res) => {
  try {
    const result = await getSessionStatus(req.params.sessionId);
    return res.json(result);
  } catch (err) {
    return res.status(404).json({ success: false, message: err.message });
  }
});

// GET /api/proctoring/events/:studentId
router.get('/events/:studentId', async (req, res) => {
  try {
    const { examId } = req.query;
    const result = await getStudentEvents(req.params.studentId, examId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/proctoring/evidence/:studentId/images
router.get('/evidence/:studentId/images', async (req, res) => {
  try {
    const { eventType, examId } = req.query;  
    const result = await getImageEvidence(req.params.studentId, examId, eventType);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/proctoring/evidence/:studentId/audio
router.get('/evidence/:studentId/audio', async (req, res) => {
  try {
    const { examId } = req.query;  // examId add kiya
    const result = await getAudioEvidence(req.params.studentId, examId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/proctoring/report/:studentId
router.get('/report/:studentId', async (req, res) => {
  try {
    const { examId } = req.query;
    const result = await getProctoringReport(req.params.studentId, examId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;