// src/components/StudentComponents/StudentClassDetailView.jsx
// ProctoGrade — Student Class Detail View (v2.1)
// ✅ FIX: Draft exams ab students ko nazar nahi aayenge
//   - fetch mein token add kiya (auth required)
//   - frontend filter bhi case-insensitive kiya

import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function StudentClassDetailView() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [classInfo, setClassInfo] = useState(location.state?.classInfo || { id, name: "Class", subject: "" });
  const [activeTab, setActiveTab] = useState("tests");

  const [tests, setTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [testsError, setTestsError] = useState("");

  const [myAttempts, setMyAttempts] = useState([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  const token = localStorage.getItem("token");

  // ✅ FIX: Fetch tests — token add kiya taake backend Draft filter kare
  useEffect(() => {
    if (!id) return;
    const run = async () => {
      try {
        setLoadingTests(true); setTestsError("");
        const res = await fetch(`${BACKEND_URL}/api/exams?classId=${id}`, {
          headers: { Authorization: `Bearer ${token}` }, // ✅ token zaruri hai
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.msg || "Failed to load tests");
        if (Array.isArray(data)) {
          // ✅ FIX: case-insensitive Draft filter (backend bhi filter karega, yeh double safety)
          setTests(data.filter(t => t.status?.toLowerCase() !== "draft"));
        }
      } catch (err) { setTestsError(err.message); }
      finally { setLoadingTests(false); }
    };
    run();
  }, [id, token]);

  // Fetch this student's attempts
  useEffect(() => {
    if (!token) return;
    const run = async () => {
      try {
        setLoadingAttempts(true);
        const res = await fetch(`${BACKEND_URL}/api/exams/my-attempts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (res.ok && Array.isArray(data)) setMyAttempts(data);
      } catch (e) { console.error(e); }
      finally { setLoadingAttempts(false); }
    };
    run();
  }, [token]);

  const hasSubmitted = (examId) =>
    myAttempts.some(a =>
      a.examId === examId ||
      a.examId?._id === examId ||
      a.examId?.toString?.() === examId
    );

  const getTestStatus = (test) => {
    const now = new Date();
    const start = test.startTime ? new Date(test.startTime) : null;
    const end = test.endTime ? new Date(test.endTime) : null;
    if (!start || !end) return { label: test.status || "Scheduled", cls: "sl-badge-scheduled", canStart: false };
    if (now < start) return { label: "Upcoming", cls: "sl-badge-scheduled", canStart: false };
    if (now >= start && now <= end) return { label: "Active", cls: "sl-badge-active", canStart: true };
    return { label: "Closed", cls: "sl-badge-closed", canStart: false };
  };

  return (
    <div style={S.page}>
      <style>{css}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate("/student-dashboard")}>← Back</button>
        <div>
          <h2 style={S.title}>{classInfo?.name || "Class"}</h2>
          <p style={S.subtitle}>{classInfo?.subject || ""} • Class Details</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={S.tabBar}>
        <button className={`scdv-tab ${activeTab === "tests" ? "scdv-tab-active" : ""}`} onClick={() => setActiveTab("tests")}>
          📝 Tests
        </button>
        <button className={`scdv-tab ${activeTab === "stream" ? "scdv-tab-active" : ""}`} onClick={() => setActiveTab("stream")}>
          📢 Stream
        </button>
      </div>

      {/* ── TESTS TAB ── */}
      {activeTab === "tests" && (
        <div className="sl-fade">
          {(loadingTests || loadingAttempts) && <p style={S.muted}>Loading tests...</p>}
          {testsError && <p style={S.errorText}>{testsError}</p>}
          {!loadingTests && !testsError && tests.length === 0 && (
            <p style={S.muted}>No tests scheduled yet for this class.</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {tests.map(test => {
              const { label, cls, canStart } = getTestStatus(test);
              const submitted = hasSubmitted(test._id);
              const start = test.startTime ? new Date(test.startTime) : null;
              const end = test.endTime ? new Date(test.endTime) : null;

              return (
                <div key={test._id} style={S.testCard}>
                  <div style={S.testTop}>
                    <div>
                      <h4 style={S.testTitle}>{test.title}</h4>
                      {test.subject && <p style={S.testSub}>{test.subject}</p>}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span className={`sl-badge ${cls}`}>{label}</span>
                      {submitted && <span className="sl-badge sl-badge-submitted">✓ Submitted</span>}
                    </div>
                  </div>

                  <div style={S.testMeta}>
                    <span>📋 {test.questions?.length || 0} questions</span>
                    {start && <span>🕐 Start: {start.toLocaleString()}</span>}
                    {end && <span>🕑 End: {end.toLocaleString()}</span>}
                  </div>

                  <div style={{ marginTop: "1rem" }}>
                    <button
                      style={{
                        ...S.startBtn,
                        ...(submitted || !canStart ? S.startBtnDisabled : {}),
                      }}
                      disabled={!canStart || submitted}
                      onClick={() => navigate(`/student-dashboard/exams/${test._id}`, { state: { exam: test } })}
                    >
                      {submitted ? "✓ Already Submitted" : canStart ? "Start Test →" : "Not Available"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STREAM TAB ── */}
      {activeTab === "stream" && (
        <div className="sl-fade" style={S.emptyState}>
          <span style={{ fontSize: "3rem" }}>📢</span>
          <h3 style={{ margin: "0.75rem 0 0.5rem", color: "#111827" }}>No Announcements Yet</h3>
          <p style={{ color: "#64748b", margin: 0 }}>Announcements and materials from your instructor will appear here.</p>
        </div>
      )}
    </div>
  );
}

const S = {
  page: { fontFamily: "'Plus Jakarta Sans','Outfit',sans-serif", maxWidth: "900px", margin: "0 auto", padding: "2rem" },
  header: { display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2rem", padding: "1.5rem 2rem", background: "white", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" },
  backBtn: { padding: "0.625rem 1.25rem", background: "white", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontWeight: 600, cursor: "pointer", color: "#374151", fontSize: "0.9rem", whiteSpace: "nowrap" },
  title: { margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#111827" },
  subtitle: { margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.9rem" },
  tabBar: { display: "flex", gap: "0.5rem", background: "white", padding: "0.375rem", borderRadius: "14px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", marginBottom: "1.5rem" },
  testCard: { background: "white", border: "1.5px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  testTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "0.75rem" },
  testTitle: { margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#111827" },
  testSub: { margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#64748b" },
  testMeta: { display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.85rem", color: "#64748b" },
  startBtn: { padding: "0.75rem 1.5rem", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "white", border: "none", borderRadius: "10px", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" },
  startBtnDisabled: { background: "#e2e8f0", color: "#94a3b8", boxShadow: "none", cursor: "not-allowed" },
  muted: { color: "#94a3b8", textAlign: "center", padding: "2rem" },
  errorText: { color: "#dc2626", fontWeight: 600 },
  emptyState: { textAlign: "center", padding: "4rem 2rem", background: "white", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" },
};

const css = `
  .scdv-tab { flex:1; padding:0.75rem 1rem; border:none; background:transparent; border-radius:10px; fontWeight:600; font-size:0.9rem; color:#64748b; cursor:pointer; transition:all 0.2s; font-family:inherit; font-weight:600; }
  .scdv-tab:hover { background:#f1f5f9; }
  .scdv-tab-active { background:linear-gradient(135deg,#6366f1,#4f46e5) !important; color:white !important; box-shadow:0 4px 12px rgba(99,102,241,0.3); border-radius:10px; }
  .sl-badge { padding:0.3rem 0.875rem; border-radius:20px; font-size:0.78rem; font-weight:700; }
  .sl-badge-scheduled { background:#fef3c7; color:#92400e; }
  .sl-badge-active { background:#d1fae5; color:#065f46; }
  .sl-badge-closed { background:#fee2e2; color:#991b1b; }
  .sl-badge-submitted { background:#dbeafe; color:#1e40af; }
  .sl-fade { animation: slFade 0.35s ease-out; }
  @keyframes slFade { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
`;