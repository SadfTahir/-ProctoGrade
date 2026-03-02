// utils/gradingService.js
require("dotenv").config();
const axios = require("axios");

async function gradeAttempt(questions, studentAnswers) {
  try {
    const COLAB_URL = process.env.COLAB_RAG_URL;
    if (!COLAB_URL) {
      console.warn("⚠️ COLAB_RAG_URL missing - using fallback grading");
      return fallbackGrading(questions, studentAnswers);
    }

    console.log("📤 Sending to AI for grading:", {
      questionsCount: questions.length,
      answersCount: studentAnswers.length,
    });

    // ✅ Map student answers to plain text strings (Cell 4 expects string array)
    const studentAnswerStrings = studentAnswers.map((ans, idx) => {
      const question = questions[idx];
      if (
        question.type === "mcq" &&
        ans.selectedOptionIndex !== undefined &&
        ans.selectedOptionIndex !== null
      ) {
        return question.options?.[ans.selectedOptionIndex] || "";
      }
      return ans.textAnswer || "";
    });

    // ✅ Build request for /api/grade/batch (Cell 4 format)
    const gradeReq = {
      questions: questions.map((q, index) => ({
        text: q.text,
        type: q.type,
        options: q.options || null,
        answer: q.answer || null,                        // MCQ correct answer
        teacher_answer: q.teacher_answer || q.answer || null, // Short answer reference
      })),
      student_answers: studentAnswerStrings,
    };

    console.log("📤 Calling /api/grade/batch with", gradeReq.questions.length, "questions");

    // ✅ CORRECT ENDPOINT: /api/grade/batch
    const resp = await axios.post(`${COLAB_URL}/api/grade/batch`, gradeReq, {
      headers: { "Content-Type": "application/json" },
      timeout: 120000,       // 2 minutes for batch grading
      validateStatus: () => true,
    });

    if (resp.status !== 200) {
      console.error("❌ AI grading returned error:", resp.status, resp.data);
      return fallbackGrading(questions, studentAnswers);
    }

    const aiGrade = resp.data;

    // ✅ Validate response structure from Cell 4
    // Expected: { results: [...], total, percentage, total_questions, grade_letter }
    if (!aiGrade.results || !Array.isArray(aiGrade.results)) {
      console.error("❌ Invalid AI response structure:", aiGrade);
      return fallbackGrading(questions, studentAnswers);
    }

    console.log("✅ AI Grading response received:", {
      total: aiGrade.total,
      percentage: aiGrade.percentage,
      grade_letter: aiGrade.grade_letter,
    });

    // ✅ Map Cell 4 response to gradedAnswers format
    const gradedAnswers = questions.map((question, i) => {
      const studentAns = studentAnswers[i] || {};
      const aiResult = aiGrade.results[i] || {
        marks: 0,
        reason: "No AI response",
        feedback: "Could not grade",
        final_score: 0,
      };

      const marks = parseFloat(aiResult.marks) || 0;
      const isCorrect = marks >= 7; // 70%+ = correct

      return {
        questionId: i.toString(),
        questionText: question.text || "",
        type: question.type || "mcq",
        selectedOptionIndex:
          typeof studentAns.selectedOptionIndex === "number"
            ? studentAns.selectedOptionIndex
            : null,
        textAnswer:
          typeof studentAns.textAnswer === "string" ? studentAns.textAnswer : "",
        correctAnswer: question.teacher_answer || question.answer || "",
        isCorrect,
        pointsAwarded: marks,
        maxPoints: 10,
        aiGradingFeedback: aiResult.feedback || aiResult.reason || (isCorrect ? "✓ Correct!" : "✗ Incorrect"),
      };
    });

    const totalScore = aiGrade.total || 0;
    const maxScore = questions.length * 10;
    const correctCount = gradedAnswers.filter((a) => a.isCorrect).length;

    console.log("✅ Grading complete:", { totalScore, maxScore, correctCount });

    return {
      gradedAnswers,
      percentage: aiGrade.percentage || Math.round((totalScore / maxScore) * 100),
      totalScore,
      maxScore,
      correctCount,
    };
  } catch (error) {
    console.error("❌ AI Grading failed:", error.message);
    return fallbackGrading(questions, studentAnswers);
  }
}

// ============================================
// FALLBACK: Local grading when Colab unreachable
// ============================================
function fallbackGrading(questions, studentAnswers) {
  console.log("⚠️ Using fallback local grading...");
  const maxScore = questions.length * 10;

  const gradedAnswers = questions.map((question, i) => {
    const studentAns = studentAnswers[i] || {};
    let isCorrect = false;
    let pointsAwarded = 0;
    let feedback = "AI grading unavailable - local check only";

    if (question.type === "mcq" && typeof studentAns.selectedOptionIndex === "number") {
      // ✅ MCQ: exact match by index
      const correctIndex = question.options?.indexOf(question.answer);
      isCorrect = studentAns.selectedOptionIndex === correctIndex;
      pointsAwarded = isCorrect ? 10 : 0;
      feedback = isCorrect ? "✓ Correct" : `✗ Incorrect. Correct: ${question.answer}`;
    } else if (question.type === "short") {
      // ✅ Short answer: keyword overlap
      const teacherAns = (question.teacher_answer || question.answer || "").toLowerCase();
      const studentText = (studentAns.textAnswer || "").toLowerCase();

      if (studentText.length < 10) {
        feedback = "Answer too brief";
        pointsAwarded = 1;
      } else {
        const teacherWords = teacherAns.split(/\s+/).filter((w) => w.length > 3);
        const studentWords = studentText.split(/\s+/).filter((w) => w.length > 3);
        const overlap = teacherWords.filter((w) => studentWords.includes(w)).length;
        const ratio = teacherWords.length > 0 ? overlap / teacherWords.length : 0;

        if (ratio >= 0.5) {
          isCorrect = true;
          pointsAwarded = Math.round(ratio * 10);
          feedback = "Good keyword coverage (estimated)";
        } else {
          pointsAwarded = Math.round(ratio * 10);
          feedback = "Missing key concepts (estimated)";
        }
      }
    }

    return {
      questionId: i.toString(),
      questionText: question.text || "",
      type: question.type || "mcq",
      selectedOptionIndex:
        typeof studentAns.selectedOptionIndex === "number"
          ? studentAns.selectedOptionIndex
          : null,
      textAnswer:
        typeof studentAns.textAnswer === "string" ? studentAns.textAnswer : "",
      correctAnswer: question.teacher_answer || question.answer || "",
      isCorrect,
      pointsAwarded,
      maxPoints: 10,
      aiGradingFeedback: feedback,
    };
  });

  const totalScore = gradedAnswers.reduce((sum, ans) => sum + ans.pointsAwarded, 0);
  const correctCount = gradedAnswers.filter((ans) => ans.isCorrect).length;

  return {
    gradedAnswers,
    percentage: Math.round((totalScore / maxScore) * 100),
    totalScore,
    maxScore,
    correctCount,
  };
}

module.exports = { gradeAttempt };