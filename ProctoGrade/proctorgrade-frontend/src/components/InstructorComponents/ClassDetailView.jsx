// src/components/InstructorComponents/ClassDetailView.jsx
// ProctoGrade — Full ClassDetailView (v2.0)

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AiTestGenerator from "./AiTestGenerator";
import "./ClassDetailView.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function ClassDetailView({ classInfo, onBack }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("ai-quiz");

  // Students
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState("");

  // Tests
  const [tests, setTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [testsError, setTestsError] = useState("");
  const [viewExamId, setViewExamId] = useState(null);

  // Scheduling
  const [scheduleExamId, setScheduleExamId] = useState(null);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const token = localStorage.getItem("token");

  // Fetch Students
  useEffect(() => {
    if (activeTab !== "students" || !classInfo?.id || !token) return;
    const run = async () => {
      setLoadingStudents(true); setStudentsError("");
      try {
        const res = await fetch(`${BACKEND_URL}/api/classes/${classInfo.id}/students`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.msg || "Failed to load students");
        if (Array.isArray(data)) setStudents(data);
      } catch (err) { setStudentsError(err.message); }
      finally { setLoadingStudents(false); }
    };
    run();
  }, [activeTab, classInfo?.id, token]);

  // Fetch Tests
  useEffect(() => {
    if (!["tests-draft", "tests-assigned"].includes(activeTab) || !classInfo?.id) return;
    const run = async () => {
      setLoadingTests(true); setTestsError("");
      try {
        const res = await fetch(`${BACKEND_URL}/api/exams?classId=${classInfo.id}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.msg || "Failed to load tests");
        if (Array.isArray(data)) setTests(data);
      } catch (err) { setTestsError(err.message); }
      finally { setLoadingTests(false); }
    };
    run();
  }, [activeTab, classInfo?.id]);

  // Schedule Exam
  const handleScheduleExam = async () => {
    if (!scheduleExamId || !scheduleStart || !scheduleEnd) {
      return setScheduleError("Please select start and end time.");
    }
    try {
      setScheduleLoading(true); setScheduleError("");
      const res = await fetch(`${BACKEND_URL}/api/exams/${scheduleExamId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ startTime: scheduleStart, endTime: scheduleEnd }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.msg || "Failed to schedule");
      setTests(prev => prev.map(t => t._id === data.exam._id ? data.exam : t));
      setScheduleExamId(null); setScheduleStart(""); setScheduleEnd("");
    } catch (err) { setScheduleError(err.message); }
    finally { setScheduleLoading(false); }
  };

  const renderStatusPill = (status) => {
    const cls = {
      Draft: "status-pill status-draft",
      Scheduled: "status-pill status-scheduled",
      Active: "status-pill status-active",
      Closed: "status-pill status-closed",
    }[status] || "status-pill status-unknown";
    return <span className={cls}>{status || "Unknown"}</span>;
  };

  const TABS = [
    { key: "ai-quiz", label: "🤖 AI Test Generator" },
    { key: "students", label: "👥 Students" },
    { key: "tests-draft", label: "📝 Draft Tests" },
    { key: "tests-assigned", label: "📋 Assigned Tests" },
  ];

  const draftTests = tests.filter(t => t.status === "Draft");
  const assignedTests = tests.filter(t => t.status !== "Draft");

  return (
    <div className="class-detail-view">

      {/* Header */}
      <div className="class-detail-header">
        <button className="back-btn" onClick={onBack}>← Back to Classes</button>
        <div className="class-detail-title-row">
          <div>
            <h2 className="class-detail-title">{classInfo.name}</h2>
            <span className="class-detail-subtitle">{classInfo.subject} • {classInfo.joinCode}</span>
          </div>
          <div className="class-detail-badges">
            <span className="badge badge-soft">{students.length} students</span>
            <span className="badge badge-soft">{tests.length} tests</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="class-detail-tabs">
        {TABS.map(t => (
          <button key={t.key} className={activeTab === t.key ? "tab active" : "tab"} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="class-detail-content">

        {/* AI QUIZ TAB */}
        {activeTab === "ai-quiz" && (
          <div className="tab-panel">
            <h3 className="panel-title">AI Test Generator</h3>
            <p className="panel-subtitle">
              Generate questions by topic or from uploaded content, review &amp; edit them, then save as a draft exam.
            </p>
            <AiTestGenerator
              classId={classInfo.id}
              onTestSaved={(exam) => {
                setTests(prev => [exam, ...prev]);
                setActiveTab("tests-draft");
              }}
            />
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === "students" && (
          <div className="tab-panel">
            <h3 className="panel-title">Students in {classInfo.name}</h3>
            {loadingStudents && <p className="muted-text">Loading students...</p>}
            {studentsError && <p className="error-text">{studentsError}</p>}
            {!loadingStudents && !studentsError && students.length === 0 && (
              <p className="muted-text">No students enrolled yet.</p>
            )}
            {students.length > 0 && (
              <table className="students-table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Join Date</th></tr>
                </thead>
                <tbody>
                  {students.map(st => (
                    <tr key={st.id}>
                      <td>{st.name}</td>
                      <td>{st.email}</td>
                      <td>{st.joinDate ? new Date(st.joinDate).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* DRAFT TESTS TAB */}
        {activeTab === "tests-draft" && (
          <div className="tab-panel">
            <h3 className="panel-title">Draft Tests</h3>
            {scheduleError && <p className="error-text">{scheduleError}</p>}
            {loadingTests && <p className="muted-text">Loading tests...</p>}
            {testsError && <p className="error-text">{testsError}</p>}
            {!loadingTests && draftTests.length === 0 && (
              <p className="muted-text">No draft tests yet. Create from AI Test Generator tab.</p>
            )}
            {draftTests.map(test => (
              <div key={test._id} className="assigned-test-card">
                <div className="test-header">
                  <h4>{test.title}</h4>
                  {renderStatusPill(test.status)}
                </div>
                <div className="test-meta">
                  <div className="meta-item"><strong>Questions:</strong> <span>{test.questions?.length || 0}</span></div>
                  <div className="meta-item">
                    <strong>Subject:</strong> <span>{test.subject || "—"}</span>
                  </div>
                  <div className="meta-item">
                    <strong>Start:</strong>
                    <span>{test.startTime ? new Date(test.startTime).toLocaleString() : "Not scheduled"}</span>
                  </div>
                  <div className="meta-item">
                    <strong>End:</strong>
                    <span>{test.endTime ? new Date(test.endTime).toLocaleString() : "Not scheduled"}</span>
                  </div>
                </div>

                {/* Schedule Section */}
                <div className="test-actions">
                  <div className="schedule-section">
                    <input
                      type="datetime-local"
                      value={scheduleExamId === test._id ? scheduleStart : ""}
                      onChange={e => { setScheduleExamId(test._id); setScheduleStart(e.target.value); }}
                    />
                    <input
                      type="datetime-local"
                      value={scheduleExamId === test._id ? scheduleEnd : ""}
                      onChange={e => { setScheduleExamId(test._id); setScheduleEnd(e.target.value); }}
                    />
                    <button
                      className="class-primary-btn"
                      disabled={scheduleLoading && scheduleExamId === test._id}
                      onClick={handleScheduleExam}
                    >
                      {scheduleLoading && scheduleExamId === test._id ? "Scheduling..." : "📅 Schedule"}
                    </button>
                  </div>
                  <button
                    className="class-secondary-btn"
                    onClick={() => setViewExamId(viewExamId === test._id ? null : test._id)}
                  >
                    {viewExamId === test._id ? "Hide Questions" : "👁 View Questions"}
                  </button>
                </div>

                {viewExamId === test._id && (
                  <div className="test-preview">
                    <ol>
                      {test.questions?.map((q, idx) => (
                        <li key={idx}>
                          <p><strong>Q{idx + 1}:</strong> {q.text}</p>
                          {q.type === "mcq" && q.options && (
                            <ul>
                              {q.options.map((opt, i) => (
                                <li key={i} style={opt === q.answer ? { color: "#059669", fontWeight: 600 } : {}}>
                                  {String.fromCharCode(65 + i)}. {opt}{opt === q.answer ? " ✓" : ""}
                                </li>
                              ))}
                            </ul>
                          )}
                          {q.teacher_answer && (
                            <p style={{ color: "#3b82f6", marginTop: "0.25rem" }}>
                              <strong>📖 Ref Answer:</strong> {q.teacher_answer}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ASSIGNED TESTS TAB */}
        {activeTab === "tests-assigned" && (
          <div className="tab-panel">
            <h3 className="panel-title">Assigned Tests</h3>
            {loadingTests && <p className="muted-text">Loading tests...</p>}
            {testsError && <p className="error-text">{testsError}</p>}
            {!loadingTests && assignedTests.length === 0 && (
              <p className="muted-text">No tests assigned yet. Schedule a draft test first.</p>
            )}
            {assignedTests.map(test => (
              <div key={test._id} className="assigned-test-card">
                <div className="test-header">
                  <h4>{test.title}</h4>
                  {renderStatusPill(test.status)}
                </div>
                <div className="test-meta">
                  <div className="meta-item"><strong>Start:</strong> <span>{test.startTime ? new Date(test.startTime).toLocaleString() : "—"}</span></div>
                  <div className="meta-item"><strong>End:</strong> <span>{test.endTime ? new Date(test.endTime).toLocaleString() : "—"}</span></div>
                  <div className="meta-item"><strong>Questions:</strong> <span>{test.questions?.length || 0}</span></div>
                </div>
                <div className="test-actions">
                  <button className="class-secondary-btn"
                    onClick={() => setViewExamId(viewExamId === test._id ? null : test._id)}>
                    {viewExamId === test._id ? "Hide" : "👁 View"}
                  </button>
                  <button className="class-primary-btn"
                    onClick={() => navigate(`/instructor-dashboard/exams/${test._id}/results`)}>
                    📊 View Results
                  </button>
                </div>
                {viewExamId === test._id && (
                  <div className="test-preview">
                    <ol>
                      {test.questions?.map((q, idx) => (
                        <li key={idx}>
                          <p><strong>Q{idx + 1}:</strong> {q.text}</p>
                          {q.type === "mcq" && q.options && (
                            <ul>
                              {q.options.map((opt, i) => (
                                <li key={i}>{String.fromCharCode(65 + i)}. {opt}</li>
                              ))}
                            </ul>
                          )}
                          {q.answer && <p><strong>Answer:</strong> {q.answer}</p>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}