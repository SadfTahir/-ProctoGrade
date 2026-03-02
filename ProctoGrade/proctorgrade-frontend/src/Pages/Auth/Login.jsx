// src/Pages/Auth/Login.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      if (user.role === "admin") navigate("/admin-dashboard");
      else if (user.role === "instructor") navigate("/instructor-dashboard");
      else if (user.role === "examinee") navigate("/student-dashboard");
    }
  }, [navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await api.post("/auth/login", {
        email: form.email,
        password: form.password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      setForm({ email: "", password: "" });

      const role = res.data.user.role;
      if (role === "admin") navigate("/admin-dashboard");
      else if (role === "instructor") navigate("/instructor-dashboard");
      else if (role === "examinee") navigate("/student-dashboard");
      else navigate("/");
    } catch (err) {
      setMessage(err.response?.data?.msg || "Login failed!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h2>Login to ProctoGrade</h2>
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
            autoComplete="username"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={handleChange}
            required
            autoComplete="current-password"
          />

          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
          
        </form>

        {message && (
          <p className="message" style={{ color: "#ef4444", fontWeight: 500 }}>
            {message}
          </p>
        )}

        <p className="login-bottom-text">
          Don't have an account? <Link to="/register">Sign Up</Link>
        </p>

        <p className="login-bottom-text">
          <Link to="/forgot-password" className="forgot-bottom-link">
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}
