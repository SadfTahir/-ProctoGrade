// routes/exams.js
// ProctoGrade — ✅ UPDATED v15.1
// ✅ FIX: Draft exams ab students ko nazar nahi aayenge (GET /my route)
// ✅ NEW: /generate/teacher/by-topic    → Version A + B (by topic)
// ✅ NEW: /generate/teacher/by-content  → Version A + B (by content, async job)
// ✅ NEW: /generate/practice            → 1 version for student practice

const express     = require("express");
const Exam        = require("../models/Exam");
const User        = require("../models/User");
const ExamAttempt = require("../models/ExamAttempt");
const auth        = require("../middleware/auth");
const { gradeAttempt, gradeSelfLearning } = require("../utils/gradingService");
const axios       = require("axios");
const FormData    = require("form-data");
const https       = require("https");
const http        = require("http");
const router      = express.Router();

// ============================================================
// SSL AGENTS
// ============================================================
const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false, timeout: 0, maxSockets: 10 });
const httpAgent  = new http.Agent({ keepAlive: false, timeout: 0, maxSockets: 10 });

const COLAB_HEADERS = {
  "Content-Type"              : "application/json",
  "ngrok-skip-browser-warning": "true",
  "User-Agent"                : "ProctoGrade-Backend/15.1",
  "Connection"                : "close",
};

console.log("✅ exams routes loaded v15.1");

// ============================================================
// HELPERS
// ============================================================
function computeStatus(e, now) {
  let computedStatus = e.status || "Draft";
  if (e.startTime && e.endTime) {
    const start = new Date(e.startTime);
    const end   = new Date(e.endTime);
    if (now < start)                     computedStatus = "Scheduled";
    else if (now >= start && now <= end) computedStatus = "Active";
    else if (now > end)                  computedStatus = "Closed";
  }
  return computedStatus;
}

// ⏱️ Gimi Helper: Calculate exact minutes between two datetimes
function calculateDurationMinutes(start, end) {
  if (!start || !end) return 30; // default fallback if times are missing
  const diffMs = new Date(end) - new Date(start);
  const minutes = Math.floor(diffMs / (1000 * 60));
  return minutes > 0 ? minutes : 30; // Negative or 0 value default to 30 mins
}

function getAIServiceURL() {
  let url = process.env.COLAB_RAG_URL;
  if (!url) { console.error("❌ COLAB_RAG_URL not set in .env"); return null; }
  url = url.trim().replace(/\/$/, "");
  if (url.startsWith("http://")) {
    url = "https://" + url.slice(7);
    console.warn("⚠️  Auto-fixed URL to https:", url);
  }
  return url;
}

function safeParseColabResponse(rawData) {
  if (typeof rawData === "object" && rawData !== null) return { ok: true, data: rawData };
  try { return { ok: true, data: JSON.parse(rawData) }; }
  catch {
    const preview = String(rawData).slice(0, 300);
    console.error("❌ Non-JSON from Colab:", preview);
    return { ok: false, preview };
  }
}

async function colabPost(url, payload, timeoutMs = 30000) {
  const freshAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false, timeout: 0, maxSockets: 1 });
  console.log(`📡 POST ${url}`);
  const response = await axios.post(url, payload, {
    timeout: timeoutMs, headers: COLAB_HEADERS,
    validateStatus: () => true, httpsAgent: freshAgent, httpAgent,
    maxRedirects: 5, decompress: true,
  });
  console.log(`📥 Response: ${response.status}`);
  return response;
}

async function colabGet(url, timeoutMs = 15000) {
  const freshAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
  return await axios.get(url, {
    timeout: timeoutMs, headers: { ...COLAB_HEADERS },
    validateStatus: () => true, httpsAgent: freshAgent,
  });
}

