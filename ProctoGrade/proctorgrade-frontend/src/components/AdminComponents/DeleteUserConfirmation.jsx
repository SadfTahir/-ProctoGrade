import React from "react";
import "./AdminComponents.css";

function DeleteUserConfirmation({ open, user, onConfirm, onCancel }) {
  if (!open || !user) return null;

  return (
    <div className="admin-modal">
      <form className="delete-user-form">
        <div className="admin-section-header modal-header">
          <span className="section-icon trash-icon">
            {/* SVG Trash Icon */}
            <svg height="42" viewBox="0 0 24 24" fill="#186ad6"><path d="M7 21c0 1.104.896 2 2 2h6c1.104 0 2-.896 2-2H7zm13-3V5c0-1.104-.896-2-2-2h-3.382l-.724-2.447A.998.998 0 0 0 13 0h-2c-.416 0-.788.254-.894.649L9.382 3H6c-1.104 0-2 .896-2 2v13c0 1.104.896 2 2 2h14c1.104 0 2-.896 2-2zM5 5c0-.553.447-1 1-1h14c.553 0 1 .447 1 1v13c0 .553-.447 1-1 1H6c-.553 0-1-.447-1-1V5zm5-4h4l.724 2.447A.998.998 0 0 0 17 4H7c-.416 0-.788-.254-.894-.649L10 1zm2 1v2h-2V2h2z"/></svg>
          </span>
          <h2>Delete User</h2>
        </div>
        <p>Are you sure you want to delete <strong>{user.name}</strong>?</p>
        <div className="edit-modal-actions">
          <button type="button" className="modal-btn primary" onClick={onConfirm}>Yes, Delete</button>
          <button type="button" className="modal-btn" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
export default DeleteUserConfirmation;
