import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import LogoutConfirmModal from "../LogoutConfirmModal";
import "./AdminComponents.css";

function Sidebar() {
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  function handleLogout() {
    setShowLogout(true);
  }

  function confirmLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user"); // Key change: now actually logs out!
    setShowLogout(false);
    navigate("/login");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">ProctoGrade</div>
      <nav>
        <NavLink to="/admin-dashboard" className="sidebar-link">
          <span>🏠</span> Dashboard
        </NavLink>
        <NavLink to="/admin-dashboard/users" className="sidebar-link">
          <span>👥</span> User Management
        </NavLink>
        <button
          className="sidebar-link logout-btn"
          onClick={handleLogout}
          style={{ marginTop: "0.3rem", color: "#e05b5b" }}
        >
          <span>🚪</span> Logout
        </button>
      </nav>
      <LogoutConfirmModal
        open={showLogout}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogout(false)}
      />
    </aside>
  );
}

export default Sidebar;