async function pollJobUntilDone(colabUrl, jobId, maxWaitMs = 600000) {
  const pollUrl      = `${colabUrl}/api/job/${jobId}`;
  const pollInterval = 5000;
  const maxPolls     = Math.floor(maxWaitMs / pollInterval);

  console.log(`🔄 Polling job ${jobId.slice(0, 8)}...`);

  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, pollInterval));
    try {
      const response = await colabGet(pollUrl);
      if (response.status === 404) throw new Error(`Job ${jobId} not found on Colab`);
      const parsed = safeParseColabResponse(response.data);
      if (!parsed.ok) continue;
      const job = parsed.data;
      console.log(`📊 Poll ${i + 1}: status=${job.status}`);
      if (job.status === "done")  return { success: true, data: job.result };
      if (job.status === "error") throw new Error(job.error || "Job failed on Colab");
    } catch (err) {
      console.warn(`⚠️  Poll ${i + 1} failed: ${err.message}`);
    }
  }
  throw new Error("Job timed out after 10 minutes");
}

// ============================================================
// GET /api/exams/subjects
// ============================================================
router.get("/subjects", async (req, res) => {
  try {
    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ msg: "AI service not configured" });
    const response = await colabGet(`${COLAB_URL}/api/subjects`);
    const parsed   = safeParseColabResponse(response.data);
    if (!parsed.ok) return res.status(503).json({ msg: "Invalid response from AI service" });
    return res.json(parsed.data);
  } catch (err) {
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
    const subject  = encodeURIComponent(req.params.subject);
    const response = await colabGet(`${COLAB_URL}/api/subjects/${subject}/topics`);
    if (response.status === 404) return res.status(404).json({ msg: "Subject not found" });
    const parsed = safeParseColabResponse(response.data);
    if (!parsed.ok) return res.status(503).json({ msg: "Invalid response from AI service" });
    return res.json(parsed.data);
  } catch (err) {
    return res.status(500).json({ msg: "Failed to fetch topics", error: err.message });
  }
});

