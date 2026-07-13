import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import LogoutConfirmModal from "../LogoutConfirmModal";
import "./AdminComponents.css";

const NAV_ITEMS = [
  { to: "/admin-dashboard", end: true, icon: "🏠", label: "Dashboard" },
  { to: "/admin-dashboard/users",             icon: "👥", label: "Users" },
  { to: "/admin-dashboard/contact-inquiries", icon: "✉️", label: "Inquiries" },
];

function Sidebar() {
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  function confirmLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setShowLogout(false);
    navigate("/login");
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">P</div>
        <span>ProctoGrade</span>
      </div>

      {/* Nav label */}
      <div className="sidebar-nav-label">MENU</div>

      {/* Nav links */}
      <nav>
        {NAV_ITEMS.map(({ to, end, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
          >
            <span className="sidebar-link-icon">{icon}</span>
            <span className="sidebar-link-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom spacer */}
      <div style={{ flex: 1 }} />

      {/* Version tag */}
      <div className="sidebar-footer">
        <span>Admin Panel</span>
        <span className="sidebar-version">v1.0</span>
      </div>

      <LogoutConfirmModal
        open={showLogout}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogout(false)}
      />
    </aside>
  );
}

export default Sidebar;