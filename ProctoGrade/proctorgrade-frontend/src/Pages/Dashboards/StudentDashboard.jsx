// src/Pages/StudentDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./StudentDashboard.css";
import StudentSelfLearning from "../../components/StudentComponents/StudentSelfLearning";



const BACKEND_URL = "http://localhost:5000";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState("classes");

  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState("");

  const [joinedClasses, setJoinedClasses] = useState([]);

  const [myExams, setMyExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examsError, setExamsError] = useState("");

  const [myAttempts, setMyAttempts] = useState([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Fetch joined classes
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    async function fetchClasses() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/classes/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json().catch(() => null);
        if (res.ok && Array.isArray(data)) {
          setJoinedClasses(
            data.map((c) => ({
              id: c.id || c._id,
              name: c.name,
              subject: c.subject,
            }))
          );
        }
      } catch (err) {
        console.error("Error fetching classes:", err);
      }
    }

    fetchClasses();
  }, []);

  // Fetch exams for this student
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    async function fetchExams() {
      try {
        setLoadingExams(true);
        setExamsError("");
        const res = await fetch(`${BACKEND_URL}/api/exams/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.msg || "Failed to load exams");
        if (Array.isArray(data)) setMyExams(data);
      } catch (err) {
        console.error("Error fetching exams:", err);
        setExamsError(err.message || "Error loading exams");
      } finally {
        setLoadingExams(false);
      }
    }

    fetchExams();
  }, []);

  // Fetch my attempts
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    async function fetchAttempts() {
      try {
        setLoadingAttempts(true);
        const res = await fetch(`${BACKEND_URL}/api/exams/my-attempts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (res.ok && Array.isArray(data)) {
          setMyAttempts(data);
        }
      } catch (err) {
        console.error("Error fetching attempts:", err);
      } finally {
        setLoadingAttempts(false);
      }
    }

    fetchAttempts();
  }, [location.state?.refreshAttempts]);

  const hasSubmitted = (examId) =>
    myAttempts.some(
      (a) =>
        a.examId === examId ||
        a.examId?._id === examId ||
        a.examId?.toString?.() === examId
    );

  const handleJoinClass = async () => {
    setJoinError("");

    if (!joinCode.trim()) {
      setJoinError("Please enter a class code.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setJoinError("Not authenticated. Please log in again.");
      return;
    }

    setJoinLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/classes/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ joinCode }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.msg || "Failed to join class");
      }

      if (data.class) {
        const cls = data.class;
        const normalized = {
          id: cls.id || cls._id,
          name: cls.name,
          subject: cls.subject,
        };
        setJoinedClasses((prev) => {
          const exists = prev.some((c) => c.id === normalized.id);
          if (exists) return prev;
          return [...prev, normalized];
        });
      }

      setJoinCode("");
      setActiveTab("classes");
    } catch (err) {
      console.error(err);
      setJoinError("Error joining class. Please check the code and try again.");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleOpenClass = (cls) => {
    navigate(`/student-dashboard/classes/${cls.id}`, {
      state: { classInfo: cls },
    });
  };

  return (
    <div className="student-page">
      <div className="student-header">
        <div>
          <h2 className="student-title">Student Dashboard</h2>
          <p className="student-subtitle">
            View your classes, tests, and self-learning resources in one place.
          </p>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="student-main">
        <aside className="student-sidebar">
          <button
            className={
              activeTab === "classes" ? "sidebar-item active" : "sidebar-item"
            }
            onClick={() => setActiveTab("classes")}
          >
            📚 Classes
          </button>
          <button
            className={
              activeTab === "join" ? "sidebar-item active" : "sidebar-item"
            }
            onClick={() => setActiveTab("join")}
          >
            ➕ Join Class
          </button>
          <button
            className={
              activeTab === "tests" ? "sidebar-item active" : "sidebar-item"
            }
            onClick={() => setActiveTab("tests")}
          >
            📝 Tests
          </button>
          <button
            className={
              activeTab === "learn" ? "sidebar-item active" : "sidebar-item"
            }
            onClick={() => setActiveTab("learn")}
          >
            🎓 Self Learning
          </button>
          <button
            className={
              activeTab === "results" ? "sidebar-item active" : "sidebar-item"
            }
            onClick={() => setActiveTab("results")}
          >
            📊 Results
          </button>
        </aside>

        <main className="student-content">
          {/* CLASSES TAB */}
          {activeTab === "classes" && (
            <div className="student-tab-panel">
              <h3>Your Classes</h3>

              {joinedClasses.length > 0 ? (
                <div className="classes-grid">
                  {joinedClasses.map((cls) => (
                    <div
                      key={cls.id}
                      className="class-card"
                      onClick={() => handleOpenClass(cls)}
                    >
                      <div className="class-card-header">
                        <h4 className="class-name">{cls.name}</h4>
                        <span className="class-subject">
                          {cls.subject || "No subject"}
                        </span>
                      </div>
                      <div className="class-card-footer">
                        <span className="class-card-open-link">Open →</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted-text">
                  You have not joined any classes yet. Use the "Join Class" tab to get started!
                </p>
              )}
            </div>
          )}

          {/* JOIN TAB */}
          {activeTab === "join" && (
            <div className="student-tab-panel">
              <h3>Join a Class</h3>
              <div className="join-card">
                <label className="join-field">
                  <span>Class Code:</span>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(e.target.value.toUpperCase())
                    }
                    placeholder="e.g. 6ED2UH"
                  />
                </label>

                {joinError && <div className="join-error">{joinError}</div>}

                <button
                  className="join-btn"
                  onClick={handleJoinClass}
                  disabled={joinLoading}
                >
                  {joinLoading ? "Joining..." : "Join Class"}
                </button>
              </div>
            </div>
          )}

          {/* TESTS TAB */}
          {activeTab === "tests" && (
            <div className="student-tab-panel">
              <h3>My Tests</h3>
              <div className="student-tests-wrapper">
                {loadingExams && <p>Loading your tests...</p>}
                {loadingAttempts && !loadingExams && (
                  <p className="muted-text">Checking your attempts...</p>
                )}
                {examsError && <p className="join-error">{examsError}</p>}

                {!loadingExams &&
                  !examsError &&
                  myExams.length === 0 && (
                    <p className="muted-text">
                      No tests assigned to you yet.
                    </p>
                  )}

                {myExams.length > 0 &&
                  !loadingExams &&
                  !examsError && (
                    <div className="student-tests-list">
                      {myExams.map((exam) => {
                        const now = new Date();
                        const start = exam.startTime
                          ? new Date(exam.startTime)
                          : null;
                        const end = exam.endTime
                          ? new Date(exam.endTime)
                          : null;

                        let label = "Scheduled";
                        let statusClass = "status-scheduled";
                        let canStart = false;

                        if (start && end) {
                          if (now < start) {
                            label = "Upcoming";
                            statusClass = "status-scheduled";
                            canStart = false;
                          } else if (now >= start && now <= end) {
                            label = "Active";
                            statusClass = "status-active";
                            canStart = true;
                          } else if (now > end) {
                            label = "Closed";
                            statusClass = "status-closed";
                            canStart = false;
                          }
                        }

                        const submitted = hasSubmitted(exam._id);

                        return (
                          <div
                            key={exam._id}
                            className="student-test-card"
                          >
                            <div className="student-test-header">
                              <div>
                                <strong>{exam.title}</strong>
                                <div className="student-test-class">
                                  {exam.className || "Class test"}
                                </div>
                              </div>
                              <div className="student-test-status-group">
                                <span
                                  className={`status-pill ${statusClass}`}
                                >
                                  {label}
                                </span>
                                {submitted && (
                                  <span className="status-pill status-submitted">
                                    Submitted
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="student-test-times">
                              <span>
                                Start:{" "}
                                {start
                                  ? start.toLocaleString()
                                  : "-"}
                              </span>
                              <span>
                                End:{" "}
                                {end ? end.toLocaleString() : "-"}
                              </span>
                            </div>

                            <div className="student-test-footer">
                              <span className="student-test-questions">
                                {exam.questions?.length || 0} questions
                              </span>
                              <button
                                className={
                                  submitted
                                    ? "class-primary-btn submitted-btn"
                                    : "class-primary-btn"
                                }
                                disabled={!canStart || submitted}
                                onClick={() => {
                                  if (!canStart || submitted) return;
                                  navigate(
                                    `/student-dashboard/exams/${exam._id}`,
                                    {
                                      state: { exam },
                                    }
                                  );
                                }}
                              >
                                {submitted
                                  ? "✓ Submitted"
                                  : canStart
                                  ? "Start Test"
                                  : "Not Available"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* 🎓 SELF LEARNING TAB - NEW! */}
          {activeTab === "learn" && (
            <div className="student-tab-panel">
              <StudentSelfLearning />
            </div>
          )}

          {/* RESULTS TAB */}
          {activeTab === "results" && (
            <div className="student-tab-panel">
              <h3>Results</h3>
              <p className="muted-text">
                Results and past attempts will be shown here.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}