// ============================================================
// ✅ NEW: POST /api/exams/generate/teacher/by-topic
// Teacher: Version A + B (synchronous)
// ============================================================
router.post("/generate/teacher/by-topic", auth, async (req, res) => {
  try {
    const { subject, topic, question_type, num_questions, difficulty } = req.body;

    if (!subject?.trim()) return res.status(400).json({ msg: "Subject is required" });
    if (!topic?.trim())   return res.status(400).json({ msg: "Topic is required" });

    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ msg: "AI service not configured" });

    console.log("🤖 Teacher By Topic (Dual Version):", { subject, topic, question_type, num_questions, difficulty });

    const payload = {
      subject      : subject.trim(),
      topic        : topic.trim(),
      question_type: question_type || "mcq",
      num_questions: parseInt(num_questions) || 5,
      difficulty   : difficulty || "medium",
    };

    // Longer timeout for dual generation (2x questions + model answers)
    const response = await colabPost(`${COLAB_URL}/api/generate/teacher/by-topic`, payload, 700000);
    const parsed   = safeParseColabResponse(response.data);

    if (!parsed.ok) return res.status(503).json({ msg: "AI service returned invalid response.", preview: parsed.preview });

    if (response.status === 200) {
      const d = parsed.data;
      console.log(`✅ Dual Version: A=${d.version_a?.length}Q B=${d.version_b?.length}Q in ${d.generation_time}s`);
      return res.json({
        success           : true,
        subject           : d.subject,
        topic             : d.topic,
        question_type     : d.question_type,
        difficulty        : d.difficulty,
        version_a         : d.version_a,
        version_b         : d.version_b,
        total_per_version : d.total_per_version,
        generation_time   : d.generation_time,
        message           : d.message,
      });
    }

    if (response.status === 400) return res.status(400).json({ msg: parsed.data.detail || "Invalid request" });
    if (response.status === 408) return res.status(408).json({ msg: "Generation timed out." });
    return res.status(500).json({ msg: "AI service error", details: parsed.data });

  } catch (err) {
    console.error("❌ Teacher By Topic error:", err.message);
    if (err.code === "ECONNABORTED") return res.status(408).json({ msg: "Request timeout." });
    if (err.code === "ECONNREFUSED") return res.status(503).json({ msg: "Cannot connect to AI service." });
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ============================================================
// ✅ NEW: POST /api/exams/generate/teacher/by-content
// Teacher: Version A + B from uploaded content (async job)
// ============================================================
router.post("/generate/teacher/by-content", auth, async (req, res) => {
  try {
    const { topic, subject, question_type, num_questions, difficulty } = req.body;

    if (!topic?.trim()) return res.status(400).json({ msg: "Topic is required" });

    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ msg: "AI service not configured" });

    const payload = {
      topic        : topic.trim(),
      subject      : subject?.trim() || "General",
      question_type: question_type || "mcq",
      num_questions: parseInt(num_questions) || 5,
      difficulty   : difficulty || "medium",
    };

    // Start async job on Colab
    const startResponse = await colabPost(`${COLAB_URL}/api/generate/teacher/by-content`, payload, 30000);
    const startParsed   = safeParseColabResponse(startResponse.data);

    if (!startParsed.ok || startResponse.status !== 200) {
      return res.status(503).json({ msg: "Failed to start generation job.", preview: startParsed.preview });
    }

    const jobId = startParsed.data.job_id;
    if (!jobId) return res.status(503).json({ msg: "No job_id returned from Colab." });

    // Poll until done
    const jobResult = await pollJobUntilDone(COLAB_URL, jobId, 700000);

    if (!jobResult.success || !jobResult.data) {
      return res.status(500).json({ msg: "Job completed but no result returned." });
    }

    const result = jobResult.data;
    console.log(`✅ Teacher By Content: A=${result.version_a?.length}Q B=${result.version_b?.length}Q`);

    return res.json({
      success           : true,
      topic             : result.topic,
      subject           : result.subject,
      question_type     : result.question_type,
      difficulty        : result.difficulty,
      version_a         : result.version_a,
      version_b         : result.version_b,
      total_per_version : result.total_per_version,
      generation_time   : result.generation_time,
      content_used      : result.content_used,
      message           : result.message,
    });

  } catch (err) {
    console.error("❌ Teacher By Content error:", err.message);
    if (err.message?.includes("timed out")) return res.status(408).json({ msg: "Generation timed out." });
    if (err.code === "ECONNREFUSED")         return res.status(503).json({ msg: "Cannot connect to AI service." });
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ============================================================
// ✅ NEW: POST /api/exams/generate/practice
// Student Practice Mode — 1 version, Groq→Qwen fallback
// ============================================================
router.post("/generate/practice", auth, async (req, res) => {
  try {
    const { subject, topic, question_type, num_questions, difficulty } = req.body;

    if (!subject?.trim()) return res.status(400).json({ msg: "Subject is required" });
    if (!topic?.trim())   return res.status(400).json({ msg: "Topic is required" });

    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ msg: "AI service not configured" });

    const payload = {
      subject      : subject.trim(),
      topic        : topic.trim(),
      question_type: question_type || "mcq",
      num_questions: parseInt(num_questions) || 5,
      difficulty   : difficulty || "medium",
    };

    console.log("📚 Practice Mode Request:", payload);

    const response = await colabPost(`${COLAB_URL}/api/generate/practice`, payload, 600000);
    const parsed   = safeParseColabResponse(response.data);

    if (!parsed.ok) return res.status(503).json({ msg: "AI service returned invalid response.", preview: parsed.preview });

    if (response.status === 200) {
      const d = parsed.data;
      console.log(`✅ Practice: ${d.questions?.length}Q generated`);
      return res.json({
        success        : true,
        subject        : d.subject,
        topic          : d.topic,
        question_type  : d.question_type,
        difficulty     : d.difficulty,
        questions      : d.questions,
        total_generated: d.total_generated,
        generation_time: d.generation_time,
        message        : d.message,
      });
    }

    if (response.status === 400) return res.status(400).json({ msg: parsed.data.detail || "Invalid request" });
    if (response.status === 408) return res.status(408).json({ msg: "Generation timed out." });
    return res.status(500).json({ msg: "AI service error", details: parsed.data });

  } catch (err) {
    console.error("❌ Practice generation error:", err.message);
    if (err.code === "ECONNABORTED") return res.status(408).json({ msg: "Request timeout." });
    if (err.code === "ECONNREFUSED") return res.status(503).json({ msg: "Cannot connect to AI service." });
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ============================================================
// POST /api/exams/generate/by-topic  (kept for compatibility)
// ============================================================
router.post("/generate/by-topic", async (req, res) => {
  try {
    const { subject, topic, question_type, num_questions, difficulty } = req.body;
    if (!subject?.trim()) return res.status(400).json({ msg: "Subject is required" });
    if (!topic?.trim())   return res.status(400).json({ msg: "Topic is required" });
    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ msg: "AI service not configured" });
    const payload  = { subject: subject.trim(), topic: topic.trim(), question_type: question_type || "mcq", num_questions: parseInt(num_questions) || 5, difficulty: difficulty || "medium" };
    const response = await colabPost(`${COLAB_URL}/api/generate/by-topic`, payload, 300000);
    const parsed   = safeParseColabResponse(response.data);
    if (!parsed.ok) return res.status(503).json({ msg: "AI service returned invalid response." });
    if (response.status === 200) return res.json({ success: true, ...parsed.data });
    return res.status(response.status).json({ msg: parsed.data.detail || "AI service error" });
  } catch (err) {
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ============================================================
// POST /api/exams/generate/with-answers  (kept for compatibility)
// ============================================================
router.post("/generate/with-answers", async (req, res) => {
  try {
    const { subject, topic, question_type, num_questions, difficulty } = req.body;
    if (!subject?.trim()) return res.status(400).json({ msg: "Subject is required" });
    if (!topic?.trim())   return res.status(400).json({ msg: "Topic is required" });
    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ msg: "AI service not configured" });
    const payload  = { subject: subject.trim(), topic: topic.trim(), question_type: question_type || "mixed", num_questions: parseInt(num_questions) || 5, difficulty: difficulty || "medium" };
    const response = await colabPost(`${COLAB_URL}/api/generate/with-answers`, payload, 600000);
    const parsed   = safeParseColabResponse(response.data);
    if (!parsed.ok) return res.status(503).json({ msg: "AI service returned invalid response." });
    if (response.status === 200) return res.json({ success: true, ...parsed.data });
    return res.status(response.status).json({ msg: parsed.data.detail || "AI service error" });
  } catch (err) {
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
    const subject      = req.body.subject || "General";
    const title        = req.body.title   || uploadedFile.name;
    if (uploadedFile.size > 15_000_000) return res.status(413).json({ msg: "File too large (max 15MB)" });

    const formData = new FormData();
    formData.append("file", uploadedFile.data, { filename: uploadedFile.name, contentType: uploadedFile.mimetype });
    formData.append("subject", subject.trim());
    formData.append("title", title);

    const freshAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });
    const response   = await axios.post(`${COLAB_URL}/api/content/upload`, formData, {
      headers: { ...formData.getHeaders(), "ngrok-skip-browser-warning": "true", "User-Agent": "ProctoGrade-Backend/15.1", "Connection": "close" },
      timeout: 120000, maxBodyLength: Infinity, maxContentLength: Infinity,
      validateStatus: () => true, httpsAgent: freshAgent,
    });

    const parsed = safeParseColabResponse(response.data);
    if (!parsed.ok) return res.status(503).json({ msg: "Invalid response during upload." });
    if (response.status === 200 || response.status === 201) {
      return res.json({ success: true, msg: "Content uploaded successfully", filename: parsed.data.filename, chunks_added: parsed.data.chunks_added || 0, total_chunks: parsed.data.total_chunks || 0 });
    }
    return res.status(500).json({ msg: "Upload failed", details: parsed.data });
  } catch (err) {
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ============================================================
// POST /api/exams/generate/by-content  (kept for compatibility)
// ============================================================
router.post("/generate/by-content", async (req, res) => {
  try {
    const { topic, subject, question_type, num_questions, difficulty } = req.body;
    if (!topic?.trim()) return res.status(400).json({ msg: "Topic is required" });
    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ msg: "AI service not configured" });
    const payload       = { topic: topic.trim(), subject: subject?.trim() || "General", question_type: question_type || "mcq", num_questions: parseInt(num_questions) || 5, difficulty: difficulty || "medium" };
    const startResponse = await colabPost(`${COLAB_URL}/api/generate/by-content`, payload, 30000);
    const startParsed   = safeParseColabResponse(startResponse.data);
    if (!startParsed.ok || startResponse.status !== 200) return res.status(503).json({ msg: "Failed to start generation job." });
    const jobId = startParsed.data.job_id;
    if (!jobId) return res.status(503).json({ msg: "No job_id returned from Colab." });
    const jobResult = await pollJobUntilDone(COLAB_URL, jobId, 600000);
    if (!jobResult.success || !jobResult.data) return res.status(500).json({ msg: "Job completed but no result." });
    return res.json({ success: true, ...jobResult.data });
  } catch (err) {
    if (err.message?.includes("timed out")) return res.status(408).json({ msg: "Generation timed out." });
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ============================================================
// GET /api/exams/ai-health
// ============================================================
router.get("/ai-health", async (req, res) => {
  try {
    const COLAB_URL = getAIServiceURL();
    if (!COLAB_URL) return res.status(503).json({ status: "not_configured" });
    const response = await colabGet(`${COLAB_URL}/health`);
    const parsed   = safeParseColabResponse(response.data);
    if (response.status === 200 && parsed.ok) return res.json({ status: "connected", colab_url: COLAB_URL, ai_status: parsed.data });
    return res.status(503).json({ status: "error", colab_url: COLAB_URL });
  } catch (err) {
    return res.status(503).json({ status: "unreachable", error: err.message });
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
      text          : q.text,
      type          : q.type,
      options       : q.options        || null,
      answer        : q.answer         || null,
      teacher_answer: q.model_answer   || q.teacher_answer || q.answer || null,
      model_answer  : q.model_answer   || null,
      key_concepts  : q.key_concepts   || [],
      marking_guide : q.marking_guide  || null,
      max_marks     : parseFloat(q.max_marks) || 10.0,
      language      : q.language       || null,
    }));
    const exam = new Exam({ classId, title, subject: subject || "General", questions: cleanedQuestions, status: "Draft", generatedFrom: metadata || {} });
    await exam.save();
    console.log("✅ Exam saved:", { id: exam._id, title: exam.title, questions: exam.questions.length, version: metadata?.version || "N/A" });
    return res.status(201).json({ success: true, msg: "Exam saved successfully", examId: exam._id, exam });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to save exam", error: err.message });
  }
});

// ============================================================
// POST /api/exams/self-learning/grade
// ============================================================
router.post("/self-learning/grade", auth, async (req, res) => {
  try {
    const { questions, studentAnswers, subject, context } = req.body;
    if (!Array.isArray(questions) || questions.length === 0)     return res.status(400).json({ msg: "questions array is required" });
    if (!Array.isArray(studentAnswers) || studentAnswers.length === 0) return res.status(400).json({ msg: "studentAnswers array is required" });
    if (questions.length !== studentAnswers.length) return res.status(400).json({ msg: `Mismatch: ${questions.length} questions but ${studentAnswers.length} answers` });
    const result = await gradeSelfLearning(questions, studentAnswers, subject || "General", context || "");
    if (!result) return res.status(500).json({ msg: "Grading failed" });
    return res.json({ success: true, gradedAnswers: result.gradedAnswers, totalMarks: result.totalMarks, obtainedMarks: result.obtainedMarks, percentage: result.percentage, gradeLetter: result.gradeLetter, summary: result.summary, gradedAt: result.gradedAt });
  } catch (err) {
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ============================================================
// EXAM MANAGEMENT ROUTES
// ============================================================

// ✅ FIX: GET /api/exams/my — Draft exams HIDE kiye students se

router.get("/my", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role classes");
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.role !== "examinee") return res.status(403).json({ msg: "Not a student" });
    const now   = new Date();
    const exams = await Exam.find({
      classId: { $in: user.classes },
      endTime: { $gte: now },
      status: { $nin: ["Draft"] }, 
    }).sort({ startTime: 1 }).lean();
    
    res.json(exams.map((e) => {
      // Calculate real difference between Start and End time
      const dynamicDuration = calculateDurationMinutes(e.startTime, e.endTime);
      return { 
        ...e, 
        status: computeStatus(e, now), 
        duration: dynamicDuration, // ✅ Student screen will dynamically read this
        isUpcoming: e.startTime && new Date(e.startTime) > now 
      };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/my-attempts", auth, async (req, res) => {
  try {
    const attempts = await ExamAttempt.find({ studentId: req.user.id }).select("examId classId submittedAt status totalScore maxScore percentage").lean();
    res.json(attempts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id/my-attempt", auth, async (req, res) => {
  try {
    const attempt = await ExamAttempt.findOne({ examId: req.params.id, studentId: req.user.id }).select("examId classId submittedAt status").lean();
    res.json(attempt || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/exams/ — General list
// Auth optional: students ke liye Draft hide, teachers/unauthenticated ke liye sab
router.get("/", async (req, res) => {
  try {
    const { classId } = req.query;
    const query = classId ? { classId } : {};

    // Token check karo — agar student hai to Draft hide karo
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("role");
        if (user?.role === "examinee") {
          query.status = { $nin: ["Draft"] }; // ✅ students se Draft hide
        }
      } catch (_) { /* invalid token — sab dikhao */ }
    }

    const exams = await Exam.find(query).sort({ createdAt: -1 }).lean();
    const now   = new Date();
    res.json(exams.map((e) => ({ ...e, status: computeStatus(e, now) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/active", async (req, res) => {
  try {
    const now   = new Date();
    const exams = await Exam.find().lean();
    res.json(exams.filter((e) => computeStatus(e, now) === "Active"));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  try {
    const { classId, title, subject, questions, status } = req.body;
    if (!title || !classId || !Array.isArray(questions) || questions.length === 0) return res.status(400).json({ msg: "classId, title and questions are required" });
    const exam = new Exam({ classId, title, subject, questions, status: status || "Draft" });
    await exam.save();
    return res.status(201).json({ msg: "Exam created", exam });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ⏱️ Automatically calculates dynamic duration during schedule
router.patch("/:id/schedule", async (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    if (!startTime || !endTime) return res.status(400).json({ msg: "startTime and endTime required" });
    
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });
    
    // Calculate difference in minutes
    const durationMinutes = calculateDurationMinutes(startTime, endTime);

    exam.startTime = new Date(startTime); 
    exam.endTime = new Date(endTime); 
    exam.status = "Scheduled";
    exam.duration = durationMinutes; // ✅ Save dynamic duration (minutes) in DB
    
    await exam.save();
    console.log(`⏱️ Exam Scheduled: Total duration saved as ${durationMinutes} minutes.`);
    return res.json({ msg: "Exam scheduled", exam });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/attempt", auth, async (req, res) => {
  try {
    const examId    = req.params.id;
    const studentId = req.user.id;
    const { answers, classId } = req.body;
    if (!Array.isArray(answers) || answers.length === 0) return res.status(400).json({ msg: "Answers array is required" });
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });
    const existing = await ExamAttempt.findOne({ examId, studentId });
    if (existing) return res.status(400).json({ msg: "Already submitted this exam" });
    const gradingResult = await gradeAttempt(exam.questions, answers);
    if (!gradingResult?.gradedAnswers) return res.status(500).json({ msg: "Failed to grade exam" });
    const attempt = new ExamAttempt({ examId, classId: classId || exam.classId, studentId, examTitle: exam.title, startedAt: new Date(), submittedAt: new Date(), status: "graded", answers: gradingResult.gradedAnswers, totalScore: gradingResult.totalScore || 0, maxScore: gradingResult.maxScore || 0, percentage: gradingResult.percentage || 0, gradedAt: new Date(), gradedBy: "auto" });
    await attempt.save();
    return res.status(201).json({ msg: "Exam submitted successfully", attemptId: attempt._id, submittedAt: attempt.submittedAt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id/results/all", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== "instructor") return res.status(403).json({ msg: "Only instructors can view results" });
    const exam = await Exam.findById(req.params.id).lean();
    if (!exam) return res.status(404).json({ msg: "Exam not found" });
    const attempts = await ExamAttempt.find({ examId: req.params.id }).populate("studentId", "name email").sort({ percentage: -1 }).lean();
    const maxPossibleScore = exam.questions?.reduce((sum, q) => sum + (q.max_marks || 10), 0) || 0;
    res.json({ examId: exam._id, examTitle: exam.title, questions: exam.questions || [], totalQuestions: exam.questions?.length || 0, maxPossibleScore, totalAttempts: attempts.length, students: attempts.map((a) => ({ attemptId: a._id, studentId: a.studentId?._id, studentName: a.studentId?.name || "Unknown", studentEmail: a.studentId?.email || "", submittedAt: a.submittedAt, totalScore: a.totalScore, maxScore: a.maxScore, percentage: a.percentage, status: a.status })), stats: { averageScore: attempts.length > 0 ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length) : 0, highestScore: attempts.length > 0 ? attempts[0].percentage : 0, lowestScore: attempts.length > 0 ? attempts[attempts.length - 1].percentage : 0 } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/attempt/:attemptId/detailed", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== "instructor") return res.status(403).json({ msg: "Only instructors can view detailed results" });
    const attempt = await ExamAttempt.findById(req.params.attemptId).populate("studentId", "name email").populate("examId", "title questions").lean();
    if (!attempt) return res.status(404).json({ msg: "Attempt not found" });
    const breakdown = attempt.answers.map((ans, index) => {
      const question = attempt.examId.questions[index];
      const studentAnswerDisplay = ans.type === "mcq" ? question?.options?.[ans.selectedOptionIndex] || `Option ${ans.selectedOptionIndex + 1}` : ans.textAnswer || "(No answer)";
      return { questionNumber: index + 1, questionText: ans.questionText || question?.text || "", questionType: ans.type || question?.type || "mcq", studentAnswer: studentAnswerDisplay, correctAnswer: ans.correctAnswer || question?.teacher_answer || question?.answer || "", isCorrect: ans.isCorrect, pointsAwarded: ans.pointsAwarded, maxPoints: ans.maxPoints || question?.max_marks || 10, justification: ans.aiGradingFeedback || (ans.isCorrect ? "✓ Correct" : "✗ Incorrect"), options: question?.options || null, selectedOptionIndex: ans.selectedOptionIndex };
    });
    res.json({ attemptId: attempt._id, student: { id: attempt.studentId?._id, name: attempt.studentId?.name || "Unknown", email: attempt.studentId?.email || "" }, exam: { id: attempt.examId?._id, title: attempt.examTitle }, submittedAt: attempt.submittedAt, gradedAt: attempt.gradedAt, summary: { totalScore: attempt.totalScore, maxScore: attempt.maxScore, percentage: attempt.percentage, totalQuestions: attempt.answers.length, correctAnswers: attempt.answers.filter((a) => a.isCorrect).length }, breakdown });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/rubric", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== "instructor") return res.status(403).json({ msg: "Only instructors can define rubrics" });
    const { exam_id, rubrics } = req.body;
    if (!exam_id) return res.status(400).json({ msg: "exam_id is required" });
    if (!Array.isArray(rubrics) || rubrics.length === 0) return res.status(400).json({ msg: "rubrics array is required" });
    const exam = await Exam.findById(exam_id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });
    let savedCount = 0;
    for (const rubric of rubrics) {
      const { question_index, criteria, total_marks } = rubric;
      if (question_index === undefined || !Array.isArray(criteria)) continue;
      if (!exam.questions[question_index]) continue;
      const weightSum = criteria.reduce((s, c) => s + (parseFloat(c.weight) || 0), 0);
      if (Math.abs(weightSum - 1.0) > 0.05) return res.status(400).json({ msg: `Q${question_index + 1}: weights sum to ${weightSum.toFixed(2)} — must equal 1.0` });
      exam.questions[question_index].rubric = { criteria: criteria.map(c => ({ name: c.name || "", description: c.description || "", max_marks: parseFloat(c.max_marks) || 0, weight: parseFloat(c.weight) || 0 })), total_marks: parseFloat(total_marks) || exam.questions[question_index].max_marks || 10 };
      if (total_marks) exam.questions[question_index].max_marks = parseFloat(total_marks);
      savedCount++;
    }
    exam.markModified("questions");
    await exam.save();
    return res.json({ success: true, msg: `Rubric saved for ${savedCount} question(s)`, rubrics_saved: savedCount });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to save rubric", error: err.message });
  }
});

router.post("/rubric/suggest", auth, async (req, res) => {
  try {
    const { question_text, max_marks, subject } = req.body;
    if (!question_text?.trim()) return res.status(400).json({ msg: "question_text is required" });
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (GROQ_API_KEY) {
      try {
        const payload = { model: "llama-3.1-8b-instant", max_tokens: 600, temperature: 0.3, messages: [{ role: "system", content: "You are a university professor. Return ONLY valid JSON." }, { role: "user", content: `Suggest a grading rubric for this ${subject || "General"} question.\nQUESTION: ${question_text}\nMAX MARKS: ${max_marks || 10}\nReturn ONLY: {"suggested": [{"name": "...","description": "...","max_marks": 4,"weight": 0.4}],"total_marks": ${max_marks || 10}}` }] };
        const resp = await axios.post("https://api.groq.com/openai/v1/chat/completions", payload, { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` }, timeout: 15000, validateStatus: () => true });
        if (resp.status === 200) {
          const text = resp.data?.choices?.[0]?.message?.content || "";
          const clean = text.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
          const s = clean.indexOf("{"), e = clean.lastIndexOf("}") + 1;
          if (s !== -1 && e > s) {
            const data = JSON.parse(clean.slice(s, e));
            if (data.suggested?.length > 0) return res.json({ success: true, suggested: data.suggested, total_marks: data.total_marks || max_marks || 10 });
          }
        }
      } catch (groqErr) { console.warn("⚠️ Groq rubric suggest failed:", groqErr.message); }
    }
    const total = parseFloat(max_marks) || 10;
    return res.json({ success: true, suggested: [{ name: "Conceptual Understanding", description: "Core concept correctly explained", max_marks: parseFloat((total * 0.4).toFixed(1)), weight: 0.4 }, { name: "Examples / Application", description: "Relevant examples or application", max_marks: parseFloat((total * 0.3).toFixed(1)), weight: 0.3 }, { name: "Clarity & Structure", description: "Answer is clear and well-structured", max_marks: parseFloat((total * 0.3).toFixed(1)), weight: 0.3 }], total_marks: total, note: "AI unavailable — default template used" });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to suggest rubric", error: err.message });
  }
});

module.exports = router;