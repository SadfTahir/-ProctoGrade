// src/components/StudentComponents/StudentSelfLearning.jsx
// ProctoGrade — Student Self Learning (By Topic + By Content)

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function StudentSelfLearning() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("learn");

  // ── Generation Mode ──
  const [mode, setMode] = useState("topic"); // "topic" | "content"

  // ── By Topic only ──
  const [subjects, setSubjects] = useState([]); // [{ id, name, topics[] }]
  const [selectedSubject, setSelectedSubject] = useState("");
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);

  // ── By Content only — no subject/topic fields ──
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle|uploading|done|error
  const [uploadMsg, setUploadMsg] = useState("");

  // ── Shared ──
  const [questionType, setQuestionType] = useState("mixed");
  const [numQuestions, setNumQuestions] = useState(5);

  // ── Generation ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState([]);

  // ── Practice ──
  const [attemptId, setAttemptId] = useState(null);
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // ── Results ──
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);

  // ── History ──
  const [pastAttempts, setPastAttempts] = useState([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => { fetchSubjects(); }, []);

  useEffect(() => {
    if (selectedSubject) fetchTopics(selectedSubject);
    else { setTopics([]); setSelectedTopic(""); }
  }, [selectedSubject]);

  useEffect(() => {
    if (activeTab === "history" && token) fetchPastAttempts();
  }, [activeTab, token]);

  // ── Fetch subjects — API returns { subjects: [{ id, name, topics[] }] } ──
  const fetchSubjects = async () => {
    try {
      setLoadingSubjects(true);
      const res = await fetch(`${BACKEND_URL}/api/exams/subjects`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.subjects)) setSubjects(data.subjects);
    } catch (e) { console.error("Subjects error:", e); }
    finally { setLoadingSubjects(false); }
  };

  const fetchTopics = async (subjectName) => {
    try {
      setLoadingTopics(true); setSelectedTopic("");
      const res = await fetch(`${BACKEND_URL}/api/exams/subjects/${encodeURIComponent(subjectName)}/topics`);
      const data = await res.json();
      if (res.ok && data.topics) setTopics(data.topics);
    } catch (e) { console.error("Topics error:", e); }
    finally { setLoadingTopics(false); }
  };

  // ── File selection with 5MB check ──
  const handleFileChange = (e) => {
    const file = e.target.files[0] || null;
    setUploadStatus("idle"); setUploadMsg(""); setUploadedFile(null);
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadMsg(`❌ File too large. Max ${MAX_FILE_SIZE_MB}MB. Yours: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      setUploadStatus("error"); e.target.value = ""; return;
    }
    const allowed = [".pdf", ".txt", ".md", ".doc", ".docx", ".ppt", ".pptx"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadMsg("❌ Unsupported file. Use PDF, Word, PPT, or TXT.");
      setUploadStatus("error"); e.target.value = ""; return;
    }
    setUploadedFile(file);
  };

  // ── Upload content — no subject required from student ──
  const handleUpload = async () => {
    if (!uploadedFile) return setUploadMsg("Please select a file first.");
    try {
      setUploadStatus("uploading"); setUploadMsg("");
      const fd = new FormData();
      fd.append("file", uploadedFile);
      fd.append("subject", "General"); // fixed, not shown to student
      fd.append("title", uploadedFile.name);
      const res = await fetch(`${BACKEND_URL}/api/exams/content/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploadStatus("done");
        setUploadMsg(`✅ Uploaded! ${data.chunks_added} chunks processed.`);
      } else {
        setUploadStatus("error");
        setUploadMsg(data.msg || "Upload failed. Try again.");
      }
    } catch { setUploadStatus("error"); setUploadMsg("Upload failed. Check connection."); }
  };

  // ── Generate questions ──
  const handleGenerate = async () => {
    setError(""); setGeneratedQuestions([]);

    if (mode === "topic") {
      if (!selectedSubject) return setError("Please select a subject.");
      if (!selectedTopic) return setError("Please select a topic.");
    } else {
      if (uploadStatus !== "done") return setError("Please upload your content first.");
    }

    try {
      setLoading(true);
      const endpoint = mode === "topic"
        ? `${BACKEND_URL}/api/exams/generate/by-topic`
        : `${BACKEND_URL}/api/exams/generate/by-content`;

      const body = mode === "topic"
        ? { subject: selectedSubject, topic: selectedTopic, question_type: questionType, num_questions: numQuestions, difficulty: "medium" }
        : { topic: uploadedFile?.name?.replace(/\.[^/.]+$/, "") || "Uploaded Content", subject: "General", question_type: questionType, num_questions: numQuestions, difficulty: "medium" };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.msg || "Generation failed. Try again.");
      if (!data.questions?.length) return setError("No questions generated. Try again.");
      setGeneratedQuestions(data.questions);
    } catch { setError("Generation failed. Check your connection."); }
    finally { setLoading(false); }
  };

  // ── Start practice session ──
  const handleStartPractice = async () => {
    if (!token) return alert("Please log in to start practice.");
    if (!generatedQuestions.length) return alert("Please generate questions first.");
    try {
      const res = await fetch(`${BACKEND_URL}/api/self-learning/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          topic: mode === "topic" ? selectedTopic : (uploadedFile?.name?.replace(/\.[^/.]+$/, "") || "Uploaded Content"),
          subject: mode === "topic" ? selectedSubject : "General",
          contentType: questionType,
          numQuestions: generatedQuestions.length,
          questions: generatedQuestions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.msg || data?.error || "Failed to start practice");

      const practiceQs = data.questions?.length
        ? data.questions
        : generatedQuestions.map((q, i) => ({ id: i.toString(), text: q.text, type: q.type, options: q.options || null }));

      setAttemptId(data.attemptId);
      setPracticeQuestions(practiceQs);
      setCurrentIndex(0); setAnswers({});
      setShowResults(false); setResults(null);
      setActiveTab("practice");
    } catch (err) { alert(err.message || "Error starting practice"); }
  };

  // ── Submit practice ──
  const handleSubmitPractice = async () => {
    if (!attemptId || !practiceQuestions.length) return;
    const allAttempted = practiceQuestions.every((q, i) => {
      const ans = answers[i.toString()];
      return q.type === "mcq" ? typeof ans === "number" : typeof ans === "string" && ans.trim().length > 0;
    });
    if (!allAttempted) return alert("Please attempt all questions before submitting.");
    try {
      setSubmitting(true);
      const payloadAnswers = practiceQuestions.map((q, i) => ({
        questionId: q.id || i.toString(),
        questionText: q.text,
        type: q.type,
        selectedOptionIndex: q.type === "mcq" ? answers[i.toString()] : undefined,
        textAnswer: q.type !== "mcq" ? answers[i.toString()] : undefined,
      }));
      const res = await fetch(`${BACKEND_URL}/api/self-learning/submit/${attemptId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers: payloadAnswers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.msg || "Failed to submit");
      setResults(data); setShowResults(true); setActiveTab("results");
    } catch (err) { alert(err.message || "Error submitting"); }
    finally { setSubmitting(false); }
  };

  const fetchPastAttempts = async () => {
    try {
      setLoadingAttempts(true);
      const res = await fetch(`${BACKEND_URL}/api/self-learning/my-attempts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setPastAttempts(data);
    } catch (e) { console.error(e); }
    finally { setLoadingAttempts(false); }
  };

  const viewDetailedResults = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/self-learning/attempt/${id}/results`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.msg || "Failed to load");
      setResults(data); setShowResults(true); setActiveTab("results");
    } catch (err) { alert(err.message || "Failed to load results"); }
  };

  const handleReset = () => {
    setGeneratedQuestions([]); setPracticeQuestions([]); setAttemptId(null);
    setCurrentIndex(0); setAnswers({}); setShowResults(false); setResults(null);
    setSelectedSubject(""); setSelectedTopic("");
    setUploadedFile(null); setUploadStatus("idle"); setUploadMsg("");
    setError(""); setActiveTab("learn");
  };

  const isAttempted = (i) => {
    const ans = answers[i.toString()];
    const q = practiceQuestions[i];
    if (!q) return false;
    return q.type === "mcq" ? typeof ans === "number" : typeof ans === "string" && ans.trim().length > 0;
  };

  const currentQuestion = practiceQuestions[currentIndex] || {};
  const selectedAnswer = answers[currentIndex.toString()];
  const attemptedCount = practiceQuestions.filter((_, i) => isAttempted(i)).length;

  return (
    <div style={S.page}>
      <style>{css}</style>

      {/* ── Tab Bar ── */}
      <div style={S.tabBar}>
        {[
          { key: "learn", icon: "📚", label: "Learn" },
          ...(practiceQuestions.length > 0 && !showResults ? [{ key: "practice", icon: "🎯", label: "Practice" }] : []),
          ...(showResults ? [{ key: "results", icon: "📊", label: "Results" }] : []),
          { key: "history", icon: "📜", label: "History" },
        ].map(t => (
          <button key={t.key} className={`sl-tab ${activeTab === t.key ? "sl-tab-active" : ""}`} onClick={() => setActiveTab(t.key)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ LEARN TAB ══════════ */}
      {activeTab === "learn" && (
        <div className="sl-fade">
          <div style={S.heroBanner}>
            <h1 style={S.heroTitle}>AI-Powered Self Learning</h1>
            <p style={S.heroSub}>Master any topic with AI-generated practice questions</p>
          </div>

          <div style={S.card}>
            {/* Mode Toggle */}
            <div style={S.modeToggle}>
              <button className={`sl-mode-btn ${mode === "topic" ? "sl-mode-active" : ""}`}
                onClick={() => { setMode("topic"); setError(""); setGeneratedQuestions([]); }}>
                📚 By Topic
              </button>
              <button className={`sl-mode-btn ${mode === "content" ? "sl-mode-active" : ""}`}
                onClick={() => { setMode("content"); setError(""); setGeneratedQuestions([]); }}>
                📄 By Content
              </button>
            </div>
            <p style={S.modeDesc}>
              {mode === "topic"
                ? "Select a subject & topic — AI generates questions from its knowledge."
                : "Upload your notes or PDF (max 5MB) — AI generates questions from your content."}
            </p>

            {/* ══ BY TOPIC — Subject → Topic ══ */}
            {mode === "topic" && (
              <div style={S.formSection}>
                <div style={S.fieldRow}>
                  {/* Subject */}
                  <div style={S.field}>
                    <label style={S.label}>Subject <span style={S.req}>*</span></label>
                    {loadingSubjects ? (
                      <div style={S.placeholderField}>⏳ Loading subjects...</div>
                    ) : subjects.length === 0 ? (
                      <div style={S.errorField}>
                        ⚠️ No subjects.{" "}
                        <span style={S.retryLink} onClick={fetchSubjects}>Retry</span>
                      </div>
                    ) : (
                      <select style={S.select} value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                        <option value="">— Select Subject —</option>
                        {/* ✅ sub = { id, name, topics[] } */}
                        {subjects.map(sub => (
                          <option key={sub.id} value={sub.name}>{sub.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {/* Topic */}
                  <div style={S.field}>
                    <label style={S.label}>Topic <span style={S.req}>*</span></label>
                    {loadingTopics ? (
                      <div style={S.placeholderField}>⏳ Loading topics...</div>
                    ) : (
                      <select
                        style={{ ...S.select, opacity: !selectedSubject ? 0.5 : 1, cursor: !selectedSubject ? "not-allowed" : "pointer" }}
                        value={selectedTopic}
                        onChange={e => setSelectedTopic(e.target.value)}
                        disabled={!selectedSubject}
                      >
                        <option value="">— Select Topic —</option>
                        {topics.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                    {!selectedSubject && <p style={S.hint}>Select a subject first</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ══ BY CONTENT — Upload only ══ */}
            {mode === "content" && (
              <div style={S.formSection}>
                <div style={S.field}>
                  <label style={S.label}>
                    Upload Notes <span style={S.req}>*</span>
                    <span style={S.fileSizeHint}> PDF, Word, PPT, TXT — max {MAX_FILE_SIZE_MB}MB</span>
                  </label>
                  <label style={{
                    ...S.dropzone,
                    borderColor: uploadStatus === "done" ? "#059669" : uploadStatus === "error" ? "#dc2626" : "#cbd5e1",
                    background: uploadStatus === "done" ? "#f0fdf4" : uploadStatus === "error" ? "#fef2f2" : "#f8fafc",
                  }}>
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,.doc,.docx,.ppt,.pptx"
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />
                    <span style={{ fontSize: "2rem" }}>
                      {uploadStatus === "done" ? "✅" : uploadStatus === "error" ? "❌" : "📁"}
                    </span>
                    <span style={{ fontWeight: 600, color: "#334155" }}>
                      {uploadedFile ? uploadedFile.name : "Click to select file"}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                      {uploadedFile ? `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB` : `Max ${MAX_FILE_SIZE_MB}MB`}
                    </span>
                  </label>
                  {uploadedFile && uploadStatus !== "done" && (
                    <button
                      style={{ ...S.uploadBtn, opacity: uploadStatus === "uploading" ? 0.6 : 1 }}
                      onClick={handleUpload} disabled={uploadStatus === "uploading"}
                    >
                      {uploadStatus === "uploading" ? "⏳ Uploading..." : "⬆️ Upload to AI"}
                    </button>
                  )}
                  {uploadMsg && (
                    <p style={{ fontSize: "0.85rem", color: uploadStatus === "done" ? "#059669" : "#dc2626", fontWeight: 600, marginTop: "0.4rem" }}>
                      {uploadMsg}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ══ SHARED — Type + No. of Questions ══ */}
            <div style={S.fieldRow}>
              <div style={S.field}>
                <label style={S.label}>Question Type</label>
                <select style={S.select} value={questionType} onChange={e => setQuestionType(e.target.value)}>
                  <option value="mixed">Mixed (Recommended)</option>
                  <option value="mcq">MCQ Only</option>
                  <option value="short">Short Answer Only</option>
                </select>
              </div>
              <div style={S.field}>
                <label style={S.label}>No. of Questions</label>
                <select style={S.select} value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))}>
                  {Array.from({ length: 15 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            {error && <div style={S.errorBox}>⚠️ {error}</div>}

            <button style={{ ...S.genBtn, opacity: loading ? 0.7 : 1 }} onClick={handleGenerate} disabled={loading}>
              {loading ? <><span className="sl-spinner" /> Generating...</> : "✨ Generate Questions"}
            </button>

            {loading && (
              <div style={S.loadingBox}>
                <p style={{ margin: 0, fontWeight: 700 }}>🤖 AI is generating your questions...</p>
                <p style={{ margin: "4px 0 0", fontSize: "0.875rem", opacity: 0.8 }}>This may take 2–5 minutes.</p>
              </div>
            )}

            {/* Preview */}
            {generatedQuestions.length > 0 && (
              <div style={S.previewBox}>
                <div style={S.previewTop}>
                  <div>
                    <h4 style={{ margin: 0, color: "#1e40af", fontWeight: 700 }}>
                      📚 {generatedQuestions.length} Questions Ready
                    </h4>
                    <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.875rem" }}>Review below, then start practice</p>
                  </div>
                  <button style={S.startBtn} onClick={handleStartPractice}>🎯 Start Practice Mode</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {generatedQuestions.map((q, i) => (
                    <div key={i} style={S.qPreviewCard}>
                      <div style={{ display: "flex", gap: "0.625rem", marginBottom: "0.75rem" }}>
                        <span style={S.qNum}>Q{i + 1}</span>
                        <span style={{ ...S.qBadge, background: q.type === "mcq" ? "#fef3c7" : "#dbeafe", color: q.type === "mcq" ? "#92400e" : "#1e40af" }}>
                          {q.type === "mcq" ? "MCQ" : "Short Answer"}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 500, color: "#111827", lineHeight: 1.6 }}>{q.text}</p>
                      {q.type === "mcq" && q.options && (
                        <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          {q.options.map((opt, j) => (
                            <li key={j} style={{ padding: "0.5rem 0.875rem", background: "white", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "0.875rem", display: "flex", gap: "0.5rem" }}>
                              <span style={{ fontWeight: 700, color: "#6366f1" }}>{String.fromCharCode(65 + j)}.</span> {opt}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ PRACTICE TAB ══════════ */}
      {activeTab === "practice" && practiceQuestions.length > 0 && (
        <div className="sl-fade">
          <div style={S.practiceHeader}>
            <div>
              <h2 style={{ margin: 0, fontWeight: 700, fontSize: "1.5rem" }}>Practice Mode</h2>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.9rem" }}>
                {attemptedCount} of {practiceQuestions.length} answered
              </p>
            </div>
            <div style={{ flex: 1, maxWidth: "400px" }}>
              <div style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "0.4rem", textAlign: "right" }}>
                Q{currentIndex + 1} / {practiceQuestions.length}
              </div>
              <div style={S.progressBar}>
                <div style={{ ...S.progressFill, width: `${((currentIndex + 1) / practiceQuestions.length) * 100}%` }} />
              </div>
            </div>
          </div>

          <div style={S.practiceLayout}>
            {/* Sidebar */}
            <div style={S.qNav}>
              <p style={{ margin: "0 0 0.75rem", fontWeight: 700, fontSize: "0.9rem", color: "#374151" }}>Questions</p>
              <div style={S.pillGrid}>
                {practiceQuestions.map((_, i) => (
                  <button key={i}
                    style={{ ...S.pill, ...(i === currentIndex ? S.pillActive : {}), ...(isAttempted(i) && i !== currentIndex ? S.pillDone : {}) }}
                    onClick={() => setCurrentIndex(i)}
                  >
                    {i + 1}
                    {isAttempted(i) && <span style={S.pillCheck}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Area */}
            <div style={S.qArea}>
              <p style={S.qText}>{currentQuestion.text}</p>

              {currentQuestion.type === "mcq" && currentQuestion.options ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {currentQuestion.options.map((opt, i) => (
                    <li key={i}
                      style={{ ...S.optItem, ...(selectedAnswer === i ? S.optSelected : {}) }}
                      onClick={() => setAnswers(prev => ({ ...prev, [currentIndex.toString()]: i }))}
                    >
                      <span style={S.optLetter}>{String.fromCharCode(65 + i)}</span>
                      <span style={{ flex: 1 }}>{opt}</span>
                      {selectedAnswer === i && <span style={{ color: "#6366f1", fontWeight: 700 }}>✓</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label style={S.label}>Your Answer:</label>
                  <textarea
                    style={{ ...S.input, minHeight: "140px", resize: "vertical", lineHeight: 1.6 }}
                    placeholder="Type your answer here..."
                    value={selectedAnswer || ""}
                    onChange={e => setAnswers(prev => ({ ...prev, [currentIndex.toString()]: e.target.value }))}
                    maxLength={500}
                  />
                  <span style={{ fontSize: "0.8rem", color: "#94a3b8", textAlign: "right" }}>
                    {(selectedAnswer || "").length}/500
                  </span>
                </div>
              )}

              <div style={S.navBtns}>
                <button style={S.navBtn} onClick={() => setCurrentIndex(i => i - 1)} disabled={currentIndex === 0}>← Previous</button>
                {currentIndex < practiceQuestions.length - 1 ? (
                  <button style={S.navBtnPrimary} onClick={() => setCurrentIndex(i => i + 1)}>Next →</button>
                ) : (
                  <button style={{ ...S.navBtnSuccess, opacity: submitting ? 0.7 : 1 }} onClick={handleSubmitPractice} disabled={submitting}>
                    {submitting ? "Submitting..." : "✓ Submit Practice"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ RESULTS TAB ══════════ */}
      {activeTab === "results" && showResults && results && (
        <div className="sl-fade">
          <div style={S.resultsHero}>
            <div style={S.scoreCircle}>
              <span style={{ fontSize: "3rem", fontWeight: 800 }}>{results.summary?.score ?? results.score}%</span>
              <span style={{ fontSize: "0.9rem", opacity: 0.9 }}>Score</span>
            </div>
            <div style={{ color: "white", textAlign: "center" }}>
              <h2 style={{ margin: "0 0 0.5rem", fontSize: "2rem", fontWeight: 800 }}>Practice Complete!</h2>
              <p style={{ margin: 0, fontSize: "1.1rem" }}>
                {results.summary?.correctAnswers ?? results.correctAnswers} / {results.summary?.totalQuestions ?? results.totalQuestions} correct
              </p>
              <p style={{ margin: "0.25rem 0 0", opacity: 0.9 }}>
                {results.summary?.totalScore ?? results.totalScore} / {results.summary?.maxScore ?? results.maxScore} points
              </p>
            </div>
          </div>

          {(results.breakdown || results.answers) && (
            <div style={S.card}>
              <h3 style={{ margin: "0 0 1.5rem", fontSize: "1.25rem", fontWeight: 700 }}>📋 Detailed Breakdown</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {(results.breakdown || results.answers).map((item, i) => (
                  <div key={i} style={{ ...S.resultCard, borderColor: item.isCorrect ? "#4ade80" : "#f87171", background: item.isCorrect ? "#f0fdf4" : "#fff1f2" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                      <span style={{ fontWeight: 700, color: "#6366f1" }}>Question {i + 1}</span>
                      <span style={{ ...S.resultBadge, background: item.isCorrect ? "#16a34a" : "#dc2626" }}>
                        {item.pointsAwarded ?? 0} / {item.maxPoints ?? 10} pts
                      </span>
                    </div>
                    <p style={{ margin: "0 0 1rem", fontWeight: 600, color: "#111827", lineHeight: 1.6 }}>{item.questionText}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div style={{ ...S.ansBox, borderColor: "#6366f1", background: "#eff6ff" }}>
                        <strong style={S.ansLabel}>Your Answer</strong>
                        <p style={{ margin: 0 }}>{typeof item.studentAnswer === "number" ? `Option ${item.studentAnswer + 1}` : item.studentAnswer || "(No answer)"}</p>
                      </div>
                      {item.correctAnswer && (
                        <div style={{ ...S.ansBox, borderColor: "#16a34a", background: "#f0fdf4" }}>
                          <strong style={S.ansLabel}>Correct Answer</strong>
                          <p style={{ margin: 0 }}>{item.correctAnswer}</p>
                        </div>
                      )}
                      <div style={{ ...S.ansBox, borderColor: "#f59e0b", background: "#fef3c7" }}>
                        <strong style={S.ansLabel}>Feedback</strong>
                        <p style={{ margin: 0 }}>{item.feedback || item.aiGradingFeedback || "No feedback"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button style={{ ...S.genBtn, marginTop: "1.5rem" }} onClick={handleReset}>🔄 Start New Practice</button>
        </div>
      )}

      {/* ══════════ HISTORY TAB ══════════ */}
      {activeTab === "history" && (
        <div className="sl-fade">
          <div style={S.heroBanner}>
            <h1 style={S.heroTitle}>Practice History</h1>
            <p style={S.heroSub}>Track your learning progress over time</p>
          </div>
          <div style={S.card}>
            {loadingAttempts && (
              <div style={{ textAlign: "center", padding: "3rem" }}>
                <span className="sl-spinner-large" />
                <p style={{ color: "#64748b" }}>Loading history...</p>
              </div>
            )}
            {!loadingAttempts && pastAttempts.length === 0 && (
              <div style={{ textAlign: "center", padding: "3rem" }}>
                <span style={{ fontSize: "4rem" }}>📚</span>
                <h3 style={{ color: "#111827", margin: "1rem 0 0.5rem" }}>No Practice Sessions Yet</h3>
                <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>Start learning to build your history!</p>
                <button style={S.startBtn} onClick={() => setActiveTab("learn")}>Start Learning</button>
              </div>
            )}
            {!loadingAttempts && pastAttempts.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {pastAttempts.map(attempt => (
                  <div key={attempt._id} style={S.historyCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                      <div>
                        <h4 style={{ margin: "0 0 0.375rem", fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>{attempt.topic}</h4>
                        <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.85rem", color: "#64748b", flexWrap: "wrap" }}>
                          <span>{attempt.subject}</span>
                          <span>•</span>
                          <span>{attempt.totalQuestions} questions</span>
                          <span>•</span>
                          <span>{attempt.correctAnswers || 0} correct</span>
                          <span>•</span>
                          <span>{new Date(attempt.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: "2rem", fontWeight: 800, color: "#6366f1", flexShrink: 0 }}>{attempt.score}%</span>
                    </div>
                    {attempt.status === "completed" && (
                      <button style={{ ...S.navBtn, marginTop: "0.875rem", alignSelf: "flex-start" }}
                        onClick={() => viewDetailedResults(attempt._id)}>
                        📊 View Details
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  page: { fontFamily: "'Plus Jakarta Sans','Outfit',sans-serif", maxWidth: "1200px", margin: "0 auto", padding: "2rem", minHeight: "100vh", background: "linear-gradient(135deg,#f8f9ff 0%,#fef3f7 100%)" },
  tabBar: { display: "flex", gap: "0.5rem", background: "white", padding: "0.4rem", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", marginBottom: "2rem" },
  heroBanner: { textAlign: "center", padding: "2.5rem 2rem", background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)", borderRadius: "20px", color: "white", marginBottom: "2rem", boxShadow: "0 16px 32px rgba(99,102,241,0.25)" },
  heroTitle: { margin: "0 0 0.5rem", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.02em" },
  heroSub: { margin: 0, fontSize: "1.05rem", opacity: 0.92 },
  card: { background: "white", borderRadius: "20px", padding: "2rem", boxShadow: "0 8px 24px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", gap: "1.5rem" },
  modeToggle: { display: "flex", gap: "0.5rem", background: "#f1f5f9", padding: "0.375rem", borderRadius: "12px" },
  modeDesc: { margin: 0, color: "#64748b", fontSize: "0.875rem", fontWeight: 500 },
  formSection: { display: "flex", flexDirection: "column", gap: "1.25rem", padding: "1.25rem", background: "#f8fafc", borderRadius: "14px", border: "1.5px solid #e2e8f0" },
  fieldRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "1.25rem" },
  field: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  label: { fontWeight: 600, fontSize: "0.875rem", color: "#374151" },
  req: { color: "#ef4444" },
  fileSizeHint: { fontWeight: 400, fontSize: "0.78rem", color: "#94a3b8" },
  input: { padding: "0.75rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", color: "#111827", background: "white" },
  select: { padding: "0.75rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontSize: "0.9rem", fontFamily: "inherit", background: "white", color: "#111827", cursor: "pointer" },
  hint: { fontSize: "0.8rem", color: "#94a3b8", margin: 0 },
  placeholderField: { padding: "0.75rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontSize: "0.9rem", color: "#94a3b8", background: "#f8fafc" },
  errorField: { padding: "0.75rem 1rem", border: "1.5px dashed #fca5a5", borderRadius: "10px", fontSize: "0.85rem", color: "#dc2626", background: "#fef2f2" },
  retryLink: { color: "#4f46e5", cursor: "pointer", textDecoration: "underline", fontWeight: 600 },
  dropzone: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem", padding: "1.5rem", border: "2px dashed #cbd5e1", borderRadius: "12px", cursor: "pointer", transition: "all 0.2s" },
  uploadBtn: { padding: "0.65rem 1.25rem", background: "linear-gradient(135deg,#10b981,#059669)", color: "white", border: "none", borderRadius: "9px", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer", alignSelf: "flex-start" },
  errorBox: { padding: "0.875rem 1.25rem", background: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: "12px", color: "#991b1b", fontWeight: 600, fontSize: "0.9rem" },
  genBtn: { width: "100%", padding: "1rem", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "white", border: "none", borderRadius: "14px", fontWeight: 700, fontSize: "1rem", cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" },
  loadingBox: { padding: "1rem 1.5rem", background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "12px", color: "#78350f", textAlign: "center" },
  previewBox: { padding: "1.5rem", background: "linear-gradient(135deg,#eff6ff,#f5f3ff)", borderRadius: "16px", border: "2px solid #c7d2fe", display: "flex", flexDirection: "column", gap: "1.25rem" },
  previewTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" },
  startBtn: { padding: "0.875rem 1.5rem", background: "linear-gradient(135deg,#10b981,#059669)", color: "white", border: "none", borderRadius: "12px", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.25)", whiteSpace: "nowrap" },
  qPreviewCard: { background: "white", border: "1.5px solid #e2e8f0", borderRadius: "14px", padding: "1.25rem" },
  qNum: { background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "white", padding: "0.3rem 0.75rem", borderRadius: "20px", fontWeight: 700, fontSize: "0.8rem" },
  qBadge: { padding: "0.3rem 0.75rem", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 700 },
  practiceHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "2rem", background: "white", padding: "1.5rem 2rem", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", marginBottom: "1.5rem", flexWrap: "wrap" },
  progressBar: { height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" },
  progressFill: { height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", transition: "width 0.3s ease" },
  practiceLayout: { display: "grid", gridTemplateColumns: "220px 1fr", gap: "1.5rem" },
  qNav: { background: "white", padding: "1.25rem", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", alignSelf: "flex-start", position: "sticky", top: "1.5rem" },
  pillGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.5rem" },
  pill: { padding: "0.6rem", border: "1.5px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem", position: "relative", color: "#374151" },
  pillActive: { background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "white", borderColor: "transparent", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" },
  pillDone: { borderColor: "#4ade80", background: "#f0fdf4", color: "#166534" },
  pillCheck: { position: "absolute", top: "-5px", right: "-5px", width: "14px", height: "14px", background: "#16a34a", borderRadius: "50%", color: "white", fontSize: "0.55rem", display: "flex", alignItems: "center", justifyContent: "center" },
  qArea: { background: "white", borderRadius: "16px", padding: "2rem", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: "1.5rem" },
  qText: { margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#111827", lineHeight: 1.7 },
  optItem: { display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "12px", cursor: "pointer", transition: "all 0.15s", background: "#f8fafc", fontSize: "0.9rem" },
  optSelected: { background: "#eff6ff", borderColor: "#6366f1", boxShadow: "0 0 0 3px rgba(99,102,241,0.1)" },
  optLetter: { fontWeight: 700, color: "#6366f1", width: "28px", height: "28px", background: "#eff0ff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", flexShrink: 0 },
  navBtns: { display: "flex", justifyContent: "space-between", gap: "1rem", marginTop: "0.5rem" },
  navBtn: { padding: "0.75rem 1.5rem", background: "white", border: "1.5px solid #6366f1", color: "#6366f1", borderRadius: "12px", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" },
  navBtnPrimary: { padding: "0.75rem 1.5rem", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "white", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" },
  navBtnSuccess: { padding: "0.75rem 1.5rem", background: "linear-gradient(135deg,#10b981,#059669)", color: "white", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" },
  resultsHero: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", padding: "3rem 2rem", borderRadius: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem", marginBottom: "2rem", boxShadow: "0 16px 32px rgba(99,102,241,0.25)" },
  scoreCircle: { width: "160px", height: "160px", background: "rgba(255,255,255,0.2)", borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "4px solid rgba(255,255,255,0.3)" },
  resultCard: { padding: "1.5rem", border: "2px solid", borderRadius: "14px" },
  resultBadge: { color: "white", padding: "0.3rem 0.875rem", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 700 },
  ansBox: { padding: "1rem", border: "1.5px solid", borderRadius: "10px" },
  ansLabel: { display: "block", marginBottom: "0.375rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280" },
  historyCard: { padding: "1.5rem", background: "white", border: "1.5px solid #e2e8f0", borderRadius: "14px", display: "flex", flexDirection: "column", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
};

const css = `
  .sl-tab { flex:1; padding:0.75rem 1rem; border:none; background:transparent; border-radius:10px; font-weight:600; font-size:0.9rem; color:#64748b; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.5rem; transition:all 0.2s; }
  .sl-tab:hover { background:#f1f5f9; color:#1e293b; }
  .sl-tab-active { background:linear-gradient(135deg,#6366f1,#4f46e5) !important; color:white !important; box-shadow:0 4px 12px rgba(99,102,241,0.3); }
  .sl-mode-btn { flex:1; padding:0.7rem 1rem; border:none; border-radius:10px; font-weight:600; font-size:0.9rem; cursor:pointer; transition:all 0.2s; background:transparent; color:#64748b; }
  .sl-mode-btn:hover { background:#e2e8f0; }
  .sl-mode-active { background:white !important; color:#4f46e5 !important; box-shadow:0 2px 8px rgba(0,0,0,0.1); }
  .sl-fade { animation: slFade 0.35s ease-out; }
  @keyframes slFade { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .sl-spinner { display:inline-block; width:16px; height:16px; border:3px solid rgba(255,255,255,0.3); border-top-color:white; border-radius:50%; animation:sl-spin 0.7s linear infinite; }
  .sl-spinner-large { display:inline-block; width:40px; height:40px; border:4px solid #e2e8f0; border-top-color:#6366f1; border-radius:50%; animation:sl-spin 0.7s linear infinite; margin-bottom:1rem; }
  @keyframes sl-spin { to { transform:rotate(360deg); } }
  @media (max-width: 768px) { .sl-tab { font-size:0.8rem; padding:0.6rem 0.5rem; } }
`;