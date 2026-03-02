import React from "react";
import "./AdminComponents/AdminComponents.css";


function LogoutConfirmModal({ open, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="admin-modal">
      <form className="delete-user-form">
        <div className="admin-section-header modal-header">
          <span className="section-icon" style={{ fontSize: 40 }}>🚪</span>
          <h2>Logout</h2>
        </div>
        <p>Are you sure you want to logout?</p>
        <div className="edit-modal-actions">
          <button type="button" className="modal-btn primary" onClick={onConfirm}>Yes, Logout</button>
          <button type="button" className="modal-btn" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default LogoutConfirmModal;
