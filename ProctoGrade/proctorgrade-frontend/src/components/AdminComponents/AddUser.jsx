import React, { useState } from "react";
import "./AdminComponents.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function AddUser({ onUserAdded }) {
  const [form, setForm] = useState({ name: "", email: "", role: "instructor", password: "" });
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [showVerifyHint, setShowVerifyHint] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setShowVerifyHint(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setIsError(!res.ok);
      setMessage(data.msg || (res.ok ? "User added successfully!" : "Failed to add user."));
      if (res.ok) {
        setShowVerifyHint(true);
        setForm({ name: "", email: "", role: "instructor", password: "" });
        if (onUserAdded) onUserAdded();
      }
    } catch {
      setIsError(true);
      setMessage("Network error. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <span className="section-icon">➕</span>
        <h2>Add New User</h2>
      </div>

      <form className="add-user-form" onSubmit={handleSubmit}>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Full name"
          required
          autoComplete="off"
        />
        <input
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Email address"
          type="email"
          required
          autoComplete="off"
        />
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Password"
          required
        />
        <select name="role" value={form.role} onChange={handleChange}>
          <option value="instructor">Instructor</option>
          <option value="examinee">Examinee</option>
        </select>

        <button type="submit" disabled={loading}>
          {loading ? "Adding…" : "Add User"}
        </button>

        {message && (
          <p style={isError ? {
            color: "var(--danger)",
            background: "var(--danger-bg)",
            borderColor: "rgba(185,28,28,0.18)"
          } : {}}>
            {isError ? "⚠️ " : "✅ "}{message}
          </p>
        )}

        {showVerifyHint && (
          <p className="admin-verify-hint">
            📧 The user must verify their email using the OTP they received before they can log in.
          </p>
        )}
      </form>
    </div>
  );
}

export default AddUser;