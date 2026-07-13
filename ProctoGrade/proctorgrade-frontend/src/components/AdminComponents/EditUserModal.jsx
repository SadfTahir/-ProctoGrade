import React, { useState, useEffect } from "react";
import "./AdminComponents.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function EditUserModal({ open, user, onClose, onUserUpdated }) {
  const [form, setForm] = useState(user || {});
  const [loading, setLoading] = useState(false);

  useEffect(() => { setForm(user || {}); }, [user]);

  if (!open || !user) return null;

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${BACKEND_URL}/api/auth/users/${form._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onUserUpdated && onUserUpdated();
      onClose && onClose();
    } catch {}
    setLoading(false);
  }

  return (
    <div className="admin-modal">
      <form onSubmit={handleUpdate} className="edit-user-form">
        <div className="admin-section-header modal-header">
          <span className="section-icon">✏️</span>
          <h2>Edit User</h2>
        </div>

        <div className="modal-field">
          <label>Name</label>
          <input name="name" value={form.name || ""} onChange={handleChange} placeholder="Full name" required />
        </div>

        <div className="modal-field">
          <label>Email</label>
          <input name="email" value={form.email || ""} onChange={handleChange} placeholder="Email address" type="email" required />
        </div>

        <div className="modal-field">
          <label>Role</label>
          <select name="role" value={form.role || ""} onChange={handleChange} required>
            <option value="instructor">Instructor</option>
            <option value="examinee">Examinee</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="edit-modal-actions">
          <button type="submit" className="modal-btn primary" disabled={loading}>
            {loading ? "Saving…" : "Save Changes"}
          </button>
          <button type="button" className="modal-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditUserModal;