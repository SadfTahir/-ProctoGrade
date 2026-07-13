// utils/gradingService.js
// ProctoGrade — ✅ UPDATED v3.0
// ✅ FIX: mapAnswersToStrings now handles plain strings (self-learning flow)
// ✅ FIX: MCQ answer text extracted correctly from options

require("dotenv").config();
const axios = require("axios");

// ============================================================
// HELPERS
// ============================================================

function computeMaxScore(questions) {
  return questions.reduce((sum, q) => sum + (parseFloat(q.max_marks) || 10), 0);
}

// ✅ FIXED v3.0: Handles both object format AND plain string format
function mapAnswersToStrings(questions, studentAnswers) {
  return studentAnswers.map((ans, idx) => {
    const question = questions[idx];

    // ── Plain string already (self-learning flow sends strings directly) ──
    if (typeof ans === "string") {
      return ans.trim();
    }

    // ── Object format (teacher exam flow) ──
    if (question?.type === "mcq") {
      // selectedOptionIndex → actual option text
      if (ans?.selectedOptionIndex !== undefined && ans?.selectedOptionIndex !== null) {
        return question.options?.[ans.selectedOptionIndex] || "";
      }
      // textAnswer fallback (should not happen for MCQ but safety net)
      return ans?.textAnswer || "";
    }

    // Short / code answer
    return ans?.textAnswer || ans?.text || "";
  });
}

// ============================================================
// gradeAttempt — Teacher-assigned exam grading
// ============================================================
async function gradeAttempt(questions, studentAnswers) {
  try {
    const COLAB_URL = process.env.COLAB_RAG_URL;
    if (!COLAB_URL) {
      console.warn("⚠️ COLAB_RAG_URL missing - using fallback grading");
      return fallbackGrading(questions, studentAnswers);
    }

    console.log("📤 Sending to AI for grading:", {
      questionsCount: questions.length,
      answersCount  : studentAnswers.length,
    });

    const studentAnswerStrings = mapAnswersToStrings(questions, studentAnswers);

    const gradeReq = {
      questions: questions.map((q) => ({
        text          : q.text,
        type          : q.type,
        options       : q.options        || null,
        answer        : q.answer         || null,
        teacher_answer: q.teacher_answer || q.model_answer || q.answer || null,
        key_concepts  : q.key_concepts   || [],
        marking_guide : q.marking_guide  || "",   // ✅ v5.0 rubric
        max_marks     : parseFloat(q.max_marks) || 10.0,
        rubric        : q.rubric         || null,
      })),
      student_answers: studentAnswerStrings,
    };

    console.log("📤 Calling /api/grade/batch with", gradeReq.questions.length, "questions");

    const resp = await axios.post(`${COLAB_URL}/api/grade/batch`, gradeReq, {
      headers: {
        "Content-Type"              : "application/json",
        "ngrok-skip-browser-warning": "true",
        "User-Agent"                : "ProctoGrade-Backend/15.0",
      },
      timeout      : 120000,
      validateStatus: () => true,
    });

    if (resp.status !== 200) {
      console.error("❌ AI grading returned error:", resp.status, resp.data);
      return fallbackGrading(questions, studentAnswers);
    }

    const aiGrade = resp.data;

    if (!aiGrade.results || !Array.isArray(aiGrade.results)) {
      console.error("❌ Invalid AI response structure:", aiGrade);
      return fallbackGrading(questions, studentAnswers);
    }

    console.log("✅ AI Grading response received:", {
      total       : aiGrade.total,
      percentage  : aiGrade.percentage,
      grade_letter: aiGrade.grade_letter,
    });

    const gradedAnswers = questions.map((question, i) => {
      const studentAns = studentAnswers[i] || {};
      const aiResult   = aiGrade.results[i] || {
        marks      : 0,
        reason     : "No AI response",
        feedback   : "Could not grade",
        final_score: 0,
      };

      const qMaxMarks = parseFloat(question.max_marks) || 10;
      const marks     = parseFloat(aiResult.marks) || 0;
      const isCorrect = marks >= qMaxMarks * 0.7;

      return {
        questionId         : i.toString(),
        questionText       : question.text || "",
        type               : question.type || "mcq",
        selectedOptionIndex: typeof studentAns.selectedOptionIndex === "number"
          ? studentAns.selectedOptionIndex : null,
        textAnswer         : typeof studentAns.textAnswer === "string"
          ? studentAns.textAnswer : "",
        correctAnswer      : question.teacher_answer || question.model_answer || question.answer || "",
        isCorrect,
        pointsAwarded      : marks,
        maxPoints          : qMaxMarks,
        aiGradingFeedback  : aiResult.feedback || aiResult.reason ||
          (isCorrect ? "✓ Correct!" : "✗ Incorrect"),
      };
    });

    const maxScore     = computeMaxScore(questions);
    const totalScore   = aiGrade.total || 0;
    const correctCount = gradedAnswers.filter((a) => a.isCorrect).length;

    console.log("✅ Grading complete:", { totalScore, maxScore, correctCount });

    return {
      gradedAnswers,
      percentage  : aiGrade.percentage || Math.round((totalScore / maxScore) * 100),
      totalScore,
      maxScore,
      correctCount,
    };

  } catch (error) {
    console.error("❌ AI Grading failed:", error.message);
    return fallbackGrading(questions, studentAnswers);
  }
}


