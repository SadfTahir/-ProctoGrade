// src/components/InstructorComponents/AiTestGenerator.jsx
// ProctoGrade — v13.0
// ✅ Teacher → Version A + Version B (choose one before saving)
// ✅ Groq → Qwen fallback (handled in Colab)
// ✅ By Topic  → /api/exams/generate/teacher/by-topic
// ✅ By Content → /api/exams/generate/teacher/by-content (async job)

import React, { useState, useEffect } from "react";
import QuestionPreviewModal from "./QuestionPreviewModal";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const MAX_FILE_SIZE_MB    = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function AiTestGenerator({ classId, onTestSaved }) {
  const [mode, setMode] = useState("topic"); // "topic" | "content"

  // Shared
  const [questionType, setQuestionType]   = useState("mcq");
  const [numQuestions, setNumQuestions]   = useState(5);
  const [difficulty, setDifficulty]       = useState("medium");
  const [examTitle, setExamTitle]         = useState("");

  // By Topic
  const [subjects, setSubjects]               = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [topics, setTopics]                   = useState([]);
  const [selectedTopic, setSelectedTopic]     = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingTopics, setLoadingTopics]     = useState(false);

  // By Content
  const [uploadedFile, setUploadedFile]   = useState(null);
  const [uploadStatus, setUploadStatus]   = useState("idle");
  const [uploadMsg, setUploadMsg]         = useState("");
  const [contentTopic, setContentTopic]   = useState("");

  // Generation
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [generationInfo, setGenerationInfo] = useState(null);

  // ✅ DUAL VERSION STATE
  const [versionA, setVersionA]           = useState([]);
  const [versionB, setVersionB]           = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null); // "A" | "B" | null
  const [showVersionPicker, setShowVersionPicker] = useState(false);

  // Preview Modal
  const [showPreviewModal, setShowPreviewModal]   = useState(false);
  const [previewQuestions, setPreviewQuestions]   = useState([]);
  const [previewMetadata, setPreviewMetadata]     = useState(null);

  // Save
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => { fetchSubjects(); }, []);
  useEffect(() => {
    if (selectedSubject) fetchTopics(selectedSubject);
    else { setTopics([]); setSelectedTopic(""); }
  }, [selectedSubject]);

  const fetchSubjects = async () => {
    try {
      setLoadingSubjects(true);
      const res  = await fetch(`${BACKEND_URL}/api/exams/subjects`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.subjects)) setSubjects(data.subjects);
    } catch (e) { console.error("Subjects fetch error:", e); }
    finally { setLoadingSubjects(false); }
  };

  const fetchTopics = async (subjectName) => {
    try {
      setLoadingTopics(true); setSelectedTopic("");
      const res  = await fetch(`${BACKEND_URL}/api/exams/subjects/${encodeURIComponent(subjectName)}/topics`);
      const data = await res.json();
      if (res.ok && data.topics) setTopics(data.topics);
    } catch (e) { console.error("Topics fetch error:", e); }
    finally { setLoadingTopics(false); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0] || null;
    setUploadStatus("idle"); setUploadMsg(""); setUploadedFile(null);
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadMsg(`❌ File too large. Max ${MAX_FILE_SIZE_MB}MB.`);
      setUploadStatus("error"); e.target.value = ""; return;
    }
    const allowed = [".pdf", ".txt", ".md", ".docx", ".pptx"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadMsg("❌ Unsupported file. Use PDF, PPTX, DOCX, or TXT.");
      setUploadStatus("error"); e.target.value = ""; return;
    }
    setUploadedFile(file);
    setContentTopic(file.name.replace(/\.[^/.]+$/, ""));
  };

  const handleUpload = async () => {
    if (!uploadedFile) return setUploadMsg("Please select a file first.");
    try {
      setUploadStatus("uploading"); setUploadMsg("");
      const fd = new FormData();
      fd.append("file", uploadedFile);
      fd.append("subject", "General");
      fd.append("title", uploadedFile.name);

      const res  = await fetch(`${BACKEND_URL}/api/exams/content/upload`, { method: "POST", body: fd });
      const data = await res.json();

      if (res.ok && data.success) {
        setUploadStatus("done");
        setUploadMsg(`✅ Uploaded! ${data.chunks_added} chunks processed. Ready to generate!`);
      } else {
        setUploadStatus("error");
        setUploadMsg(data.msg || "Upload failed. Try again.");
      }
    } catch {
      setUploadStatus("error");
      setUploadMsg("Upload failed. Check AI service connection.");
    }
  };

  // ================================================================
  // ██  MAIN GENERATE — calls teacher dual-version endpoints
  // ================================================================
  const handleGenerate = async () => {
    setError(""); setGenerationInfo(null); setSaveMsg("");
    setVersionA([]); setVersionB([]); setSelectedVersion(null); setShowVersionPicker(false);

    if (mode === "topic") {
      if (!selectedSubject) return setError("Please select a subject.");
      if (!selectedTopic)   return setError("Please select a topic.");
    } else {
      if (!uploadedFile)           return setError("Please select a file.");
      if (uploadStatus !== "done") return setError("Please upload your file first.");
      if (!contentTopic.trim())    return setError("Please enter a topic.");
    }

    try {
      setLoading(true);
      let data;

      if (mode === "topic") {
        // ✅ Teacher: dual version by topic
        const res = await fetch(`${BACKEND_URL}/api/exams/generate/teacher/by-topic`, {
          method : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body   : JSON.stringify({
            subject      : selectedSubject,
            topic        : selectedTopic,
            question_type: questionType,
            num_questions: numQuestions,
            difficulty,
          }),
        });
        data = await res.json();
        if (!res.ok) return setError(data.msg || "Generation failed.");

      } else {
        // ✅ Teacher: dual version by content (async job)
        const res = await fetch(`${BACKEND_URL}/api/exams/generate/teacher/by-content`, {
          method : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body   : JSON.stringify({
            topic        : contentTopic.trim(),
            subject      : "General",
            question_type: questionType,
            num_questions: numQuestions,
            difficulty,
          }),
        });
        data = await res.json();
        if (!res.ok) return setError(data.msg || "Generation failed.");
      }

      // Validate
      if (!data.version_a?.length && !data.version_b?.length) {
        return setError("No questions generated. Try again.");
      }

      const info = {
        subject   : data.subject    || selectedSubject || "General",
        topic     : data.topic      || selectedTopic   || contentTopic || "Content",
        difficulty: data.difficulty || difficulty,
        type      : data.question_type || questionType,
      };

      setGenerationInfo(info);
      setExamTitle(`${info.topic} — ${info.difficulty} (${info.type.toUpperCase()})`);
      setVersionA(data.version_a || []);
      setVersionB(data.version_b || []);
      setShowVersionPicker(true); // ✅ Show A/B picker

    } catch (err) {
      console.error("Generation error:", err);
      setError(err.message || "Generation failed. Make sure Colab is running.");
    } finally {
      setLoading(false);
    }
  };

  // ================================================================
  // ██  VERSION SELECTION
  // ================================================================
  const handleSelectVersion = (version) => {
    setSelectedVersion(version);
    const questions = version === "A" ? versionA : versionB;
    setPreviewQuestions(questions);
    setPreviewMetadata({
      topic     : generationInfo?.topic,
      subject   : generationInfo?.subject,
      difficulty: generationInfo?.difficulty,
    });
    setShowVersionPicker(false);
    setShowPreviewModal(true);
  };

  const handleBackToVersionPicker = () => {
    setShowPreviewModal(false);
    setShowVersionPicker(true);
  };

  // ================================================================
  // ██  QUESTION EDIT / DELETE
  // ================================================================
  const handleEditQuestion   = (index, updated) =>
    setPreviewQuestions(prev => prev.map((q, i) => i === index ? updated : q));

  const handleDeleteQuestion = (index) =>
    setPreviewQuestions(prev => prev.filter((_, i) => i !== index));

  // ================================================================
  // ██  SAVE EXAM
  // ================================================================
  const handleConfirmSave = async () => {
    if (!examTitle.trim())        return setSaveMsg("Please enter an exam title.");
    if (!classId)                 return setSaveMsg("No class selected.");
    if (!previewQuestions.length) return setSaveMsg("No questions to save.");

    try {
      setSaving(true); setSaveMsg("");

      const res = await fetch(`${BACKEND_URL}/api/exams/save`, {
        method : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body   : JSON.stringify({
          classId,
          title  : examTitle.trim(),
          subject: generationInfo?.subject || "General",
          questions: previewQuestions,
          metadata: {
            topic      : generationInfo?.topic,
            difficulty : generationInfo?.difficulty,
            generatedAt: new Date(),
            mode,
            version    : selectedVersion, // ✅ save which version teacher chose
          },
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSaveMsg("✅ Exam saved!");
        if (onTestSaved) onTestSaved(data.exam);
        // Reset all state
        setShowPreviewModal(false);
        setShowVersionPicker(false);
        setPreviewQuestions([]); setPreviewMetadata(null);
        setGenerationInfo(null); setExamTitle("");
        setVersionA([]); setVersionB([]); setSelectedVersion(null);
        setUploadedFile(null); setUploadStatus("idle"); setUploadMsg("");
        setContentTopic("");
      } else {
        setSaveMsg(data.msg || "Failed to save.");
      }
    } catch {
      setSaveMsg("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPreview = () => {
    if (window.confirm("Discard generated questions?")) {
      setShowPreviewModal(false);
      setShowVersionPicker(false);
      setPreviewQuestions([]); setPreviewMetadata(null);
      setGenerationInfo(null);
      setVersionA([]); setVersionB([]); setSelectedVersion(null);
    }
  };

  const resetMode = (newMode) => {
    setMode(newMode); setError(""); setSaveMsg("");
    setGenerationInfo(null); setShowPreviewModal(false);
    setShowVersionPicker(false);
    setVersionA([]); setVersionB([]); setSelectedVersion(null);
  };

  // ================================================================
  // ██  RENDER
  // ================================================================
  return (
    <div style={s.wrap}>

      {/* ── Mode Toggle ─────────────────────────────────────────── */}
      <div style={s.toggleWrap}>
        <button
          style={{ ...s.toggleBtn, ...(mode === "topic" ? s.toggleActive : {}) }}
          onClick={() => resetMode("topic")}
        >
          📚 By Topic
        </button>
        <button
          style={{ ...s.toggleBtn, ...(mode === "content" ? s.toggleActive : {}) }}
          onClick={() => resetMode("content")}
        >
          📄 By Content
        </button>
      </div>

      <p style={s.modeDesc}>
        {mode === "topic"
          ? "Select subject & topic — AI generates two versions (A & B). You choose one for the exam."
          : "Upload your file — AI generates two versions (A & B) from your content."}
      </p>

      {/* ══ BY TOPIC ════════════════════════════════════════════ */}
      {mode === "topic" && (
        <div style={s.card}>
          <div style={s.fieldRow}>
            <div style={s.field}>
              <label style={s.label}>Subject <span style={s.req}>*</span></label>
              {loadingSubjects ? (
                <div style={s.placeholderField}>⏳ Loading subjects...</div>
              ) : subjects.length === 0 ? (
                <div style={s.errorField}>
                  ⚠️ No subjects.{" "}
                  <span style={s.retryLink} onClick={fetchSubjects}>Retry</span>
                </div>
              ) : (
                <select style={s.select} value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                  <option value="">— Select Subject —</option>
                  {subjects.map(sub => <option key={sub.id} value={sub.name}>{sub.name}</option>)}
                </select>
              )}
            </div>
            <div style={s.field}>
              <label style={s.label}>Topic <span style={s.req}>*</span></label>
              {loadingTopics ? (
                <div style={s.placeholderField}>⏳ Loading topics...</div>
              ) : (
                <select
                  style={{ ...s.select, opacity: !selectedSubject ? 0.5 : 1, cursor: !selectedSubject ? "not-allowed" : "pointer" }}
                  value={selectedTopic}
                  onChange={e => setSelectedTopic(e.target.value)}
                  disabled={!selectedSubject}
                >
                  <option value="">— Select Topic —</option>
                  {topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {!selectedSubject && <p style={s.hint}>Select a subject first</p>}
            </div>
          </div>

          {/* Info banner */}
          <div style={s.infoBox}>
            <span style={s.infoIcon}>✨</span>
            <span>
              AI will generate <strong>Version A + Version B</strong> — two different sets of questions on the same topic.
              You review both and choose which version to use for the exam.
            </span>
          </div>
        </div>
      )}

      {/* ══ BY CONTENT ══════════════════════════════════════════ */}
      {mode === "content" && (
        <div style={s.card}>
          <div style={s.stepHeader}>
            <span style={s.stepBadge}>Step 1</span>
            <span style={s.stepTitle}>Upload Your Content File</span>
          </div>

          <div style={s.field}>
            <label style={s.label}>
              File <span style={s.req}>*</span>
              <span style={s.fileSizeHint}> PDF, PPTX, DOCX, TXT — max {MAX_FILE_SIZE_MB}MB</span>
            </label>
            <label style={{
              ...s.dropzone,
              borderColor: uploadStatus === "done"  ? "#059669" : uploadStatus === "error" ? "#dc2626" : "#cbd5e1",
              background : uploadStatus === "done"  ? "#f0fdf4" : uploadStatus === "error" ? "#fef2f2" : "#f8fafc",
            }}>
              <input type="file" accept=".pdf,.txt,.md,.docx,.pptx" style={{ display: "none" }} onChange={handleFileChange} />
              <span style={s.dropIcon}>{uploadStatus === "done" ? "✅" : uploadStatus === "error" ? "❌" : "📁"}</span>
              <span style={s.dropText}>{uploadedFile ? uploadedFile.name : "Click to select file"}</span>
              <span style={s.dropHint}>{uploadedFile ? `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB` : `Max ${MAX_FILE_SIZE_MB}MB`}</span>
            </label>

            {uploadedFile && uploadStatus !== "done" && (
              <button
                style={{ ...s.uploadBtn, opacity: uploadStatus === "uploading" ? 0.6 : 1 }}
                onClick={handleUpload}
                disabled={uploadStatus === "uploading"}
              >
                {uploadStatus === "uploading" ? "⏳ Uploading to AI..." : "⬆️ Upload to AI"}
              </button>
            )}

            {uploadMsg && (
              <p style={{ ...s.hint, color: uploadStatus === "done" ? "#059669" : "#dc2626", fontWeight: 600, marginTop: "0.5rem" }}>
                {uploadMsg}
              </p>
            )}
          </div>

          {uploadStatus === "done" && (
            <>
              <div style={s.stepHeader}>
                <span style={s.stepBadge}>Step 2</span>
                <span style={s.stepTitle}>What topic should questions focus on?</span>
              </div>
              <div style={s.field}>
                <label style={s.label}>Topic / Focus Area <span style={s.req}>*</span></label>
                <input
                  style={s.input} type="text"
                  placeholder='e.g. "Machine Learning", "Chapter 3"'
                  value={contentTopic}
                  onChange={e => setContentTopic(e.target.value)}
                />
                <p style={s.hint}>AI will generate Version A + Version B from your uploaded content.</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ SHARED OPTIONS ══════════════════════════════════════ */}
      <div style={s.card}>
        <div style={s.fieldRow}>
          <div style={s.field}>
            <label style={s.label}>Question Type</label>
            <select style={s.select} value={questionType} onChange={e => setQuestionType(e.target.value)}>
              <option value="mcq">MCQ Only</option>
              <option value="short">Short Answer Only</option>
              <option value="mixed">Mixed (MCQ + Short)</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Difficulty</label>
            <select style={s.select} value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>No. of Questions</label>
            <select style={s.select} value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))}>
              {Array.from({ length: 20 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Error / Save message ──────────────────────────────── */}
      {error && <div style={s.errorBox}>⚠️ {error}</div>}
      {saveMsg && (
        <p style={{ color: saveMsg.startsWith("✅") ? "#059669" : "#dc2626", fontWeight: 700, textAlign: "center", margin: 0 }}>
          {saveMsg}
        </p>
      )}

      {/* ── Generate Button ──────────────────────────────────── */}
      <button
        style={{ ...s.genBtn, opacity: loading ? 0.7 : 1 }}
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? "⏳ Generating... (2–5 min)" : "✨ Generate Version A + B"}
      </button>

      {/* ── Loading indicator ─────────────────────────────────── */}
      {loading && (
        <div style={s.loadingBox}>
          <div style={s.spinner} />
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>🤖 Generating Version A + Version B...</p>
            <p style={{ margin: "4px 0 0", fontSize: "0.875rem", opacity: 0.8 }}>
              AI is creating two different question sets. Please wait 2–5 minutes.
            </p>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ██  VERSION PICKER — shown after generation                      */}
      {/* ================================================================ */}
      {showVersionPicker && (
        <div style={vp.overlay}>
          <div style={vp.modal}>

            {/* Header */}
            <div style={vp.header}>
              <div>
                <h2 style={vp.title}>Choose a Version for Your Exam</h2>
                <p style={vp.subtitle}>
                  Both versions cover <strong>{generationInfo?.topic}</strong> at <strong>{generationInfo?.difficulty}</strong> difficulty.
                  Review each and pick the one you want to use.
                </p>
              </div>
              <button style={vp.closeBtn} onClick={handleCancelPreview}>✕</button>
            </div>

            {/* Version cards */}
            <div style={vp.versionsRow}>

              {/* Version A */}
              <div style={vp.versionCard}>
                <div style={vp.versionHeader}>
                  <span style={{ ...vp.versionBadge, background: "#4f46e5" }}>Version A</span>
                  <span style={vp.questionCount}>{versionA.length} questions</span>
                </div>
                <div style={vp.questionList}>
                  {versionA.slice(0, 4).map((q, i) => (
                    <div key={i} style={vp.qItem}>
                      <span style={vp.qNum}>Q{i + 1}</span>
                      <span style={vp.qText}>{q.text?.slice(0, 90)}{q.text?.length > 90 ? "..." : ""}</span>
                      <span style={{ ...vp.typeBadge, background: q.type === "mcq" ? "#e0e7ff" : "#d1fae5", color: q.type === "mcq" ? "#4338ca" : "#065f46" }}>
                        {q.type?.toUpperCase()}
                      </span>
                    </div>
                  ))}
                  {versionA.length > 4 && (
                    <p style={vp.moreText}>+{versionA.length - 4} more questions...</p>
                  )}
                </div>
                <button style={{ ...vp.selectBtn, background: "linear-gradient(135deg,#6366f1,#4f46e5)" }} onClick={() => handleSelectVersion("A")}>
                  ✓ Use Version A
                </button>
              </div>

              {/* Divider */}
              <div style={vp.divider}>
                <div style={vp.dividerLine} />
                <span style={vp.dividerText}>OR</span>
                <div style={vp.dividerLine} />
              </div>

              {/* Version B */}
              <div style={vp.versionCard}>
                <div style={vp.versionHeader}>
                  <span style={{ ...vp.versionBadge, background: "#0891b2" }}>Version B</span>
                  <span style={vp.questionCount}>{versionB.length} questions</span>
                </div>
                <div style={vp.questionList}>
                  {versionB.slice(0, 4).map((q, i) => (
                    <div key={i} style={vp.qItem}>
                      <span style={vp.qNum}>Q{i + 1}</span>
                      <span style={vp.qText}>{q.text?.slice(0, 90)}{q.text?.length > 90 ? "..." : ""}</span>
                      <span style={{ ...vp.typeBadge, background: q.type === "mcq" ? "#e0e7ff" : "#d1fae5", color: q.type === "mcq" ? "#4338ca" : "#065f46" }}>
                        {q.type?.toUpperCase()}
                      </span>
                    </div>
                  ))}
                  {versionB.length > 4 && (
                    <p style={vp.moreText}>+{versionB.length - 4} more questions...</p>
                  )}
                </div>
                <button style={{ ...vp.selectBtn, background: "linear-gradient(135deg,#0891b2,#0e7490)" }} onClick={() => handleSelectVersion("B")}>
                  ✓ Use Version B
                </button>
              </div>
            </div>

            <p style={vp.footerNote}>
              💡 After selecting, you can edit individual questions, set marks, and add key concepts before saving.
            </p>
          </div>
        </div>
      )}

      {/* ── Preview Modal ─────────────────────────────────────── */}
      {showPreviewModal && (
        <QuestionPreviewModal
          questions={previewQuestions}
          metadata={previewMetadata}
          examTitle={examTitle}
          selectedVersion={selectedVersion}
          onExamTitleChange={setExamTitle}
          onConfirmSave={handleConfirmSave}
          onCancel={handleCancelPreview}
          onBack={handleBackToVersionPicker}
          onEditQuestion={handleEditQuestion}
          onDeleteQuestion={handleDeleteQuestion}
          loading={saving}
        />
      )}
    </div>
  );
}

// ── Main styles ──────────────────────────────────────────────────────────────
const s = {
  wrap         : { fontFamily: "'Plus Jakarta Sans','Outfit',sans-serif", display: "flex", flexDirection: "column", gap: "1.25rem" },
  toggleWrap   : { display: "flex", gap: "0.5rem", background: "#f1f5f9", padding: "0.375rem", borderRadius: "14px" },
  toggleBtn    : { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1rem", border: "none", borderRadius: "10px", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", transition: "all 0.2s", background: "transparent", color: "#64748b" },
  toggleActive : { background: "white", color: "#4f46e5", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" },
  modeDesc     : { margin: 0, color: "#64748b", fontSize: "0.875rem", fontWeight: 500 },
  card         : { background: "white", border: "1.5px solid #e2e8f0", borderRadius: "16px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  fieldRow     : { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1.25rem" },
  field        : { display: "flex", flexDirection: "column", gap: "0.5rem" },
  label        : { fontWeight: 600, fontSize: "0.875rem", color: "#374151" },
  req          : { color: "#ef4444" },
  fileSizeHint : { fontWeight: 400, fontSize: "0.78rem", color: "#94a3b8" },
  input        : { padding: "0.75rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontSize: "0.9rem", fontFamily: "inherit", outline: "none", color: "#111827" },
  select       : { padding: "0.75rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontSize: "0.9rem", fontFamily: "inherit", background: "white", color: "#111827", cursor: "pointer" },
  hint         : { fontSize: "0.8rem", color: "#94a3b8", margin: "0.25rem 0 0" },
  placeholderField: { padding: "0.75rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "10px", fontSize: "0.9rem", color: "#94a3b8", background: "#f8fafc" },
  errorField   : { padding: "0.75rem 1rem", border: "1.5px dashed #fca5a5", borderRadius: "10px", fontSize: "0.85rem", color: "#dc2626", background: "#fef2f2" },
  retryLink    : { color: "#4f46e5", cursor: "pointer", textDecoration: "underline", fontWeight: 600 },
  dropzone     : { display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem", border: "2px dashed #cbd5e1", borderRadius: "12px", cursor: "pointer", gap: "0.375rem", transition: "all 0.2s" },
  dropIcon     : { fontSize: "1.75rem" },
  dropText     : { fontWeight: 600, color: "#334155", fontSize: "0.9rem", textAlign: "center" },
  dropHint     : { fontSize: "0.78rem", color: "#94a3b8" },
  uploadBtn    : { marginTop: "0.5rem", padding: "0.65rem 1.25rem", background: "linear-gradient(135deg,#10b981,#059669)", color: "white", border: "none", borderRadius: "9px", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer", alignSelf: "flex-start" },
  errorBox     : { padding: "0.875rem 1.25rem", background: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: "12px", color: "#991b1b", fontWeight: 600, fontSize: "0.9rem" },
  genBtn       : { width: "100%", padding: "1rem", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "white", border: "none", borderRadius: "14px", fontWeight: 700, fontSize: "1rem", cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,0.3)", transition: "all 0.2s" },
  loadingBox   : { display: "flex", alignItems: "center", gap: "1rem", padding: "1.125rem 1.5rem", background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "12px", color: "#78350f" },
  spinner      : { width: "28px", height: "28px", border: "3px solid #fcd34d", borderTop: "3px solid #f59e0b", borderRadius: "50%", animation: "spin 0.9s linear infinite", flexShrink: 0 },
  stepHeader   : { display: "flex", alignItems: "center", gap: "0.5rem" },
  stepBadge    : { background: "#4f46e5", color: "white", borderRadius: "6px", padding: "2px 8px", fontSize: "0.75rem", fontWeight: 700 },
  stepTitle    : { fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" },
  infoBox      : { display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.75rem 1rem", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", fontSize: "0.85rem", color: "#1e40af", lineHeight: 1.5 },
  infoIcon     : { fontSize: "1rem", flexShrink: 0 },
};

// ── Version Picker styles ────────────────────────────────────────────────────
const vp = {
  overlay     : { position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" },
  modal       : { background: "white", borderRadius: "20px", width: "100%", maxWidth: "860px", maxHeight: "90vh", overflow: "auto", padding: "1.75rem", boxShadow: "0 25px 60px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", gap: "1.5rem" },
  header      : { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title       : { margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#111827" },
  subtitle    : { margin: "0.4rem 0 0", fontSize: "0.875rem", color: "#64748b", lineHeight: 1.5 },
  closeBtn    : { background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#94a3b8", flexShrink: 0 },
  versionsRow : { display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1rem", alignItems: "start" },
  versionCard : { background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "16px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" },
  versionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  versionBadge: { color: "white", borderRadius: "8px", padding: "4px 12px", fontSize: "0.85rem", fontWeight: 700 },
  questionCount: { fontSize: "0.8rem", color: "#64748b", fontWeight: 600 },
  questionList: { display: "flex", flexDirection: "column", gap: "0.6rem" },
  qItem       : { display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "white", borderRadius: "8px", border: "1px solid #e2e8f0" },
  qNum        : { fontSize: "0.72rem", fontWeight: 700, color: "#6d28d9", background: "#ede9fe", borderRadius: "4px", padding: "2px 6px", flexShrink: 0, marginTop: "1px" },
  qText       : { fontSize: "0.82rem", color: "#374151", lineHeight: 1.4, flex: 1 },
  typeBadge   : { fontSize: "0.68rem", fontWeight: 700, borderRadius: "4px", padding: "2px 6px", flexShrink: 0, marginTop: "1px" },
  moreText    : { margin: 0, fontSize: "0.8rem", color: "#94a3b8", textAlign: "center", padding: "0.25rem" },
  selectBtn   : { width: "100%", padding: "0.85rem", color: "white", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
  divider     : { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", paddingTop: "3rem" },
  dividerLine : { width: "1px", height: "60px", background: "#e2e8f0" },
  dividerText : { fontSize: "0.85rem", fontWeight: 700, color: "#94a3b8" },
  footerNote  : { margin: 0, textAlign: "center", fontSize: "0.82rem", color: "#64748b", padding: "0.5rem 1rem", background: "#f8fafc", borderRadius: "10px" },
};