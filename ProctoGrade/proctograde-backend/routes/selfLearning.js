// ============================================
// routes/selfLearning.js
// Self-learning practice with instant results for students
// ✅ SSL Fix: Added httpsAgent to bypass SSL verification for ngrok
// ============================================
const express = require("express");
const axios = require("axios");
const https = require("https"); // ✅ SSL Fix
const auth = require("../middleware/auth");
const SelfLearningAttempt = require("../models/SelfLearningAttempt");
const { gradeAttempt } = require("../utils/gradingService");
const router = express.Router();

// ✅ SSL Fix: Bypass SSL verification (for ngrok tunnels in development)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

console.log("✅ self-learning routes file loaded");

// ============================================
// HELPER: Get AI service URL
// ============================================
function getAIServiceURL() {
  const url = process.env.COLAB_RAG_URL;
  if (!url) {
    console.error("❌ COLAB_RAG_URL not set in .env");
    return null;
  }
  return url.replace(/\/$/, "");
}

// ============================================
// POST /api/self-learning/start
// Student starts a practice session
// ============================================
router.post("/start", auth, async (req, res) => {
  try {
    const {
      topic,
      subject = "General",
      contentType = "mixed",
      numQuestions = 5,
      difficulty = "medium",
      questions, // ✅ Accept pre-generated questions from frontend
    } = req.body;

    console.log("🎯 Starting self-learning session:", {
      topic,
      subject,
      contentType,
      numQuestions,
      difficulty,
      hasQuestions: !!questions,
      questionsCount: questions?.length,
    });

    if (!topic || topic.trim() === "") {
      return res.status(400).json({ msg: "Topic is required" });
    }

    let finalQuestions = [];

    // ✅ PRIORITIZE frontend questions (already generated)
    if (questions && Array.isArray(questions) && questions.length > 0) {
      console.log("✅ Using questions from frontend:", questions.length);
      finalQuestions = questions;
    } else {
      // ✅ Fallback: Generate from AI using correct endpoint
      console.log("⚠️ No questions from frontend, generating from AI...");

      const COLAB_URL = getAIServiceURL();
      if (!COLAB_URL) {
        return res.status(500).json({ msg: "AI service not configured" });
      }

      try {
        // ✅ FIXED: Use correct by-topic endpoint
        const colabResp = await axios.post(
          `${COLAB_URL}/api/generate/by-topic`,
          {
            subject: subject,
            topic: topic,
            question_type: contentType,
            num_questions: parseInt(numQuestions) || 5,
            difficulty: difficulty,
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 600000,
            validateStatus: () => true,
            httpsAgent, // ✅ SSL Fix
          }
        );

        console.log("✅ AI Response received:", {
          status: colabResp.status,
          hasQuestions: !!colabResp.data?.questions,
        });

        if (colabResp.status !== 200) {
          throw new Error(`AI service returned ${colabResp.status}: ${colabResp.data?.detail || "Unknown error"}`);
        }

        if (!colabResp.data?.questions || colabResp.data.questions.length === 0) {
          throw new Error("No questions generated from AI");
        }

        finalQuestions = colabResp.data.questions;
        console.log("📝 Questions generated from AI:", finalQuestions.length);
      } catch (aiError) {
        console.error("❌ AI generation failed:", aiError.message);
        return res.status(500).json({
          error: "Failed to generate questions from AI",
          details: aiError.message,
        });
      }
    }

    // ✅ Validate we have questions
    if (!finalQuestions || finalQuestions.length === 0) {
      return res.status(400).json({ msg: "No questions available. Please try again." });
    }

    console.log("📝 Saving attempt with", finalQuestions.length, "questions");

    const attempt = new SelfLearningAttempt({
      studentId: req.user.id,
      topic: topic.trim(),
      subject,
      contentType,
      questions: finalQuestions,
      totalQuestions: finalQuestions.length,
      status: "in-progress",
    });

    await attempt.save();
    console.log("✅ Attempt saved:", attempt._id);

    // ✅ Send questions WITHOUT answers to student
    const questionsForStudent = finalQuestions.map((q, index) => ({
      id: index.toString(),
      text: q.text,
      type: q.type,
      options: q.options || null,
      // ❌ answer NOT sent
      // ❌ teacher_answer NOT sent
    }));

    res.json({
      msg: "Practice session started",
      attemptId: attempt._id,
      topic: attempt.topic,
      subject: attempt.subject,
      totalQuestions: finalQuestions.length,
      questions: questionsForStudent,
    });
  } catch (err) {
    console.error("❌ Error starting self-learning:", err.message);
    res.status(500).json({ error: err.message || "Failed to start practice session" });
  }
});

// ============================================
// POST /api/self-learning/submit/:attemptId
// Student submits practice answers
// ✅ Returns full results immediately (unlike teacher exams)
// ============================================
router.post("/submit/:attemptId", auth, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { answers } = req.body;
    const studentId = req.user.id;

    console.log("📥 Submit received:", {
      attemptId,
      studentId,
      answersCount: answers?.length,
    });

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ msg: "Answers are required" });
    }

    const attempt = await SelfLearningAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ msg: "Practice session not found" });
    }

    if (attempt.studentId.toString() !== studentId) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    if (attempt.status === "completed") {
      return res.status(400).json({ msg: "Session already completed" });
    }

    if (!attempt.questions || attempt.questions.length === 0) {
      return res.status(500).json({ msg: "Invalid attempt - no questions found" });
    }

    console.log("📤 Grading attempt...");
    const gradingResult = await gradeAttempt(attempt.questions, answers);

    if (!gradingResult || !gradingResult.gradedAnswers) {
      return res.status(500).json({ msg: "Failed to grade session" });
    }

    // ✅ Save results
    attempt.answers = gradingResult.gradedAnswers;
    attempt.completedAt = new Date();
    attempt.status = "completed";
    attempt.score = gradingResult.percentage;
    attempt.correctAnswers = gradingResult.correctCount;
    attempt.totalScore = gradingResult.totalScore;
    attempt.maxScore = gradingResult.maxScore;

    await attempt.save();
    console.log("💾 Results saved:", {
      score: gradingResult.percentage,
      correct: gradingResult.correctCount,
    });

    // ✅ Return full results to student (practice mode — answers visible)
    res.json({
      msg: "Practice session completed",
      attemptId: attempt._id,

      // Score summary
      score: gradingResult.percentage,
      correctAnswers: gradingResult.correctCount,
      totalQuestions: attempt.totalQuestions,
      totalScore: gradingResult.totalScore,
      maxScore: gradingResult.maxScore,

      // Full breakdown with correct answers + feedback
      answers: gradingResult.gradedAnswers.map((ans, index) => ({
        questionNumber: index + 1,
        questionText: ans.questionText,
        questionType: ans.type,
        studentAnswer:
          ans.type === "mcq" ? ans.selectedOptionIndex : ans.textAnswer,
        correctAnswer: ans.correctAnswer,
        isCorrect: ans.isCorrect,
        pointsAwarded: ans.pointsAwarded,
        maxPoints: ans.maxPoints,
        feedback: ans.aiGradingFeedback || (ans.isCorrect ? "✓ Correct!" : "✗ Incorrect"),
      })),

      // Full questions for reference
      questions: attempt.questions,
    });
  } catch (err) {
    console.error("❌ Error submitting practice session:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// ============================================
// GET /api/self-learning/my-attempts
// Student views their practice history
// ============================================
router.get("/my-attempts", auth, async (req, res) => {
  try {
    const attempts = await SelfLearningAttempt.find({ studentId: req.user.id })
      .select(
        "topic subject contentType status score totalQuestions correctAnswers createdAt completedAt totalScore maxScore"
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    console.log(`📊 Found ${attempts.length} practice attempts`);
    res.json(attempts);
  } catch (err) {
    console.error("Error fetching practice attempts:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// ============================================
// GET /api/self-learning/attempt/:attemptId/results
// Student views detailed results of a past practice
// ============================================
router.get("/attempt/:attemptId/results", auth, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const studentId = req.user.id;

    const attempt = await SelfLearningAttempt.findById(attemptId).lean();

    if (!attempt) {
      return res.status(404).json({ msg: "Practice session not found" });
    }

    if (attempt.studentId.toString() !== studentId) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    if (!attempt.answers || attempt.answers.length === 0) {
      return res.status(400).json({ msg: "No results available - session not completed" });
    }

    const breakdown = attempt.answers.map((ans, index) => {
      const question = attempt.questions[index];

      let studentAnswerDisplay = "";
      if (ans.type === "mcq") {
        studentAnswerDisplay =
          question?.options?.[ans.selectedOptionIndex] ||
          `Option ${ans.selectedOptionIndex + 1}`;
      } else {
        studentAnswerDisplay = ans.textAnswer || "(No answer)";
      }

      return {
        questionNumber: index + 1,
        questionText: ans.questionText || question?.text,
        questionType: ans.type,
        studentAnswer: studentAnswerDisplay,
        correctAnswer: ans.correctAnswer,
        isCorrect: ans.isCorrect,
        pointsAwarded: ans.pointsAwarded,
        maxPoints: ans.maxPoints,
        feedback:
          ans.aiGradingFeedback ||
          (ans.isCorrect ? "✓ Correct answer!" : "✗ Incorrect. Review the correct answer below."),
        options: question?.options || null,
        selectedOptionIndex: ans.selectedOptionIndex,
      };
    });

    res.json({
      attemptId: attempt._id,
      topic: attempt.topic,
      subject: attempt.subject,
      completedAt: attempt.completedAt,
      summary: {
        score: attempt.score,
        correctAnswers: attempt.correctAnswers,
        totalQuestions: attempt.totalQuestions,
        totalScore: attempt.totalScore,
        maxScore: attempt.maxScore,
      },
      breakdown,
    });
  } catch (err) {
    console.error("Error fetching attempt results:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// ============================================
// DELETE /api/self-learning/attempt/:attemptId
// Student deletes a practice session
// ============================================
router.delete("/attempt/:attemptId", auth, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const studentId = req.user.id;

    const attempt = await SelfLearningAttempt.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({ msg: "Practice session not found" });
    }

    if (attempt.studentId.toString() !== studentId) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    await attempt.deleteOne();
    console.log(`🗑️ Deleted practice attempt: ${attemptId}`);

    res.json({ msg: "Practice session deleted" });
  } catch (err) {
    console.error("Error deleting practice session:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

module.exports = router;