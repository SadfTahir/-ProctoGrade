// src/components/InstructorComponents/QuestionPreviewModal.jsx
// ✅ v2.0 — max_marks field added per question (teacher sets marks before saving)

import React, { useState } from "react";
import "./QuestionPreviewModal.css";

const MARK_PRESETS = [5, 10, 15, 20];

export default function QuestionPreviewModal({
  questions,
  metadata,
  examTitle,
  onExamTitleChange,
  onConfirmSave,
  onCancel,
  onEditQuestion,
  onDeleteQuestion,
  loading,
}) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedQuestion, setEditedQuestion] = useState(null);
  const [conceptInput, setConceptInput] = useState("");

  // ── Total marks computed from all questions ──────────────────
  const totalMarks = questions.reduce(
    (sum, q) => sum + (parseFloat(q.max_marks) || 10),
    0
  );

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setEditedQuestion({ ...questions[index], max_marks: parseFloat(questions[index].max_marks) || 10 });
    setConceptInput("");
  };

  const handleSaveEdit = () => {
    if (editedQuestion !== null && editingIndex !== null) {
      onEditQuestion(editingIndex, editedQuestion);
      setEditingIndex(null);
      setEditedQuestion(null);
      setConceptInput("");
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditedQuestion(null);
    setConceptInput("");
  };

  const handleOptionChange = (optionIndex, value) => {
    const newOptions = [...(editedQuestion.options || [])];
    newOptions[optionIndex] = value;
    setEditedQuestion({ ...editedQuestion, options: newOptions });
  };

  // ── Marks change ─────────────────────────────────────────────
  const handleMarksChange = (val) => {
    const parsed = parseFloat(val);
    setEditedQuestion({
      ...editedQuestion,
      max_marks: isNaN(parsed) ? "" : parsed,
    });
  };

  // ── Key Concepts helpers ──────────────────────────────────────
  const handleAddConcept = () => {
    const trimmed = conceptInput.trim();
    if (!trimmed) return;
    const existing = editedQuestion.key_concepts || [];
    if (existing.includes(trimmed)) return;
    setEditedQuestion({ ...editedQuestion, key_concepts: [...existing, trimmed] });
    setConceptInput("");
  };

  const handleRemoveConcept = (concept) => {
    setEditedQuestion({
      ...editedQuestion,
      key_concepts: (editedQuestion.key_concepts || []).filter((c) => c !== concept),
    });
  };

  const handleConceptKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddConcept();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container question-preview-modal">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="modal-header">
          <h2>Review Generated Questions</h2>
          <button className="modal-close-btn" onClick={onCancel}>✕</button>
        </div>

        {/* ── Metadata ───────────────────────────────────────── */}
        <div className="modal-metadata">
          <div className="metadata-item"><strong>Topic:</strong> {metadata?.topic || "N/A"}</div>
          <div className="metadata-item"><strong>Subject:</strong> {metadata?.subject || "N/A"}</div>
          <div className="metadata-item"><strong>Difficulty:</strong> {metadata?.difficulty || "N/A"}</div>
          <div className="metadata-item"><strong>Total Questions:</strong> {questions.length}</div>
        </div>

        {/* ── Exam Title ─────────────────────────────────────── */}
        {onExamTitleChange && (
          <div className="modal-title-field">
            <label><strong>Exam Title</strong> <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              type="text"
              value={examTitle || ""}
              onChange={(e) => onExamTitleChange(e.target.value)}
              placeholder="Enter exam title before saving..."
            />
          </div>
        )}

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="modal-body">
          <p className="preview-instructions">
            ✅ Review each question and its <strong>model answer</strong> (AI-suggested, edit if needed).<br />
            🔢 Set <strong>marks per question</strong> — total marks shown in footer.<br />
            🏷️ Set <strong>key concepts</strong> — AI grades student answers based on these.<br />
            🗑️ Remove questions you don't want to include.
          </p>

          <div className="questions-preview-list">
            {questions.map((q, index) => (
              <div key={index} className="question-preview-card">

                {/* ════════════ EDIT MODE ════════════ */}
                {editingIndex === index ? (
                  <div className="question-edit-mode">

                    {/* Question Text */}
                    <div className="edit-field">
                      <label>Question Text:</label>
                      <textarea
                        value={editedQuestion.text}
                        onChange={(e) =>
                          setEditedQuestion({ ...editedQuestion, text: e.target.value })
                        }
                        rows={3}
                      />
                    </div>

                    {/* ✅ Marks Field */}
                    <div className="edit-field">
                      <label>
                        🔢 Marks for this question
                        <span className="field-hint"> (how much this question is worth)</span>
                      </label>
                      <div style={ms.marksRow}>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="0.5"
                          value={editedQuestion.max_marks ?? 10}
                          onChange={(e) => handleMarksChange(e.target.value)}
                          style={ms.marksInput}
                        />
                        <div style={ms.presetRow}>
                          {MARK_PRESETS.map((p) => (
                            <button
                              key={p}
                              type="button"
                              style={{
                                ...ms.presetBtn,
                                ...(editedQuestion.max_marks === p ? ms.presetBtnActive : {}),
                              }}
                              onClick={() => handleMarksChange(p)}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* MCQ Options + Correct Answer */}
                    {editedQuestion.type === "mcq" && (
                      <>
                        <div className="edit-field">
                          <label>Options:</label>
                          {(editedQuestion.options || []).map((opt, i) => (
                            <div key={i} className="option-edit-row">
                              <span className="option-label">{String.fromCharCode(65 + i)})</span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => handleOptionChange(i, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="edit-field">
                          <label>Correct Answer:</label>
                          <select
                            value={editedQuestion.answer || ""}
                            onChange={(e) =>
                              setEditedQuestion({ ...editedQuestion, answer: e.target.value })
                            }
                          >
                            <option value="">-- Select --</option>
                            {(editedQuestion.options || []).map((opt, i) => (
                              <option key={i} value={opt}>
                                {String.fromCharCode(65 + i)}) {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {/* Model Answer (short/code only) */}
                    {editedQuestion.type !== "mcq" && (
                      <div className="edit-field">
                        <label>
                          📖 Model Answer
                          <span className="field-hint"> (AI grading reference — edit to improve accuracy)</span>
                        </label>
                        <textarea
                          value={
                            editedQuestion.model_answer ||
                            editedQuestion.teacher_answer ||
                            ""
                          }
                          onChange={(e) =>
                            setEditedQuestion({
                              ...editedQuestion,
                              model_answer: e.target.value,
                              teacher_answer: e.target.value,
                            })
                          }
                          rows={4}
                          placeholder="Write the ideal answer here. AI will compare student answers against this..."
                        />
                      </div>
                    )}

                    {/* Key Concepts (short/code only) */}
                    {editedQuestion.type !== "mcq" && (
                      <div className="edit-field">
                        <label>
                          🏷️ Key Concepts
                          <span className="field-hint"> (press Enter or comma to add)</span>
                        </label>
                        <div className="concepts-tags-container">
                          {(editedQuestion.key_concepts || []).map((kc, ki) => (
                            <span key={ki} className="concept-tag concept-tag--edit">
                              {kc}
                              <button
                                className="concept-remove-btn"
                                onClick={() => handleRemoveConcept(kc)}
                                type="button"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="concept-input-row">
                          <input
                            type="text"
                            value={conceptInput}
                            onChange={(e) => setConceptInput(e.target.value)}
                            onKeyDown={handleConceptKeyDown}
                            placeholder="e.g. force, acceleration, Newton..."
                          />
                          <button
                            className="concept-add-btn"
                            onClick={handleAddConcept}
                            type="button"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Marking Guide */}
                    {editedQuestion.type !== "mcq" && (
                      <div className="edit-field">
                        <label>
                          📋 Marking Guide
                          <span className="field-hint"> (optional — shown to teacher only)</span>
                        </label>
                        <input
                          type="text"
                          value={editedQuestion.marking_guide || ""}
                          onChange={(e) =>
                            setEditedQuestion({
                              ...editedQuestion,
                              marking_guide: e.target.value,
                            })
                          }
                          placeholder="e.g. 2 marks per key concept..."
                        />
                      </div>
                    )}

                    {/* Edit Actions */}
                    <div className="edit-actions">
                      <button className="save-edit-btn" onClick={handleSaveEdit}>
                        ✓ Save Changes
                      </button>
                      <button className="cancel-edit-btn" onClick={handleCancelEdit}>
                        ✕ Cancel
                      </button>
                    </div>
                  </div>

                ) : (
                  /* ════════════ VIEW MODE ════════════ */
                  <div className="question-view-mode">

                    {/* Question header */}
                    <div className="question-header">
                      <span className="question-number">Q{index + 1}</span>
                      <span className="question-type-badge">{q.type.toUpperCase()}</span>
                      {/* ✅ Marks badge */}
                      <span style={ms.marksBadge}>
                        🔢 {parseFloat(q.max_marks) || 10} marks
                      </span>
                      {q.model_answer || q.teacher_answer ? (
                        <span className="answer-status answer-status--ready">✓ Answer Ready</span>
                      ) : (
                        <span className="answer-status answer-status--missing">⚠ No Answer</span>
                      )}
                    </div>

                    {/* Question text */}
                    <div className="question-text">{q.text}</div>

                    {/* MCQ Options */}
                    {q.type === "mcq" && q.options && (
                      <div className="question-options">
                        <strong>Options:</strong>
                        <ul>
                          {q.options.map((opt, i) => (
                            <li key={i} className={opt === q.answer ? "correct-option" : ""}>
                              <span className="option-letter">{String.fromCharCode(65 + i)})</span>
                              {opt}
                              {opt === q.answer && (
                                <span className="correct-badge">✓ Correct</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Model Answer (short/code) */}
                    {q.type !== "mcq" && (
                      <div className="question-teacher-answer">
                        <strong>
                          📖 Model Answer
                          <span className="teacher-answer-hint"> (AI grading reference)</span>
                        </strong>
                        <div className="teacher-answer-box">
                          {q.model_answer || q.teacher_answer || (
                            <span className="no-answer-warning">
                              ⚠️ No model answer — click Edit to add one before saving.
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Key Concepts */}
                    {q.type !== "mcq" && (
                      <div className="question-key-concepts">
                        <strong>
                          🏷️ Key Concepts
                          <span className="teacher-answer-hint"> (AI checks these in student answers)</span>
                        </strong>
                        <div className="concepts-tags-container" style={{ marginTop: 8 }}>
                          {(q.key_concepts || []).length > 0 ? (
                            q.key_concepts.map((kc, ki) => (
                              <span key={ki} className="concept-tag">
                                {kc}
                              </span>
                            ))
                          ) : (
                            <span className="no-concepts-hint">
                              No key concepts set — click Edit to add (improves grading accuracy)
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Marking Guide */}
                    {q.type !== "mcq" && q.marking_guide && (
                      <div className="question-marking-guide">
                        📋 <strong>Marking Guide:</strong> {q.marking_guide}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="question-actions">
                      <button
                        className="edit-question-btn"
                        onClick={() => handleStartEdit(index)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="delete-question-btn"
                        onClick={() => {
                          if (window.confirm("Remove this question?"))
                            onDeleteQuestion(index);
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer — Total Marks + Save ────────────────────── */}
        <div className="modal-footer">
          {/* ✅ Total marks display */}
          <div style={ms.totalMarksBox}>
            <span style={ms.totalLabel}>Total Marks:</span>
            <span style={ms.totalValue}>{totalMarks}</span>
          </div>

          <button className="modal-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="modal-confirm-btn"
            onClick={onConfirmSave}
            disabled={loading || questions.length === 0}
          >
            {loading
              ? "Saving..."
              : `✓ Confirm & Save (${questions.length} questions · ${totalMarks} marks)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Marks-specific inline styles ─────────────────────────────────────────────
const ms = {
  marksBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    background: "#ede9fe",
    color: "#6d28d9",
    borderRadius: "6px",
    fontSize: "0.78rem",
    fontWeight: 700,
  },
  marksRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  marksInput: {
    width: "90px",
    padding: "0.5rem 0.75rem",
    border: "1.5px solid #c4b5fd",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 700,
    color: "#6d28d9",
    outline: "none",
    textAlign: "center",
  },
  presetRow: {
    display: "flex",
    gap: "0.4rem",
  },
  presetBtn: {
    padding: "0.4rem 0.75rem",
    border: "1.5px solid #e2e8f0",
    borderRadius: "6px",
    background: "white",
    color: "#64748b",
    fontWeight: 600,
    fontSize: "0.82rem",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  presetBtnActive: {
    background: "#6d28d9",
    color: "white",
    borderColor: "#6d28d9",
  },
  totalMarksBox: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginRight: "auto",
    background: "#f5f3ff",
    border: "1.5px solid #c4b5fd",
    borderRadius: "10px",
    padding: "0.5rem 1rem",
  },
  totalLabel: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#6d28d9",
  },
  totalValue: {
    fontSize: "1.1rem",
    fontWeight: 800,
    color: "#4c1d95",
  },
};