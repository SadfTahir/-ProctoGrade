import React from "react";
import "./AdminComponents.css";

function DeleteUserConfirmation({ open, user, onConfirm, onCancel }) {
  if (!open || !user) return null;

  return (
    <div className="admin-modal">
      <div className="delete-user-form">
        <div className="admin-section-header modal-header">
          <span className="section-icon trash-icon">
            <svg height="20" width="20" viewBox="0 0 24 24">
              <path
                d="M9 3v1H4v2h1v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1V4h-5V3H9zm0 5h2v9H9V8zm4 0h2v9h-2V8z"
                fill="var(--danger)"
              />
            </svg>
          </span>
          <h2>Delete User</h2>
        </div>

        <p>
          Are you sure you want to delete <strong>{user.name}</strong>?
          <br />
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
            This action cannot be undone.
          </span>
        </p>

        <div className="edit-modal-actions">
          <button type="button" className="modal-btn danger" onClick={onConfirm}>
            Yes, Delete
          </button>
          <button type="button" className="modal-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteUserConfirmation;