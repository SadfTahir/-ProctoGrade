// src/components/StudentComponents/StudentExamAttempt.jsx
import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import "../../Pages/Dashboards/StudentDashboard.css";

const BACKEND_URL = "http://localhost:5000";

export default function StudentExamAttempt() {
  const { examId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const initialExam = location.state?.exam || null;

  const [exam, setExam] = useState(initialExam);
  const [loading, setLoading] = useState(!initialExam);
  const [error, setError] = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // NEW: timer state (seconds)
  const [timeLeft, setTimeLeft] = useState(null);

  // load exam if not passed in state
  useEffect(() => {
    if (initialExam) return;
    if (!examId) return;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${BACKEND_URL}/api/exams/${examId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.msg || "Failed to load exam");
        setExam(data);
      } catch (err) {
        console.error(err);
        setError(err.message || "Error loading exam");
      } finally {
        setLoading(false);
      }
    })();
  }, [examId, initialExam]);

  // NEW: initialize timer when exam is loaded
  useEffect(() => {
    if (!exam) return;
    // exam.durationMinutes ko backend se rakhna best practice hai
    const durationMinutes = exam.durationMinutes || 30; // fallback 30 mins
    setTimeLeft(durationMinutes * 60);
  }, [exam]);

  // NEW: countdown effect
  useEffect(() => {
    if (timeLeft === null) return;

    if (timeLeft <= 0) {
      // time khatam -> auto submit (agar already submit call nahi hua)
      if (!submitting) {
        handleSubmit(true); // true -> autoSubmit flag
      }
      return;
    }

    const id = setInterval(() => {
      setTimeLeft((t) => (t !== null ? t - 1 : t));
    }, 1000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="student-page">
        <p>Loading exam...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="student-page">
        <p className="join-error">{error}</p>
      </div>
    );
  }
  if (!exam) {
    return (
      <div className="student-page">
        <p className="muted-text">Exam not found.</p>
      </div>
    );
  }

  const questions = Array.isArray(exam.questions) ? exam.questions : [];
  const total = questions.length;

  const currentQuestion = questions[currentIndex] || {};
  const qId =
    currentQuestion._id || currentQuestion.id || currentIndex.toString();
  const qText =
    currentQuestion.text || currentQuestion.questionText || "Question text";
  const qType = currentQuestion.type || "mcq";
  const options = currentQuestion.options || currentQuestion.choices || [];

  const selectedValue = answers[qId] ?? "";

  const handleSelectValue = (val) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: val,
    }));
  };

  const handleNext = () => {
    if (currentIndex < total - 1) setCurrentIndex((i) => i + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const isAttempted = (q, index) => {
    const id = q._id || q.id || index.toString();
    const val = answers[id];
    const type = q.type || "mcq";

    if (type === "mcq") {
      return typeof val === "number";
    }
    return typeof val === "string" && val.trim().length > 0;
  };

  // NEW: check if all questions are attempted
  const allAttempted =
    questions.length > 0 &&
    questions.every((q, index) => isAttempted(q, index));

  // minutes & seconds for display
  const minutes = Math.floor((timeLeft || 0) / 60);
  const seconds = (timeLeft || 0) % 60;

  // autoSubmit param: true agar time khatam hone par call ho
  const handleSubmit = async (autoSubmit = false) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Not authenticated. Please log in again.");
      return;
    }

    // agar manual submit hai to ensure all questions attempted
    if (!autoSubmit && !allAttempted) {
      alert("Please attempt all questions before submitting.");
      return;
    }

    const questionsArr = Array.isArray(exam.questions) ? exam.questions : [];

    const payloadAnswers = questionsArr.map((q, index) => {
      const questionId = q._id || q.id || index.toString();
      const val = answers[questionId];
      const type = q.type || "mcq";

      const base = {
        questionId,
        questionText: q.text || q.questionText || `Question ${index + 1}`,
        type,
      };

      if (type === "mcq") {
        return {
          ...base,
          selectedOptionIndex: typeof val === "number" ? val : null,
          textAnswer: undefined,
        };
      } else {
        return {
          ...base,
          selectedOptionIndex: undefined,
          textAnswer: typeof val === "string" ? val.slice(0, 220) : "",
        };
      }
    });

    try {
      setSubmitting(true);
      const res = await fetch(
        `${BACKEND_URL}/api/exams/${exam._id}/attempt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            answers: payloadAnswers,
            classId: exam.classId,
            autoSubmit, // optional flag backend ko batane ke liye
          }),
        }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.msg || "Failed to submit exam");
        return;
      }

      console.log("Attempt saved:", data);
      alert(
        autoSubmit
          ? "Time is over. Your exam has been submitted automatically."
          : "Exam submitted successfully."
      );
      // redirect + refresh attempts
      navigate("/student-dashboard", {
        state: { refreshAttempts: Date.now() },
      });
    } catch (err) {
      console.error("Error submitting exam:", err);
      alert(err.message || "Error submitting exam");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="student-page">
      <div className="student-header">
        <div>
          <button className="back-btn" onClick={handleBack}>
            ← Back
          </button>
          <h2 className="student-title">{exam.title}</h2>
          <p className="student-subtitle">
            Question {currentIndex + 1} of {total || "?"}
            {timeLeft !== null && (
              <span style={{ marginLeft: 8 }}>
                • Time left:{" "}
                {minutes.toString().padStart(2, "0")}:
                {seconds.toString().padStart(2, "0")}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="student-main exam-main-layout">
        {/* Sidebar: question pills */}
        <aside className="exam-question-sidebar">
          <h4 className="exam-sidebar-title">Questions</h4>
          <ul className="exam-question-list">
            {questions.map((q, index) => {
              const id = q._id || q.id || index.toString();
              const attempted = isAttempted(q, index);
              const isActive = index === currentIndex;

              return (
                <li
                  key={id}
                  className={
                    "exam-question-pill" +
                    (isActive ? " exam-question-pill-active" : "") +
                    (attempted ? " exam-question-pill-attempted" : "")
                  }
                  onClick={() => setCurrentIndex(index)}
                >
                  <span className="pill-index">{index + 1}</span>
                  {attempted && <span className="pill-status">✓</span>}
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Right: question + options */}
        <main className="student-content">
          <div className="student-tab-panel">
            {total === 0 ? (
              <p className="muted-text">
                No questions found for this exam.
              </p>
            ) : (
              <>
                {/* Question */}
                <div className="exam-question-card">
                  <p className="exam-question-text">{qText}</p>
                </div>

                {/* Options / Answer */}
                {qType === "mcq" ? (
                  <div className="exam-options-card">
                    <ul className="exam-options-list">
                      {options.map((opt, idx) => {
                        const active = selectedValue === idx;
                        return (
                          <li
                            key={idx}
                            className={
                              "exam-option-item" +
                              (active ? " exam-option-item-active" : "")
                            }
                            onClick={() => handleSelectValue(idx)}
                          >
                            {opt}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <div className="exam-options-card">
                    <textarea
                      rows={4}
                      className="answer-textarea"
                      placeholder="Type your answer here (max 220 characters)..."
                      value={selectedValue}
                      onChange={(e) => handleSelectValue(e.target.value)}
                      maxLength={220}
                    />
                    <div className="char-counter">
                      {(selectedValue || "").length}/220
                    </div>
                  </div>
                )}

                {/* Navigation / Submit */}
                <div className="exam-nav-row">
                  <button
                    className="class-secondary-btn"
                    type="button"
                    disabled={currentIndex === 0 || submitting}
                    onClick={handlePrev}
                  >
                    Previous
                  </button>

                  {currentIndex < total - 1 ? (
                    <button
                      className="class-primary-btn"
                      type="button"
                      disabled={submitting}
                      onClick={handleNext}
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      className="class-primary-btn"
                      type="button"
                      disabled={submitting || !allAttempted}
                      onClick={() => handleSubmit(false)}
                    >
                      {submitting
                        ? "Submitting..."
                        : allAttempted
                        ? "Submit"
                        : "Attempt all questions"}
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