// ============================================================
// gradeSelfLearning — Self-learning mode grading
// ✅ v3.0: studentAnswers already plain strings from frontend
// ============================================================
async function gradeSelfLearning(questions, studentAnswers, subject = "General", context = "") {
  try {
    const COLAB_URL = process.env.COLAB_RAG_URL;
    if (!COLAB_URL) {
      console.warn("⚠️ COLAB_RAG_URL missing - using fallback grading");
      return fallbackSelfLearning(questions, studentAnswers);
    }

    console.log("📤 Self-Learning grading request:", {
      questionsCount: questions.length,
      subject,
      hasContext    : !!context,
    });

    // ✅ v3.0: mapAnswersToStrings handles plain strings correctly now
    const studentAnswerStrings = mapAnswersToStrings(questions, studentAnswers);

    console.log("📋 Mapped answers sample:", studentAnswerStrings.slice(0, 2));

    const gradeReq = {
      questions: questions.map((q) => ({
        text     : q.text,
        type     : q.type,
        options  : q.options   || null,
        answer   : q.answer    || null,
        max_marks: parseFloat(q.max_marks) || 10.0,
        language : q.language  || null,
      })),
      student_answers: studentAnswerStrings,
      subject,
      context : context || "",
      use_llm : true,
    };

    console.log("📤 Calling /api/self-learning/grade with", gradeReq.questions.length, "questions");

    const resp = await axios.post(`${COLAB_URL}/api/self-learning/grade`, gradeReq, {
      headers: {
        "Content-Type"              : "application/json",
        "ngrok-skip-browser-warning": "true",
        "User-Agent"                : "ProctoGrade-Backend/15.0",
      },
      timeout      : 300000,
      validateStatus: () => true,
    });

    if (resp.status !== 200) {
      console.error("❌ Self-learning grading error:", resp.status, resp.data);
      return fallbackSelfLearning(questions, studentAnswers);
    }

    const aiResult = resp.data;

    if (!aiResult.results || !Array.isArray(aiResult.results)) {
      console.error("❌ Invalid self-learning response:", aiResult);
      return fallbackSelfLearning(questions, studentAnswers);
    }

    console.log("✅ Self-Learning grading done:", {
      percentage  : aiResult.percentage,
      grade_letter: aiResult.grade_letter,
    });

    const gradedAnswers = aiResult.results.map((r) => ({
      questionNo     : r.question_no,
      questionText   : r.question_text,
      questionType   : r.question_type,
      studentAnswer  : r.student_answer,
      modelAnswer    : r.model_answer,
      keyConcepts    : r.key_concepts   || [],
      marksObtained  : r.marks_obtained,
      maxMarks       : r.max_marks,
      finalScore     : r.final_score,
      feedback       : r.feedback,
      similarityScore: r.similarity_score,
      conceptScore   : r.concept_score,
      isCorrect      : r.final_score >= 0.7,
    }));

    return {
      gradedAnswers,
      totalMarks   : aiResult.total_marks,
      obtainedMarks: aiResult.obtained_marks,
      percentage   : aiResult.percentage,
      gradeLetter  : aiResult.grade_letter,
      summary      : aiResult.summary,
      gradedAt     : aiResult.graded_at,
    };

  } catch (error) {
    console.error("❌ Self-learning grading failed:", error.message);
    return fallbackSelfLearning(questions, studentAnswers);
  }
}


