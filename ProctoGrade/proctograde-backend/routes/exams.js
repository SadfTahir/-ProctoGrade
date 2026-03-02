// routes/exams.js
// ProctoGrade — By Topic + By Content
// ✅ v10.0 FIXED: SSL/TLS decryption error on long-running by-content requests
//    Root cause: ngrok drops TLS connection on long idle periods
//    Fix: Keep-alive agent + socket timeout + retry logic + proper headers

const express = require("express");
const Exam = require("../models/Exam");
const User = require("../models/User");
const ExamAttempt = require("../models/ExamAttempt");
const auth = require("../middleware/auth");
const { gradeAttempt } = require("../utils/gradingService");
const axios = require("axios");
const FormData = require("form-data");
const https = require("https");
const http = require("http");
const router = express.Router();

// ============================================================
// ✅ SSL AGENTS — Industrial grade ngrok fix
//    - rejectUnauthorized: false  → ignores self-signed/ngrok certs
//    - keepAlive: true            → prevents TLS mid-connection drop
//    - keepAliveMsecs: 30000      → heartbeat every 30s
//    - timeout: 0                 → no socket-level timeout (we handle in axios)
// ============================================================
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  keepAliveMsecs: 30000,
  timeout: 0,
  maxSockets: 10,
  scheduling: "fifo",
});

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  timeout: 0,
  maxSockets: 10,
});

// ✅ Standard headers for all Colab requests (prevents ngrok warning page)
const COLAB_HEADERS = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
  "User-Agent": "ProctoGrade-Backend/10.0",
  "Connection": "keep-alive",
};

console.log("✅ exams routes loaded v10.0");

// ============================================================
// HELPER: Compute exam status
// ============================================================
function computeStatus(e, now) {
  let computedStatus = e.status || "Draft";
  if (e.startTime && e.endTime) {
    const start = new Date(e.startTime);
    const end = new Date(e.endTime);
    if (now < start) computedStatus = "Scheduled";
    else if (now >= start && now <= end) computedStatus = "Active";
    else if (now > end) computedStatus = "Closed";
  }
  return computedStatus;
}

// ============================================================
// HELPER: Get AI service URL (always https for ngrok)
// ============================================================
function getAIServiceURL() {
  let url = process.env.COLAB_RAG_URL;
  if (!url) {
    console.error("❌ COLAB_RAG_URL not set in .env");
    return null;
  }
  url = url.trim().replace(/\/$/, "");
  // Force https — ngrok requires it
  if (url.startsWith("http://")) {
    url = "https://" + url.slice(7);
    console.warn("⚠️  Auto-fixed URL to https:", url);
  }
  return url;
}

// ============================================================
// HELPER: Safe JSON parse
// ============================================================
function safeParseColabResponse(rawData) {
  if (typeof rawData === "object" && rawData !== null) {
    return { ok: true, data: rawData };
  }
  try {
    return { ok: true, data: JSON.parse(rawData) };
  } catch {
    const preview = String(rawData).slice(0, 300);
    console.error("❌ Non-JSON from Colab:", preview);
    return { ok: false, preview };
  }
}

// ============================================================
// ✅ CORE FIX: colabPost — handles all long-running Colab calls
//    - Uses keep-alive HTTPS agent
//    - Retries once on TLS/SSL error
//    - Detailed error logging
// ============================================================
async function colabPost(url, payload, timeoutMs = 600000) {
  const config = {
    timeout: timeoutMs,
    headers: COLAB_HEADERS,
    validateStatus: () => true,
    httpsAgent,
    httpAgent,
    maxRedirects: 5,
    decompress: true,
  };

  try {
    console.log(`📡 POST ${url}`);
    const response = await axios.post(url, payload, config);
    console.log(`📥 Response: ${response.status}`);
    return response;
  } catch (err) {
    const isSSLError =
      err.message?.includes("SSL") ||
      err.message?.includes("TLS") ||
      err.message?.includes("decryption") ||
      err.message?.includes("bad record") ||
      err.code === "ECONNRESET" ||
      err.code === "EPROTO";

    if (isSSLError) {
      console.warn(`⚠️  SSL error on first attempt: ${err.message}`);
      console.warn("🔄 Retrying with TLS verification disabled...");

      // ✅ Retry: fresh agent, disable TLS verification completely
      const retryAgent = new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
        keepAliveMsecs: 10000,
        secureProtocol: "TLSv1_2_method",
      });

      const retryConfig = {
        ...config,
        httpsAgent: retryAgent,
        headers: {
          ...COLAB_HEADERS,
          "Cache-Control": "no-cache",
        },
      };

      console.log(`📡 RETRY POST ${url}`);
      const retryResponse = await axios.post(url, payload, retryConfig);
      console.log(`📥 Retry Response: ${retryResponse.status}`);
      return retryResponse;
    }

    throw err; // non-SSL error — let caller handle
  }
}

// ============================================================
// HELPER: colabGet — for short GET requests
// ============================================================
async function colabGet(url, timeoutMs = 15000) {
  try {
    return await axios.get(url, {
      timeout: timeoutMs,
      headers: { ...COLAB_HEADERS },
      validateStatus: () => true,
      httpsAgent,
    });
  } catch (err) {
    throw err;
  }
}

// ============================================================
// GET /api/exams/subjects
// ============================================================
router.get("/subjects", async (req, res) => {
  try {
    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ msg: "AI service not configured" });

    const response = await colabGet(`${COLAB_URL}/api/subjects`);
    const parsed = safeParseColabResponse(response.data);
    if (!parsed.ok) return res.status(503).json({ msg: "Invalid response from AI service" });
    return res.json(parsed.data);
  } catch (err) {
    console.error("❌ Subjects fetch error:", err.message);
    return res.status(500).json({ msg: "Failed to fetch subjects", error: err.message });
  }
});

// ============================================================
// GET /api/exams/subjects/:subject/topics
// ============================================================
router.get("/subjects/:subject/topics", async (req, res) => {
  try {
    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ msg: "AI service not configured" });

    const subject = encodeURIComponent(req.params.subject);
    const response = await colabGet(`${COLAB_URL}/api/subjects/${subject}/topics`);

    if (response.status === 404) return res.status(404).json({ msg: "Subject not found" });

    const parsed = safeParseColabResponse(response.data);
    if (!parsed.ok) return res.status(503).json({ msg: "Invalid response from AI service" });
    return res.json(parsed.data);
  } catch (err) {
    console.error("❌ Topics fetch error:", err.message);
    return res.status(500).json({ msg: "Failed to fetch topics", error: err.message });
  }
});

// ============================================================
// POST /api/exams/generate/by-topic
// ============================================================
router.post("/generate/by-topic", async (req, res) => {
  try {
    const { subject, topic, question_type, num_questions, difficulty } = req.body;

    if (!subject?.trim()) return res.status(400).json({ msg: "Subject is required" });
    if (!topic?.trim()) return res.status(400).json({ msg: "Topic is required" });

    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ msg: "AI service not configured" });

    console.log("🤖 By Topic Request:", { subject, topic, question_type, num_questions, difficulty });

    const payload = {
      subject: subject.trim(),
      topic: topic.trim(),
      question_type: question_type || "mcq",
      num_questions: parseInt(num_questions) || 5,
      difficulty: difficulty || "medium",
    };

    const response = await colabPost(`${COLAB_URL}/api/generate/by-topic`, payload, 600000);
    const parsed = safeParseColabResponse(response.data);

    if (!parsed.ok) {
      return res.status(503).json({
        msg: "AI service returned invalid response. Make sure all Colab cells are running.",
        preview: parsed.preview,
      });
    }

    if (response.status === 200) {
      return res.json({
        success: true,
        subject: parsed.data.subject,
        topic: parsed.data.topic,
        question_type: parsed.data.question_type,
        difficulty: parsed.data.difficulty,
        questions: parsed.data.questions,
        total_generated: parsed.data.total_generated,
        generation_time: parsed.data.generation_time,
      });
    }

    if (response.status === 400) return res.status(400).json({ msg: parsed.data.detail || "Invalid request" });
    if (response.status === 408) return res.status(408).json({ msg: "Generation timed out. Try fewer questions." });
    return res.status(500).json({ msg: "AI service error", details: parsed.data });

  } catch (err) {
    console.error("❌ By Topic error:", err.message);
    if (err.code === "ECONNABORTED") return res.status(408).json({ msg: "Request timeout. Try fewer questions." });
    if (err.code === "ECONNREFUSED") return res.status(503).json({ msg: "Cannot connect to AI service. Is Colab running?" });
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ============================================================
// POST /api/exams/content/upload
// ============================================================
router.post("/content/upload", async (req, res) => {
  try {
    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ msg: "AI service not configured" });

    if (!req.files?.file) return res.status(400).json({ msg: "No file uploaded" });

    const uploadedFile = req.files.file;
    const subject = req.body.subject || "General";
    const title = req.body.title || uploadedFile.name;

    console.log("📤 Uploading to Colab:", { name: uploadedFile.name, size: uploadedFile.size, subject, title });

    if (uploadedFile.size > 15_000_000) return res.status(413).json({ msg: "File too large (max 15MB)" });

    const formData = new FormData();
    formData.append("file", uploadedFile.data, {
      filename: uploadedFile.name,
      contentType: uploadedFile.mimetype,
    });
    formData.append("subject", subject.trim());
    formData.append("title", title);

    const response = await axios.post(`${COLAB_URL}/api/content/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "ProctoGrade-Backend/10.0",
      },
      timeout: 120000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
      httpsAgent,
    });

    console.log("📥 Upload response:", response.status, response.data);

    const parsed = safeParseColabResponse(response.data);
    if (!parsed.ok) return res.status(503).json({ msg: "AI service returned invalid response during upload.", preview: parsed.preview });

    if (response.status === 200 || response.status === 201) {
      return res.json({
        success: true,
        msg: "Content uploaded successfully",
        filename: parsed.data.filename,
        chunks_added: parsed.data.chunks_added || 0,
        total_chunks: parsed.data.total_chunks || 0,
      });
    }

    if (response.status === 400) return res.status(400).json({ msg: parsed.data.detail || "Invalid file" });
    return res.status(500).json({ msg: "Upload failed", details: parsed.data });

  } catch (err) {
    console.error("❌ Upload error:", err.message);
    if (err.code === "ECONNREFUSED") return res.status(503).json({ msg: "Cannot connect to AI service. Is Colab running?" });
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ============================================================
// ✅ POST /api/exams/generate/by-content  ← MAIN FIX
//    Uses colabPost() with keep-alive + TLS retry
// ============================================================
router.post("/generate/by-content", async (req, res) => {
  try {
    const { topic, subject, question_type, num_questions, difficulty } = req.body;

    if (!topic?.trim()) return res.status(400).json({ msg: "Topic is required" });

    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ msg: "AI service not configured" });

    console.log("🤖 By Content Request:", { topic, subject, question_type, num_questions, difficulty });

    const payload = {
      topic: topic.trim(),
      subject: subject?.trim() || "General",
      question_type: question_type || "mcq",
      num_questions: parseInt(num_questions) || 5,
      difficulty: difficulty || "medium",
    };

    // ✅ colabPost handles SSL errors and retries automatically
    const response = await colabPost(`${COLAB_URL}/api/generate/by-content`, payload, 600000);
    const parsed = safeParseColabResponse(response.data);

    if (!parsed.ok) {
      return res.status(503).json({
        msg: "AI service returned invalid response. Make sure all Colab cells are running.",
        preview: parsed.preview,
      });
    }

    if (response.status === 200) {
      return res.json({
        success: true,
        topic: parsed.data.topic,
        subject: parsed.data.subject,
        question_type: parsed.data.question_type,
        difficulty: parsed.data.difficulty,
        questions: parsed.data.questions,
        total_generated: parsed.data.total_generated,
        generation_time: parsed.data.generation_time,
        content_used: parsed.data.content_used,
      });
    }

    if (response.status === 400) {
      return res.status(400).json({ msg: parsed.data?.detail || "No content found. Please upload a file first." });
    }
    if (response.status === 408) return res.status(408).json({ msg: "Generation timed out. Try fewer questions." });
    return res.status(500).json({ msg: "AI service error", details: parsed.data });

  } catch (err) {
    console.error("❌ By Content error:", err.message);
    if (err.code === "ECONNABORTED") return res.status(408).json({ msg: "Request timeout. Try fewer questions." });
    if (err.code === "ECONNREFUSED") return res.status(503).json({ msg: "Cannot connect to AI service. Is Colab running?" });
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ============================================================
// GET /api/exams/ai-health
// ============================================================
router.get("/ai-health", async (req, res) => {
  try {
    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ status: "not_configured", msg: "COLAB_RAG_URL not set" });

    const response = await colabGet(`${COLAB_URL}/health`);
    const parsed = safeParseColabResponse(response.data);

    if (response.status === 200 && parsed.ok) {
      return res.json({ status: "connected", colab_url: COLAB_URL, ai_status: parsed.data });
    }
    return res.status(503).json({ status: "error", colab_url: COLAB_URL });
  } catch (err) {
    return res.status(503).json({ status: "unreachable", msg: "Cannot connect to AI service", error: err.message });
  }
});

// ============================================================
// POST /api/exams/save
// ============================================================
router.post("/save", async (req, res) => {
  try {
    const { classId, title, subject, questions, metadata } = req.body;

    if (!title || !classId || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ msg: "classId, title, and questions are required" });
    }

    const cleanedQuestions = questions.map((q) => ({
      text: q.text,
      type: q.type,
      options: q.options || null,
      answer: q.answer || null,
      teacher_answer: q.teacher_answer || q.answer || null,
    }));

    const exam = new Exam({
      classId,
      title,
      subject: subject || "General",
      questions: cleanedQuestions,
      status: "Draft",
      generatedFrom: metadata || {},
    });

    await exam.save();
    console.log("✅ Exam saved:", { id: exam._id, title: exam.title, questions: exam.questions.length });
    return res.status(201).json({ success: true, msg: "Exam saved successfully", examId: exam._id, exam });
  } catch (err) {
    console.error("❌ Save error:", err);
    return res.status(500).json({ msg: "Failed to save exam", error: err.message });
  }
});

// ============================================================
// EXISTING ENDPOINTS (unchanged)
// ============================================================

router.get("/my", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role classes");
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.role !== "examinee") return res.status(403).json({ msg: "Not a student" });

    const now = new Date();
    const exams = await Exam.find({ classId: { $in: user.classes }, endTime: { $gte: now } })
      .sort({ startTime: 1 })
      .lean();

    const result = exams.map((e) => ({ ...e, status: computeStatus(e, now), isUpcoming: e.startTime && new Date(e.startTime) > now }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/my-attempts", auth, async (req, res) => {
  try {
    const attempts = await ExamAttempt.find({ studentId: req.user.id })
      .select("examId classId submittedAt status totalScore maxScore percentage")
      .lean();
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/my-attempt", auth, async (req, res) => {
  try {
    const attempt = await ExamAttempt.findOne({ examId: req.params.id, studentId: req.user.id })
      .select("examId classId submittedAt status")
      .lean();
    res.json(attempt || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { classId } = req.query;
    const query = classId ? { classId } : {};
    const exams = await Exam.find(query).sort({ createdAt: -1 }).lean();
    const now = new Date();
    const mapped = exams.map((e) => ({ ...e, status: computeStatus(e, now) }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/active", async (req, res) => {
  try {
    const now = new Date();
    const exams = await Exam.find().lean();
    const active = exams.filter((e) => computeStatus(e, now) === "Active");
    res.json(active);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { classId, title, subject, questions, status } = req.body;
    if (!title || !classId || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ msg: "classId, title and questions are required" });
    }
    const exam = new Exam({ classId, title, subject, questions, status: status || "Draft" });
    await exam.save();
    return res.status(201).json({ msg: "Exam created", exam });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/schedule", async (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    if (!startTime || !endTime) return res.status(400).json({ msg: "startTime and endTime required" });

    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    exam.startTime = new Date(startTime);
    exam.endTime = new Date(endTime);
    exam.status = "Scheduled";
    await exam.save();
    return res.json({ msg: "Exam scheduled", exam });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/attempt", auth, async (req, res) => {
  try {
    const examId = req.params.id;
    const studentId = req.user.id;
    const { answers, classId } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ msg: "Answers array is required" });
    }

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    const existing = await ExamAttempt.findOne({ examId, studentId });
    if (existing) return res.status(400).json({ msg: "Already submitted this exam" });

    const gradingResult = await gradeAttempt(exam.questions, answers);
    if (!gradingResult?.gradedAnswers) return res.status(500).json({ msg: "Failed to grade exam" });

    const attempt = new ExamAttempt({
      examId,
      classId: classId || exam.classId,
      studentId,
      examTitle: exam.title,
      startedAt: new Date(),
      submittedAt: new Date(),
      status: "graded",
      answers: gradingResult.gradedAnswers,
      totalScore: gradingResult.totalScore || 0,
      maxScore: gradingResult.maxScore || 0,
      percentage: gradingResult.percentage || 0,
      gradedAt: new Date(),
      gradedBy: "auto",
    });

    await attempt.save();
    return res.status(201).json({ msg: "Exam submitted successfully", attemptId: attempt._id, submittedAt: attempt.submittedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/results/all", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== "instructor") return res.status(403).json({ msg: "Only instructors can view results" });

    const exam = await Exam.findById(req.params.id).lean();
    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    const attempts = await ExamAttempt.find({ examId: req.params.id })
      .populate("studentId", "name email")
      .sort({ percentage: -1 })
      .lean();

    const maxPossibleScore = (exam.questions?.length || 0) * 10;

    res.json({
      examId: exam._id,
      examTitle: exam.title,
      totalQuestions: exam.questions?.length || 0,
      maxPossibleScore,
      totalAttempts: attempts.length,
      students: attempts.map((a) => ({
        attemptId: a._id,
        studentId: a.studentId?._id,
        studentName: a.studentId?.name || "Unknown",
        studentEmail: a.studentId?.email || "",
        submittedAt: a.submittedAt,
        totalScore: a.totalScore,
        maxScore: a.maxScore,
        percentage: a.percentage,
        status: a.status,
      })),
      stats: {
        averageScore: attempts.length > 0 ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length) : 0,
        highestScore: attempts.length > 0 ? attempts[0].percentage : 0,
        lowestScore: attempts.length > 0 ? attempts[attempts.length - 1].percentage : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/attempt/:attemptId/detailed", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== "instructor") return res.status(403).json({ msg: "Only instructors can view detailed results" });

    const attempt = await ExamAttempt.findById(req.params.attemptId)
      .populate("studentId", "name email")
      .populate("examId", "title questions")
      .lean();

    if (!attempt) return res.status(404).json({ msg: "Attempt not found" });

    const breakdown = attempt.answers.map((ans, index) => {
      const question = attempt.examId.questions[index];
      let studentAnswerDisplay =
        ans.type === "mcq"
          ? question?.options?.[ans.selectedOptionIndex] || `Option ${ans.selectedOptionIndex + 1}`
          : ans.textAnswer || "(No answer)";

      return {
        questionNumber: index + 1,
        questionText: ans.questionText || question?.text || "",
        questionType: ans.type || question?.type || "mcq",
        studentAnswer: studentAnswerDisplay,
        correctAnswer: ans.correctAnswer || question?.teacher_answer || question?.answer || "",
        isCorrect: ans.isCorrect,
        pointsAwarded: ans.pointsAwarded,
        maxPoints: ans.maxPoints,
        justification: ans.aiGradingFeedback || (ans.isCorrect ? "✓ Correct" : "✗ Incorrect"),
        options: question?.options || null,
        selectedOptionIndex: ans.selectedOptionIndex,
      };
    });

    res.json({
      attemptId: attempt._id,
      student: { id: attempt.studentId?._id, name: attempt.studentId?.name || "Unknown", email: attempt.studentId?.email || "" },
      exam: { id: attempt.examId?._id, title: attempt.examTitle },
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt,
      summary: {
        totalScore: attempt.totalScore,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        totalQuestions: attempt.answers.length,
        correctAnswers: attempt.answers.filter((a) => a.isCorrect).length,
      },
      breakdown,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;