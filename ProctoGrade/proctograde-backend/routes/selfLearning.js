// routes/selfLearning.js
// ProctoGrade — ✅ UPDATED v3.0
// ✅ /start now calls /api/exams/generate/practice (Groq→Qwen fallback, 1 version)
// ✅ /submit unchanged (uses gradeSelfLearning)

const express  = require("express");
const axios    = require("axios");
const https    = require("https");
const auth     = require("../middleware/auth");
const SelfLearningAttempt = require("../models/SelfLearningAttempt");
const { gradeSelfLearning } = require("../utils/gradingService");

const router     = express.Router();
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

console.log("✅ self-learning routes loaded v3.0");

// ============================================================
// HELPER
// ============================================================
function getAIServiceURL() {
  const url = process.env.COLAB_RAG_URL;
  if (!url) { console.error("❌ COLAB_RAG_URL not set in .env"); return null; }
  return url.replace(/\/$/, "");
}

const COLAB_HEADERS = {
  "Content-Type"              : "application/json",
  "ngrok-skip-browser-warning": "true",
  "User-Agent"                : "ProctoGrade-Backend/15.0",
};

// ============================================================
// POST /api/self-learning/start
// ✅ Now uses /api/generate/practice → Groq→Qwen fallback, 1 version
// ============================================================
router.post("/start", auth, async (req, res) => {
  try {
    const {
      topic,
      subject      = "General",
      contentType  = "mixed",
      numQuestions = 5,
      difficulty   = "medium",
      questions,   // pre-generated questions from frontend (optional)
    } = req.body;

    if (!topic || topic.trim() === "") {
      return res.status(400).json({ msg: "Topic is required" });
    }

    let finalQuestions = [];

    // ✅ Use pre-generated questions from frontend if available
    if (questions && Array.isArray(questions) && questions.length > 0) {
      console.log("✅ Using pre-generated questions from frontend:", questions.length);
      finalQuestions = questions;

    } else {
      // ✅ Generate via practice endpoint (Groq→Qwen fallback, 1 version)
      console.log("📚 Generating practice questions via AI...");

      const COLAB_URL = getAIServiceURL();
      if (!COLAB_URL) return res.status(500).json({ msg: "AI service not configured" });

      // First try the backend's own practice route (which goes to Colab)
      try {
        const practiceRes = await axios.post(
          `${COLAB_URL}/api/generate/practice`,
          {
            subject      : subject,
            topic        : topic,
            question_type: contentType,
            num_questions: parseInt(numQuestions) || 5,
            difficulty   : difficulty,
          },
          {
            headers      : { ...COLAB_HEADERS },
            timeout      : 600000,
            validateStatus: () => true,
            httpsAgent,
          }
        );

        if (practiceRes.status === 200 && practiceRes.data?.questions?.length > 0) {
          finalQuestions = practiceRes.data.questions;
          console.log(`✅ Practice questions generated: ${finalQuestions.length}`);
        } else {
          throw new Error(`Practice endpoint returned ${practiceRes.status}`);
        }

      } catch (aiError) {
        console.error("❌ Practice generation failed:", aiError.message);
        return res.status(500).json({ error: "Failed to generate practice questions", details: aiError.message });
      }
    }

    if (!finalQuestions || finalQuestions.length === 0) {
      return res.status(400).json({ msg: "No questions available. Please try again." });
    }

    // Save attempt to DB
    const attempt = new SelfLearningAttempt({
      studentId     : req.user.id,
      topic         : topic.trim(),
      subject,
      contentType,
      questions     : finalQuestions,
      totalQuestions: finalQuestions.length,
      status        : "in-progress",
    });

    await attempt.save();
    console.log("✅ Practice attempt saved:", attempt._id);

    // Send questions WITHOUT model answers to student
    // MCQ: answer shown (student needs it to understand options)
    // Short: answer hidden (student should answer from memory)
    const questionsForStudent = finalQuestions.map((q, index) => ({
      id     : index.toString(),
      text   : q.text,
      type   : q.type,
      options: q.options || null,
      // MCQ answer shown so student can select; short answer hidden
      answer : q.type === "mcq" ? q.answer : undefined,
    }));

    res.json({
      msg           : "Practice session started",
      attemptId     : attempt._id,
      topic         : attempt.topic,
      subject       : attempt.subject,
      totalQuestions: finalQuestions.length,
      questions     : questionsForStudent,
    });

  } catch (err) {
    console.error("❌ Error starting self-learning:", err.message);
    res.status(500).json({ error: err.message || "Failed to start practice session" });
  }
});

