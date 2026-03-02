import React from "react";
import { Link } from "react-router-dom";
import LOGO from "../../assets/LOGO.png"; // Adjust the path as necessary
import "../componentStyles.css";

export default function Header() {
  return (
    <header className="header">
      <div className="logo" style={{ display: "flex", alignItems: "center" }}>
        <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
          <img
            src={LOGO}
            alt="ProctoGrade Logo"
            style={{
              height: "48px",  // Bolder and bigger
              width: "auto",
              marginRight: "12px",
              verticalAlign: "middle"
            }}
          />
          <span
            style={{
              fontSize: "1.85rem",
              fontWeight: 700,
              color: "#4f46e5",
              letterSpacing: "-0.4px",
            }}
          >
            ProctoGrade
          </span>
        </Link>
      </div>
      <nav>
        <Link to="/">Home</Link>
      
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
      </nav>
      <div className="auth-buttons">
        <Link to="/login">
          <button className="login-btn">Login</button>
        </Link>
        <Link to="/register">
          <button className="signup-btn">Sign Up</button>
        </Link>
      </div>
    </header>
  );
}
