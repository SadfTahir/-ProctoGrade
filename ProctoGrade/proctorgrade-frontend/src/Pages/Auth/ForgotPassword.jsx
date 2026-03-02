// src/Pages/Auth/ForgotPassword.jsx
import React, { useState } from "react";
import api from "../../api";
import "./ResetPassword.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      // Make sure this matches backend: /api/auth/forgot-password
      const res = await api.post("/auth/forgot-password", { email });
      setMsg(res.data?.msg || "If this email exists, a reset link has been sent.");
    } catch (err) {
      setMsg(
        err.response?.data?.msg || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h2>Forgot Password</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {msg && (
          <p className="message" style={{ marginTop: "1rem" }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