// ============================================================
// POST /api/self-learning/submit/:attemptId
// ✅ Uses gradeSelfLearning (AI model answers + 3-layer grading)
// ============================================================
router.post("/submit/:attemptId", auth, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { answers }   = req.body;
    const studentId     = req.user.id;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ msg: "Answers are required" });
    }

    const attempt = await SelfLearningAttempt.findById(attemptId);
    if (!attempt)                                              return res.status(404).json({ msg: "Practice session not found" });
    if (attempt.studentId.toString() !== studentId)           return res.status(403).json({ msg: "Unauthorized" });
    if (attempt.status === "completed")                        return res.status(400).json({ msg: "Session already completed" });
    if (!attempt.questions || attempt.questions.length === 0) return res.status(500).json({ msg: "Invalid attempt - no questions found" });

    console.log("📤 Grading practice session via AI...");

    const gradingResult = await gradeSelfLearning(
      attempt.questions,
      answers,
      attempt.subject || "General",
      ""
    );

    if (!gradingResult || !gradingResult.gradedAnswers) {
      return res.status(500).json({ msg: "Failed to grade session" });
    }

    // Save results
    attempt.answers        = gradingResult.gradedAnswers;
    attempt.completedAt    = new Date();
    attempt.status         = "completed";
    attempt.score          = gradingResult.percentage;
    attempt.totalScore     = gradingResult.obtainedMarks;
    attempt.maxScore       = gradingResult.totalMarks;
    attempt.correctAnswers = gradingResult.gradedAnswers.filter(a => a.isCorrect).length;

    await attempt.save();

    console.log("✅ Practice results saved:", { percentage: gradingResult.percentage, grade: gradingResult.gradeLetter });

    res.json({
      msg           : "Practice session completed",
      attemptId     : attempt._id,
      score         : gradingResult.percentage,
      gradeLetter   : gradingResult.gradeLetter,
      summary       : gradingResult.summary,
      obtainedMarks : gradingResult.obtainedMarks,
      totalMarks    : gradingResult.totalMarks,
      totalQuestions: attempt.totalQuestions,
      answers       : gradingResult.gradedAnswers.map((ans) => ({
        questionNumber : ans.questionNo,
        questionText   : ans.questionText,
        questionType   : ans.questionType,
        studentAnswer  : ans.studentAnswer,
        modelAnswer    : ans.modelAnswer,
        keyConcepts    : ans.keyConcepts,
        marksObtained  : ans.marksObtained,
        maxMarks       : ans.maxMarks,
        isCorrect      : ans.isCorrect,
        feedback       : ans.feedback,
        similarityScore: ans.similarityScore,
        conceptScore   : ans.conceptScore,
      })),
      questions: attempt.questions,
    });

  } catch (err) {
    console.error("❌ Error submitting practice session:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// ============================================================
// GET /api/self-learning/my-attempts
// ============================================================
router.get("/my-attempts", auth, async (req, res) => {
  try {
    const attempts = await SelfLearningAttempt.find({ studentId: req.user.id })
      .select("topic subject contentType status score totalQuestions correctAnswers createdAt completedAt totalScore maxScore")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// ============================================================
// GET /api/self-learning/attempt/:attemptId/results
// ============================================================
router.get("/attempt/:attemptId/results", auth, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const studentId     = req.user.id;

    const attempt = await SelfLearningAttempt.findById(attemptId).lean();
    if (!attempt)                                   return res.status(404).json({ msg: "Practice session not found" });
    if (attempt.studentId.toString() !== studentId) return res.status(403).json({ msg: "Unauthorized" });
    if (!attempt.answers || attempt.answers.length === 0) return res.status(400).json({ msg: "No results available - session not completed" });

    const breakdown = attempt.answers.map((ans, index) => {
      const question    = attempt.questions[index];
      const isNewFormat = ans.questionNo !== undefined;

      if (isNewFormat) {
        return {
          questionNumber : ans.questionNo,
          questionText   : ans.questionText,
          questionType   : ans.questionType,
          studentAnswer  : ans.studentAnswer,
          modelAnswer    : ans.modelAnswer    || "",
          keyConcepts    : ans.keyConcepts    || [],
          marksObtained  : ans.marksObtained,
          maxMarks       : ans.maxMarks,
          isCorrect      : ans.isCorrect,
          feedback       : ans.feedback,
          similarityScore: ans.similarityScore,
          conceptScore   : ans.conceptScore,
          options        : question?.options  || null,
        };
      }

      // Legacy format fallback
      const studentAnswerDisplay = ans.type === "mcq"
        ? question?.options?.[ans.selectedOptionIndex] || `Option ${ans.selectedOptionIndex + 1}`
        : ans.textAnswer || "(No answer)";

      return {
        questionNumber : index + 1,
        questionText   : ans.questionText || question?.text,
        questionType   : ans.type,
        studentAnswer  : studentAnswerDisplay,
        modelAnswer    : ans.correctAnswer || "",
        keyConcepts    : [],
        marksObtained  : ans.pointsAwarded,
        maxMarks       : ans.maxPoints     || question?.max_marks || 10,
        isCorrect      : ans.isCorrect,
        feedback       : ans.aiGradingFeedback || (ans.isCorrect ? "✓ Correct!" : "✗ Incorrect"),
        options        : question?.options || null,
      };
    });

    res.json({
      attemptId  : attempt._id,
      topic      : attempt.topic,
      subject    : attempt.subject,
      completedAt: attempt.completedAt,
      summary    : { score: attempt.score, correctAnswers: attempt.correctAnswers, totalQuestions: attempt.totalQuestions, totalScore: attempt.totalScore, maxScore: attempt.maxScore },
      breakdown,
    });

  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// ============================================================
// DELETE /api/self-learning/attempt/:attemptId
// ============================================================
router.delete("/attempt/:attemptId", auth, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const studentId     = req.user.id;
    const attempt       = await SelfLearningAttempt.findById(attemptId);
    if (!attempt)                                   return res.status(404).json({ msg: "Practice session not found" });
    if (attempt.studentId.toString() !== studentId) return res.status(403).json({ msg: "Unauthorized" });
    await attempt.deleteOne();
    res.json({ msg: "Practice session deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

module.exports = router;