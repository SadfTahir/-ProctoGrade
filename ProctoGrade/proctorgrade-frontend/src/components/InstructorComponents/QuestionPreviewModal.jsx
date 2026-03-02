// src/components/InstructorComponents/QuestionPreviewModal.jsx
import React, { useState } from "react";
import "./QuestionPreviewModal.css";

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

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setEditedQuestion({ ...questions[index] });
  };

  const handleSaveEdit = () => {
    if (editedQuestion !== null && editingIndex !== null) {
      onEditQuestion(editingIndex, editedQuestion);
      setEditingIndex(null);
      setEditedQuestion(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditedQuestion(null);
  };

  const handleOptionChange = (optionIndex, value) => {
    const newOptions = [...(editedQuestion.options || [])];
    newOptions[optionIndex] = value;
    setEditedQuestion({ ...editedQuestion, options: newOptions });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container question-preview-modal">

        <div className="modal-header">
          <h2>Review Generated Questions</h2>
          <button className="modal-close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-metadata">
          <div className="metadata-item"><strong>Topic:</strong> {metadata?.topic || "N/A"}</div>
          <div className="metadata-item"><strong>Subject:</strong> {metadata?.subject || "N/A"}</div>
          <div className="metadata-item"><strong>Difficulty:</strong> {metadata?.difficulty || "N/A"}</div>
          <div className="metadata-item"><strong>Total Questions:</strong> {questions.length}</div>
        </div>

        {/* Exam Title editable inside modal */}
        {onExamTitleChange && (
          <div className="modal-title-field">
            <label><strong>Exam Title</strong> <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              type="text"
              value={examTitle || ""}
              onChange={e => onExamTitleChange(e.target.value)}
              placeholder="Enter exam title before saving..."
            />
          </div>
        )}

        <div className="modal-body">
          <p className="preview-instructions">
            ✅ Review each question and its <strong>teacher answer</strong> (used for grading).<br />
            📝 You can edit questions, options, and answers before saving.<br />
            🗑️ Remove questions you don't want to include.
          </p>

          <div className="questions-preview-list">
            {questions.map((q, index) => (
              <div key={index} className="question-preview-card">
                {editingIndex === index ? (
                  <div className="question-edit-mode">
                    <div className="edit-field">
                      <label>Question Text:</label>
                      <textarea
                        value={editedQuestion.text}
                        onChange={e => setEditedQuestion({ ...editedQuestion, text: e.target.value })}
                        rows={3}
                      />
                    </div>

                    {editedQuestion.type === "mcq" && (
                      <>
                        <div className="edit-field">
                          <label>Options:</label>
                          {(editedQuestion.options || []).map((opt, i) => (
                            <div key={i} className="option-edit-row">
                              <span className="option-label">{String.fromCharCode(65 + i)})</span>
                              <input type="text" value={opt} onChange={e => handleOptionChange(i, e.target.value)} />
                            </div>
                          ))}
                        </div>
                        <div className="edit-field">
                          <label>Correct Answer:</label>
                          <select
                            value={editedQuestion.answer || ""}
                            onChange={e => setEditedQuestion({ ...editedQuestion, answer: e.target.value })}
                          >
                            <option value="">-- Select --</option>
                            {(editedQuestion.options || []).map((opt, i) => (
                              <option key={i} value={opt}>{String.fromCharCode(65 + i)}) {opt}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    <div className="edit-field">
                      <label>Teacher Answer <span className="field-hint">(Reference for AI grading)</span></label>
                      <textarea
                        value={editedQuestion.teacher_answer || ""}
                        onChange={e => setEditedQuestion({ ...editedQuestion, teacher_answer: e.target.value })}
                        rows={3}
                        placeholder="Ideal answer AI will use as reference for grading..."
                      />
                    </div>

                    <div className="edit-actions">
                      <button className="save-edit-btn" onClick={handleSaveEdit}>✓ Save Changes</button>
                      <button className="cancel-edit-btn" onClick={handleCancelEdit}>✕ Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="question-view-mode">
                    <div className="question-header">
                      <span className="question-number">Q{index + 1}</span>
                      <span className="question-type-badge">{q.type.toUpperCase()}</span>
                    </div>

                    <div className="question-text">{q.text}</div>

                    {q.type === "mcq" && q.options && (
                      <div className="question-options">
                        <strong>Options:</strong>
                        <ul>
                          {q.options.map((opt, i) => (
                            <li key={i} className={opt === q.answer ? "correct-option" : ""}>
                              <span className="option-letter">{String.fromCharCode(65 + i)})</span>
                              {opt}
                              {opt === q.answer && <span className="correct-badge">✓ Correct</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {q.type !== "mcq" && q.answer && (
                      <div className="question-answer">
                        <strong>Student-Facing Answer Hint:</strong>
                        <p>{q.answer}</p>
                      </div>
                    )}

                    <div className="question-teacher-answer">
                      <strong>📖 Teacher Answer <span className="teacher-answer-hint">(AI grading reference)</span></strong>
                      <div className="teacher-answer-box">
                        {q.teacher_answer || q.answer || "(No reference answer)"}
                      </div>
                    </div>

                    <div className="question-actions">
                      <button className="edit-question-btn" onClick={() => handleStartEdit(index)}>✏️ Edit</button>
                      <button className="delete-question-btn" onClick={() => {
                        if (window.confirm("Remove this question?")) onDeleteQuestion(index);
                      }}>🗑️ Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-cancel-btn" onClick={onCancel}>Cancel</button>
          <button
            className="modal-confirm-btn"
            onClick={onConfirmSave}
            disabled={loading || questions.length === 0}
          >
            {loading ? "Saving..." : `✓ Confirm & Save (${questions.length} questions)`}
          </button>
        </div>
      </div>
    </div>
  );
}