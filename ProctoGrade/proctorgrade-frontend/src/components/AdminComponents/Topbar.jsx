import React, { useRef, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LogoutConfirmModal from "../LogoutConfirmModal";
import "./AdminComponents.css";

function NotificationPanel({ contactNotifications = [], userNotifications = [], open, onClose }) {
  const panelRef = useRef();

  useEffect(() => {
    function handle(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    }
    if (open) {
      document.addEventListener("mousedown", handle);
      return () => document.removeEventListener("mousedown", handle);
    }
  }, [open, onClose]);

  if (!open) return null;

  const hasContacts = contactNotifications.length > 0;
  const hasUsers = userNotifications.length > 0;
  const empty = !hasContacts && !hasUsers;

  return (
    <div ref={panelRef} className="notification-panel">
      {hasContacts && (<>
        <div className="notification-header">Contact Messages</div>
        {contactNotifications.map((msg, idx) => (
          <div key={msg._id || idx} className="notification-item notification-item-contact">
            <b>{msg.name}</b>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{msg.email}</div>
            <div className="notification-msg-preview">{msg.message}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}
            </div>
          </div>
        ))}
      </>)}
      {hasUsers && (<>
        <div className="notification-header">New Users</div>
        {userNotifications.map((user, idx) => (
          <div key={user._id || idx} className="notification-item">
            <b>{user.name}</b>{" "}
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>({user.role})</span>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{user.email}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              {user.createdAt ? new Date(user.createdAt).toLocaleString() : ""}
            </div>
          </div>
        ))}
      </>)}
      {empty && <div className="notification-empty">No new notifications</div>}
    </div>
  );
}

function getInitials(name = "") {
  return name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
}

const PAGE_TITLES = {
  "/admin-dashboard": "Dashboard",
  "/admin-dashboard/users": "User Management",
  "/admin-dashboard/contact-inquiries": "Contact Inquiries",
};

const PAGE_SUBTITLES = {
  "/admin-dashboard": "Welcome back! Here's what's happening.",
  "/admin-dashboard/users": "Manage and monitor all platform users.",
  "/admin-dashboard/contact-inquiries": "Review and respond to user inquiries.",
};

function Topbar({
  adminName, adminEmail, badgeCount = 0,
  contactNotifications = [], userNotifications = [],
  notificationOpen, setNotificationOpen, onBellClick,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  const pageTitle = PAGE_TITLES[location.pathname] || "Admin Panel";
  const pageSubtitle = PAGE_SUBTITLES[location.pathname] || "";

  function onBellClicked() {
    if (onBellClick) { onBellClick(); return; }
    if (setNotificationOpen) setNotificationOpen(!notificationOpen);
  }

  function confirmLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setShowLogout(false);
    navigate("/login");
  }

  return (
    <>
      <header className="admin-topbar">
        {/* Left: page title + subtitle */}
        <div className="topbar-page-info">
          <h1 className="topbar-page-title">{pageTitle}</h1>
          <p className="topbar-page-subtitle">{pageSubtitle}</p>
        </div>

        {/* Right: actions */}
        <div className="topbar-actions">

          {/* Bell */}
          <div style={{ position: "relative" }}>
            <button className="topbar-icon-btn" onClick={onBellClicked} aria-label="Notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.1-1.64-5.64-5-6.32V4a1 1 0 0 0-2 0v.68C7.64 5.36 6 7.89 6 11v5l-1.71 1.71A1 1 0 0 0 5 19h14a1 1 0 0 0 .71-1.71L18 16z" fill="#186ad6"/>
              </svg>
              {badgeCount > 0 && !notificationOpen && (
                <span className="notification-badge">{badgeCount > 99 ? "99+" : badgeCount}</span>
              )}
            </button>

            <NotificationPanel
              contactNotifications={contactNotifications}
              userNotifications={userNotifications}
              open={!!notificationOpen}
              onClose={() => setNotificationOpen && setNotificationOpen(false)}
            />
          </div>

          {/* Divider */}
          <div className="topbar-divider" />

          {/* Profile pill */}
          <div className="topbar-profile-pill">
            <div className="topbar-avatar">{getInitials(adminName)}</div>
            <div className="topbar-profile-text">
              <span className="topbar-profile-name">{adminName || "Admin"}</span>
              <span className="topbar-profile-role">Administrator</span>
            </div>
          </div>

          {/* Divider */}
          <div className="topbar-divider" />

          {/* Logout button */}
          <button className="topbar-logout-btn" onClick={() => setShowLogout(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" fill="#dc2626"/>
            </svg>
            Logout
          </button>
        </div>
      </header>

      <LogoutConfirmModal
        open={showLogout}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogout(false)}
      />
    </>
  );
}

export default Topbar;