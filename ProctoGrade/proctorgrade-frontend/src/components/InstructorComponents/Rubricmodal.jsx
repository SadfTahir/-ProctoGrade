// src/components/InstructorComponents/RubricModal.jsx
// Optional rubric definition — teacher can define criteria per short-answer question
// Uses AI suggest + manual entry. Weights must sum to 1.0

import React, { useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function RubricModal({ examId, questions, onClose, onSaved }) {
  const token = localStorage.getItem("token");

  // Only short-answer questions get rubrics
  const gradableQs = questions
    .map((q, i) => ({ ...q, originalIndex: i }))
    .filter(q => q.type !== "mcq");

  const [rubrics, setRubrics] = useState(() =>
    gradableQs.reduce((acc, q) => {
      acc[q.originalIndex] = {
        criteria   : [],
        total_marks: parseFloat(q.max_marks) || 10,
      };
      return acc;
    }, {})
  );

  const [activeIndex, setActiveIndex]     = useState(gradableQs[0]?.originalIndex ?? 0);
  const [loadingSuggest, setLoadingSuggest] = useState({});
  const [saving, setSaving]               = useState(false);
  const [saveMsg, setSaveMsg]             = useState("");

  const activeQ = gradableQs.find(q => q.originalIndex === activeIndex);

  // ── AI suggest rubric ────────────────────────────────────────
  const handleSuggest = async (qIdx) => {
    const q = questions[qIdx];
    setLoadingSuggest(p => ({ ...p, [qIdx]: true }));
    try {
      const res = await fetch(`${BACKEND_URL}/api/exams/rubric/suggest`, {
        method : "POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body   : JSON.stringify({
          question_text: q.text,
          max_marks    : parseFloat(q.max_marks) || 10,
          subject      : q.subject || "General",
        }),
      });
      const data = await res.json();
      if (res.ok && data.suggested?.length > 0) {
        setRubrics(p => ({
          ...p,
          [qIdx]: { criteria: data.suggested.map(c => ({...c, _id: Math.random()})), total_marks: data.total_marks },
        }));
      }
    } catch (e) { console.error("Suggest error:", e); }
    finally { setLoadingSuggest(p => ({ ...p, [qIdx]: false })); }
  };

  // ── Add empty criterion ──────────────────────────────────────
  const handleAdd = (qIdx) => {
    const existing   = rubrics[qIdx]?.criteria || [];
    const usedWeight = existing.reduce((s, c) => s + (parseFloat(c.weight) || 0), 0);
    const usedMarks  = existing.reduce((s, c) => s + (parseFloat(c.max_marks) || 0), 0);
    const total      = rubrics[qIdx]?.total_marks || 10;
    setRubrics(p => ({
      ...p,
      [qIdx]: {
        ...p[qIdx],
        criteria: [...existing, {
          _id        : Math.random(),
          name       : "",
          description: "",
          max_marks  : Math.max(0, total - usedMarks),
          weight     : parseFloat(Math.max(0, 1 - usedWeight).toFixed(2)),
        }],
      },
    }));
  };

  const handleChange = (qIdx, ci, field, val) => {
    setRubrics(p => {
      const updated = [...(p[qIdx]?.criteria || [])];
      updated[ci] = { ...updated[ci], [field]: val };
      return { ...p, [qIdx]: { ...p[qIdx], criteria: updated } };
    });
  };

  const handleRemove = (qIdx, ci) => {
    setRubrics(p => ({
      ...p,
      [qIdx]: { ...p[qIdx], criteria: (p[qIdx]?.criteria||[]).filter((_,i)=>i!==ci) },
    }));
  };

  const weightSum = (qIdx) =>
    (rubrics[qIdx]?.criteria || []).reduce((s,c) => s + (parseFloat(c.weight)||0), 0);

  const marksSum = (qIdx) =>
    (rubrics[qIdx]?.criteria || []).reduce((s,c) => s + (parseFloat(c.max_marks)||0), 0);

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveMsg(""); setSaving(true);

    const payload = [];
    for (const [idxStr, rubric] of Object.entries(rubrics)) {
      const idx = parseInt(idxStr);
      if (!rubric.criteria || rubric.criteria.length === 0) continue;
      const ws = weightSum(idx);
      if (Math.abs(ws - 1.0) > 0.05) {
        setSaveMsg(`⚠️ Q${idx+1}: weights sum to ${ws.toFixed(2)} — must be 1.0`);
        setSaving(false); return;
      }
      payload.push({
        question_index: idx,
        criteria      : rubric.criteria.map(c => ({
          name       : c.name,
          description: c.description,
          max_marks  : parseFloat(c.max_marks) || 0,
          weight     : parseFloat(c.weight)    || 0,
        })),
        total_marks: rubric.total_marks,
      });
    }

    if (payload.length === 0) {
      setSaveMsg("⚠️ No criteria added. Add at least one criterion.");
      setSaving(false); return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/exams/rubric`, {
        method : "POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body   : JSON.stringify({ exam_id: examId, rubrics: payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMsg(`✅ Rubric saved for ${data.rubrics_saved || payload.length} questions!`);
        setTimeout(() => { if (onSaved) onSaved(); }, 1200);
      } else {
        setSaveMsg(data.msg || data.detail || "Save failed.");
      }
    } catch {
      setSaveMsg("Save failed. Check connection.");
    } finally {
      setSaving(false);
    }
  };

  // ── No gradable questions ────────────────────────────────────
  if (gradableQs.length === 0) {
    return (
      <div style={s.overlay}>
        <div style={s.modal}>
          <div style={s.header}>
            <h2 style={s.title}>Define Rubric</h2>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>
          <p style={{ padding:"2rem", color:"#64748b", textAlign:"center" }}>
            No short-answer questions found. Rubrics apply to short-answer questions only.
          </p>
          <div style={s.footer}>
            <button style={s.cancelBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <h2 style={s.title}>📋 Define Grading Rubric</h2>
            <p style={s.subtitle}>
              Optional — define criteria for AI to use when grading short answers.
              Without rubric, AI uses model answers + key concepts.
            </p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>

          {/* Question tabs */}
          <div style={s.tabs}>
            {gradableQs.map(q => {
              const hasCrit   = (rubrics[q.originalIndex]?.criteria||[]).length > 0;
              const weightOk  = hasCrit && Math.abs(weightSum(q.originalIndex) - 1.0) <= 0.05;
              const isActive  = activeIndex === q.originalIndex;
              return (
                <button key={q.originalIndex}
                  style={{ ...s.tab, ...(isActive ? s.tabActive : {}) }}
                  onClick={() => setActiveIndex(q.originalIndex)}>
                  Q{q.originalIndex+1}
                  {hasCrit && (
                    <span style={{
                      ...s.tabDot,
                      background: weightOk ? "#10b981" : "#f59e0b"
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active question panel */}
          {activeQ && (
            <div style={s.panel}>

              {/* Question info */}
              <div style={s.qInfo}>
                <div style={s.qInfoRow}>
                  <span style={s.qBadge}>Q{activeQ.originalIndex+1}</span>
                  <span style={s.qTypeBadge}>{activeQ.type.toUpperCase()}</span>
                  <span style={s.qMarksBadge}>{activeQ.max_marks||10} marks</span>
                </div>
                <p style={s.qText}>{activeQ.text}</p>
              </div>

              {/* AI Suggest */}
              <button
                style={{ ...s.suggestBtn, opacity: loadingSuggest[activeQ.originalIndex] ? 0.7 : 1 }}
                onClick={() => handleSuggest(activeQ.originalIndex)}
                disabled={loadingSuggest[activeQ.originalIndex]}>
                {loadingSuggest[activeQ.originalIndex] ? "⏳ AI Suggesting..." : "✨ AI Suggest Rubric"}
              </button>

              {/* Criteria */}
              <div style={s.criteriaList}>
                {(rubrics[activeQ.originalIndex]?.criteria||[]).length === 0 ? (
                  <div style={s.emptyCriteria}>
                    <p style={{margin:0,fontWeight:600}}>No criteria yet</p>
                    <p style={{margin:"0.25rem 0 0",fontSize:"0.8rem"}}>
                      Click <strong>"✨ AI Suggest Rubric"</strong> to auto-generate, or add manually.
                    </p>
                  </div>
                ) : (
                  (rubrics[activeQ.originalIndex]?.criteria||[]).map((c, ci) => (
                    <div key={c._id||ci} style={s.criterionCard}>
                      <div style={s.criterionRow}>
                        <div style={{flex:2}}>
                          <label style={s.cLabel}>Criterion Name</label>
                          <input style={s.cInput}
                            placeholder="e.g. Conceptual Understanding"
                            value={c.name}
                            onChange={e => handleChange(activeQ.originalIndex, ci, "name", e.target.value)} />
                        </div>
                        <div style={{flex:1}}>
                          <label style={s.cLabel}>Marks</label>
                          <input style={s.cInput} type="number" min="0" max="100" step="0.5"
                            value={c.max_marks}
                            onChange={e => handleChange(activeQ.originalIndex, ci, "max_marks", e.target.value)} />
                        </div>
                        <div style={{flex:1}}>
                          <label style={s.cLabel}>Weight (0–1)</label>
                          <input style={{
                            ...s.cInput,
                            borderColor: Math.abs(weightSum(activeQ.originalIndex)-1.0) > 0.05 ? "#f59e0b" : "#e2e8f0"
                          }} type="number" min="0" max="1" step="0.05"
                            value={c.weight}
                            onChange={e => handleChange(activeQ.originalIndex, ci, "weight", e.target.value)} />
                        </div>
                        <button style={s.removeBtn}
                          onClick={() => handleRemove(activeQ.originalIndex, ci)}>✕</button>
                      </div>
                      <div>
                        <label style={s.cLabel}>Description</label>
                        <input style={s.cInput}
                          placeholder="What to look for in the student answer..."
                          value={c.description}
                          onChange={e => handleChange(activeQ.originalIndex, ci, "description", e.target.value)} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Weight / marks summary */}
              {(rubrics[activeQ.originalIndex]?.criteria||[]).length > 0 && (
                <div style={s.summary}>
                  <span>
                    Weights: <strong style={{
                      color: Math.abs(weightSum(activeQ.originalIndex)-1.0) <= 0.05 ? "#059669" : "#d97706"
                    }}>
                      {weightSum(activeQ.originalIndex).toFixed(2)} / 1.0
                    </strong>
                    {Math.abs(weightSum(activeQ.originalIndex)-1.0) <= 0.05 ? " ✅" : " ⚠️ must equal 1.0"}
                  </span>
                  <span>
                    Marks: <strong>{marksSum(activeQ.originalIndex).toFixed(1)} / {activeQ.max_marks||10}</strong>
                  </span>
                </div>
              )}

              <button style={s.addBtn} onClick={() => handleAdd(activeQ.originalIndex)}>
                + Add Criterion
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          {saveMsg && (
            <span style={{
              fontSize:"0.875rem", fontWeight:600,
              color: saveMsg.startsWith("✅") ? "#059669" : "#dc2626"
            }}>{saveMsg}</span>
          )}
          <div style={{display:"flex",gap:"0.75rem",marginLeft:"auto"}}>
            <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button style={{...s.saveBtn, opacity: saving?0.7:1}} onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "💾 Save Rubric"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay    : {position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"},
  modal      : {background:"white",borderRadius:"20px",width:"100%",maxWidth:"760px",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 25px 60px rgba(0,0,0,0.25)",overflow:"hidden"},
  header     : {padding:"1.5rem 1.75rem 1rem",borderBottom:"1.5px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0},
  title      : {margin:0,fontSize:"1.2rem",fontWeight:800,color:"#111827"},
  subtitle   : {margin:"0.3rem 0 0",fontSize:"0.82rem",color:"#64748b",lineHeight:1.5},
  closeBtn   : {background:"none",border:"none",fontSize:"1.25rem",cursor:"pointer",color:"#94a3b8"},
  body       : {flex:1,overflow:"auto",padding:"1.25rem 1.75rem",display:"flex",flexDirection:"column",gap:"1rem"},
  footer     : {padding:"1rem 1.75rem",borderTop:"1.5px solid #f1f5f9",display:"flex",alignItems:"center",gap:"1rem",flexShrink:0,background:"#f8fafc"},
  tabs       : {display:"flex",gap:"0.4rem",flexWrap:"wrap"},
  tab        : {padding:"0.4rem 0.85rem",border:"1.5px solid #e2e8f0",borderRadius:"8px",background:"white",color:"#64748b",fontWeight:600,fontSize:"0.82rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.4rem"},
  tabActive  : {background:"#4f46e5",color:"white",borderColor:"#4f46e5"},
  tabDot     : {width:"8px",height:"8px",borderRadius:"50%"},
  panel      : {display:"flex",flexDirection:"column",gap:"1rem"},
  qInfo      : {background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:"12px",padding:"1rem 1.25rem"},
  qInfoRow   : {display:"flex",gap:"0.5rem",alignItems:"center",marginBottom:"0.5rem"},
  qBadge     : {background:"#4f46e5",color:"white",borderRadius:"6px",padding:"2px 8px",fontSize:"0.75rem",fontWeight:700},
  qTypeBadge : {background:"#e0e7ff",color:"#4338ca",borderRadius:"6px",padding:"2px 8px",fontSize:"0.75rem",fontWeight:600},
  qMarksBadge: {background:"#ede9fe",color:"#6d28d9",borderRadius:"6px",padding:"2px 8px",fontSize:"0.75rem",fontWeight:600},
  qText      : {margin:0,fontSize:"0.9rem",color:"#374151",lineHeight:1.5},
  suggestBtn : {padding:"0.65rem 1.25rem",background:"linear-gradient(135deg,#8b5cf6,#6d28d9)",color:"white",border:"none",borderRadius:"10px",fontWeight:700,fontSize:"0.875rem",cursor:"pointer",alignSelf:"flex-start"},
  criteriaList:{display:"flex",flexDirection:"column",gap:"0.75rem"},
  emptyCriteria:{padding:"1.5rem",textAlign:"center",background:"#f8fafc",borderRadius:"10px",border:"1.5px dashed #e2e8f0",color:"#64748b",fontSize:"0.875rem"},
  criterionCard:{background:"#fafafa",border:"1.5px solid #e2e8f0",borderRadius:"10px",padding:"0.875rem 1rem",display:"flex",flexDirection:"column",gap:"0.6rem"},
  criterionRow :{display:"flex",gap:"0.75rem",alignItems:"flex-end"},
  cLabel     : {display:"block",fontSize:"0.75rem",fontWeight:600,color:"#64748b",marginBottom:"0.25rem"},
  cInput     : {width:"100%",padding:"0.5rem 0.75rem",border:"1.5px solid #e2e8f0",borderRadius:"8px",fontSize:"0.875rem",fontFamily:"inherit",outline:"none",color:"#111827",boxSizing:"border-box"},
  removeBtn  : {padding:"0.5rem",background:"#fee2e2",border:"none",borderRadius:"8px",cursor:"pointer",color:"#dc2626",fontWeight:700,flexShrink:0,alignSelf:"flex-end"},
  summary    : {display:"flex",justifyContent:"space-between",padding:"0.6rem 0.875rem",background:"#f8fafc",borderRadius:"8px",fontSize:"0.8rem",color:"#64748b"},
  addBtn     : {padding:"0.6rem 1rem",border:"1.5px dashed #c4b5fd",borderRadius:"8px",background:"white",color:"#6d28d9",fontWeight:600,fontSize:"0.85rem",cursor:"pointer",alignSelf:"flex-start"},
  cancelBtn  : {padding:"0.65rem 1.25rem",border:"1.5px solid #e2e8f0",borderRadius:"10px",background:"white",color:"#64748b",fontWeight:600,fontSize:"0.875rem",cursor:"pointer"},
  saveBtn    : {padding:"0.65rem 1.5rem",background:"linear-gradient(135deg,#6366f1,#4f46e5)",color:"white",border:"none",borderRadius:"10px",fontWeight:700,fontSize:"0.875rem",cursor:"pointer",boxShadow:"0 4px 12px rgba(99,102,241,0.3)"},
};