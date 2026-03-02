// src/components/InstructorComponents/VersionFullPreviewModal.jsx
import React from "react";
import "./VersionFullPreviewModal.css";

export default function VersionFullPreviewModal({ version, onClose, onSelect }) {
  if (!version) return null;

  return (
    <div className="full-preview-overlay" onClick={onClose}>
      <div className="full-preview-modal" onClick={e => e.stopPropagation()}>

        <div className="full-preview-header">
          <div className="header-content">
            <h2>
              <span className="version-badge-modal">Version {version.id}</span>
              Full Preview
            </h2>
            <p className="question-count-badge">{version.questions.length} Questions Total</p>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="full-preview-body">
          <div className="preview-instructions-banner">
            📋 <strong>Review all questions carefully</strong> — Check question quality,
            difficulty level, and alignment with your teaching objectives before selecting.
          </div>

          <div className="full-questions-list">
            {version.questions.map((q, idx) => (
              <div key={idx} className="full-question-card">
                <div className="question-header-row">
                  <div className="question-num-badge">Question {idx + 1}</div>
                  <div className="question-type-pill">
                    {q.type === "mcq" ? "🔘 Multiple Choice" : "✍️ Short Answer"}
                  </div>
                </div>

                <div className="question-text-block">
                  <p className="question-text">{q.text}</p>
                </div>

                {q.type === "mcq" && q.options && (
                  <div className="mcq-options-block">
                    <div className="options-label">Options:</div>
                    <div className="options-grid">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className={`option-item ${opt === q.answer ? "correct-answer" : ""}`}>
                          <span className="option-letter-circle">{String.fromCharCode(65 + oIdx)}</span>
                          <span className="option-text">{opt}</span>
                          {opt === q.answer && <span className="correct-badge">✓ Correct</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="teacher-answer-block">
                  <div className="answer-label">
                    <span className="label-icon">📖</span>
                    <strong>Reference Answer (for AI grading):</strong>
                  </div>
                  <div className="answer-content">
                    {q.teacher_answer || q.answer || "(No reference provided)"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="full-preview-footer">
          <button className="cancel-btn-modal" onClick={onClose}>← Back</button>
          <button className="select-btn-modal" onClick={onSelect}>
            <span className="btn-icon">✓</span>
            Select Version {version.id} &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
}