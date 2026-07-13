import React from "react";
import "./AdminComponents.css";

function UserProfileModal({ open, user, onClose }) {
  if (!open || !user) return null;

  const createdAt = user.createdAt
    ? new Date(user.createdAt).toLocaleString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      })
    : "N/A";

  const status = user.isVerified === false ? "Pending" : "Active";

  // Shorten user ID for display — show first 8 + last 4 chars
  const shortId = user._id
    ? `${user._id.slice(0, 8)}…${user._id.slice(-4)}`
    : null;

  return (
    <div className="admin-modal" onClick={onClose}>
      <div className="user-profile-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-section-header profile-header">
          <span className="section-icon">👤</span>
          <h2>User Profile</h2>
        </div>

        {/* Fields */}
        <div className="profile-fields">
          <div className="profile-field">
            <span className="profile-label">Name</span>
            <span className="profile-value">{user.name}</span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Email</span>
            <span className="profile-value">{user.email}</span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Role</span>
            <span className="profile-value" style={{ textTransform: "capitalize" }}>
              {user.role}
            </span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Status</span>
            <span className={`status-badge ${status === "Active" ? "status-active" : "status-pending"}`}>
              {status}
            </span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Registered On</span>
            <span className="profile-value">{createdAt}</span>
          </div>
          {shortId && (
            <div className="profile-field">
              <span className="profile-label">User ID</span>
              <span className="profile-value profile-id" title={user._id}>
                {shortId}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="edit-modal-actions">
          <button type="button" className="modal-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserProfileModal;