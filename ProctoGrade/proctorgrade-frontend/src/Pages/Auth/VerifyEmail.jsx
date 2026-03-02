import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api";
import "./VerifyEmail.css";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", otp: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds
  const [resendLoading, setResendLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (timeLeft <= 0) {
      setMessage("OTP has expired. Please click 'Resend OTP' to get a new code.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/verify-email", {
        email: form.email,
        otp: form.otp,
      });

      setMessage(res.data.msg || "Email verified successfully.");
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      setMessage(err.response?.data?.msg || "Verification failed!");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!form.email) {
      setMessage("Please enter your email first.");
      return;
    }

    setResendLoading(true);
    setMessage("");

    try {
      const res = await api.post("/auth/resend-otp", {
        email: form.email,
      });

      setMessage(res.data.msg || "New OTP sent to your email.");
      setTimeLeft(30); // reset countdown
    } catch (err) {
      setMessage(err.response?.data?.msg || "Could not resend OTP.");
    } finally {
      setResendLoading(false);
    }
  };

  const isExpired = timeLeft <= 0;

  return (
    <div className="verify-page">
      <div className="verify-container">
        <h2>Verify Your Email</h2>
        <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          Enter the email you used to sign up and the 6‑digit OTP sent to your email.
        </p>
        <p
          style={{
            fontSize: "0.85rem",
            marginBottom: "1rem",
            color: isExpired ? "#b91c1c" : "#4b5563",
          }}
        >
          {isExpired
            ? "OTP expired. You can request a new code."
            : `OTP will expire in ${timeLeft} seconds.`}
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="Enter your email"
            value={form.email}
            onChange={handleChange}
            required
            disabled={loading}
          />

          <label htmlFor="otp">OTP Code</label>
          <input
            id="otp"
            type="text"
            name="otp"
            placeholder="Enter 6‑digit OTP"
            value={form.otp}
            onChange={handleChange}
            required
            disabled={loading}
          />

          <button
            type="submit"
            className="verify-submit-btn"
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <button
          type="button"
          className="verify-resend-btn"
          onClick={handleResend}
          disabled={resendLoading}
          style={{ marginTop: "0.75rem" }}
        >
          {resendLoading ? "Resending..." : "Resend OTP"}
        </button>

        {message && (
          <p className="message" style={{ marginTop: "1rem" }}>
            {message}
          </p>
        )}

        <p style={{ marginTop: "1rem" }}>
          Back to <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