// ============================================================
// FALLBACK: Local grading when Colab unreachable
// ============================================================
function fallbackGrading(questions, studentAnswers) {
  console.log("⚠️ Using fallback local grading...");

  const gradedAnswers = questions.map((question, i) => {
    const studentAns  = studentAnswers[i] || {};
    const qMaxMarks   = parseFloat(question.max_marks) || 10;
    let isCorrect     = false;
    let pointsAwarded = 0;
    let feedback      = "AI grading unavailable - local check only";

    if (question.type === "mcq" && typeof studentAns.selectedOptionIndex === "number") {
      const correctIndex = question.options?.indexOf(question.answer);
      isCorrect          = studentAns.selectedOptionIndex === correctIndex;
      pointsAwarded      = isCorrect ? qMaxMarks : 0;
      feedback           = isCorrect ? "✓ Correct" : `✗ Incorrect. Correct: ${question.answer}`;

    } else if (question.type === "short") {
      const teacherAns  = (question.teacher_answer || question.model_answer || question.answer || "").toLowerCase();
      const studentText = (studentAns.textAnswer || "").toLowerCase();

      if (studentText.length < 10) {
        feedback      = "Answer too brief";
        pointsAwarded = 1;
      } else {
        const teacherWords = teacherAns.split(/\s+/).filter((w) => w.length > 3);
        const studentWords = studentText.split(/\s+/).filter((w) => w.length > 3);
        const overlap      = teacherWords.filter((w) => studentWords.includes(w)).length;
        const ratio        = teacherWords.length > 0 ? overlap / teacherWords.length : 0;
        isCorrect          = ratio >= 0.5;
        pointsAwarded      = Math.round(ratio * qMaxMarks);
        feedback           = isCorrect
          ? "Good keyword coverage (estimated)"
          : "Missing key concepts (estimated)";
      }
    }

    return {
      questionId         : i.toString(),
      questionText       : question.text || "",
      type               : question.type || "mcq",
      selectedOptionIndex: typeof studentAns.selectedOptionIndex === "number"
        ? studentAns.selectedOptionIndex : null,
      textAnswer         : typeof studentAns.textAnswer === "string"
        ? studentAns.textAnswer : "",
      correctAnswer      : question.teacher_answer || question.model_answer || question.answer || "",
      isCorrect,
      pointsAwarded,
      maxPoints          : qMaxMarks,
      aiGradingFeedback  : feedback,
    };
  });

  const maxScore     = computeMaxScore(questions);
  const totalScore   = gradedAnswers.reduce((sum, ans) => sum + ans.pointsAwarded, 0);
  const correctCount = gradedAnswers.filter((ans) => ans.isCorrect).length;

  return {
    gradedAnswers,
    percentage  : Math.round((totalScore / maxScore) * 100),
    totalScore,
    maxScore,
    correctCount,
  };
}


// ============================================================
// FALLBACK: Self-learning when Colab unreachable
// ============================================================
function fallbackSelfLearning(questions, studentAnswers) {
  console.log("⚠️ Using fallback self-learning grading...");

  const gradedAnswers = questions.map((question, i) => {
    const ans         = studentAnswers[i] || {};
    // ✅ v3.0: handle both string and object
    const studentText = typeof ans === "string" ? ans : (ans.textAnswer || "");
    const qMaxMarks   = parseFloat(question.max_marks) || 10;
    let marksObtained = 0;
    let feedback      = "AI grading unavailable - basic check only";
    let isCorrect     = false;

    if (question.type === "mcq") {
      // ✅ v3.0: ans is now the actual option text (string)
      const correctText = (question.answer || "").toLowerCase().trim();
      const givenText   = (typeof ans === "string" ? ans : "").toLowerCase().trim();
      isCorrect         = givenText === correctText;
      marksObtained     = isCorrect ? qMaxMarks : 0;
      feedback          = isCorrect ? "✓ Correct!" : `✗ Incorrect. Correct: ${question.answer}`;
    } else {
      if (studentText.length > 20) {
        marksObtained = Math.round(qMaxMarks * 0.5);
        feedback      = "Answer received. Full AI grading unavailable.";
        isCorrect     = true;
      } else {
        feedback = "Answer too brief or AI unavailable.";
      }
    }

    return {
      questionNo     : i + 1,
      questionText   : question.text  || "",
      questionType   : question.type  || "short",
      studentAnswer  : studentText,
      modelAnswer    : question.answer || "(AI unavailable)",
      keyConcepts    : [],
      marksObtained,
      maxMarks       : qMaxMarks,
      finalScore     : marksObtained / qMaxMarks,
      feedback,
      similarityScore: null,
      conceptScore   : null,
      isCorrect,
    };
  });

  const totalMarks    = computeMaxScore(questions);
  const obtainedMarks = gradedAnswers.reduce((sum, a) => sum + a.marksObtained, 0);
  const percentage    = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;

  return {
    gradedAnswers,
    totalMarks,
    obtainedMarks,
    percentage,
    gradeLetter: percentage >= 80 ? "A" : percentage >= 60 ? "B" : percentage >= 40 ? "C" : "F",
    summary    : `You scored ${percentage}%. (AI grading unavailable — results are estimated)`,
    gradedAt   : Date.now() / 1000,
  };
}


module.exports = { gradeAttempt, gradeSelfLearning };