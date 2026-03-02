import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
import "./Register.css";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: ""
  });
  const [message, setMessage] = useState("");

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
    setMessage("");

    // Name: only letters + spaces, 2-50 chars
      const nameRegex = /^[A-Za-z ]{2,50}$/;
      if (!nameRegex.test(form.name.trim())) {
        setMessage("Name can contain only letters and spaces (2-50 characters).");
        return;
      }

    // Password policy: min 8 chars, at least 1 letter + 1 number
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(form.password)) {
      setMessage("Password must be at least 8 characters and include letters and numbers.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage("Passwords do not match!");
      return;
    }

    if (!form.role) {
      setMessage("Please select a role!");
      return;
    }

    try {
      const res = await api.post("/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      });

      setMessage(res.data.msg || "Registered successfully. Please verify your email.");

      setForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: ""
      });

      setTimeout(() => {
        navigate("/verify-email");
      }, 1500);
    } catch (err) {
      const msg = err.response?.data?.msg || "Registration failed!";
      const code = err.response?.data?.code;
      setMessage(msg);

      // If user exists but unverified, send to verify page
      if (code === "UNVERIFIED") {
        setTimeout(() => {
          navigate("/verify-email");
        }, 1500);
      }
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <h2>Create Your Account</h2>
        <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
          After registration, you will receive an OTP on your email to verify your account.
        </p>
        <form onSubmit={handleSubmit}>
          <label>Full Name</label>
          <input
            type="text"
            name="name"
            placeholder="Enter your full name"
            value={form.name}
            onChange={handleChange}
            required
          />

          <label>Email</label>
          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            value={form.email}
            onChange={handleChange}
            required
          />

          <label>Password</label>
          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={handleChange}
            required
          />

          <label>Confirm Password</label>
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm your password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
          />

          <label>Role</label>
          <select name="role" value={form.role} onChange={handleChange} required>
            <option value="">Select your role</option>
            <option value="instructor">Instructor</option>
            <option value="examinee">Examinee</option>
          </select>

          <button type="submit" className="register-submit-btn">
            Sign Up
          </button>
        </form>

        {message && <p className="message">{message}</p>}

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
