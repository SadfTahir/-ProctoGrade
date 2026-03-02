import React, { useRef, useEffect } from "react";
import "./AdminComponents.css";

// Notification Panel
function NotificationPanel({ notifications, open, onClose }) {
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
  return (
    <div ref={panelRef} className="notification-panel">
      <div className="notification-header">New Users Joined</div>
      {notifications.length === 0 ? (
        <div className="notification-empty">No new users</div>
      ) : notifications.map((user, idx) => (
        <div key={user._id || idx} className="notification-item">
          <b>{user.name}</b> <span>({user.role})</span>
          <div style={{ fontSize: 13, color: "#607ca0" }}>{user.email}</div>
          <div style={{ fontSize: 12, color: "#8187a6" }}>{user.createdAt ? new Date(user.createdAt).toLocaleString() : ""}</div>
        </div>
      ))}
    </div>
  );
}

function Topbar({
  adminName,
  adminEmail,
  newUserCount,
  notifications = [],
  notificationOpen,
  setNotificationOpen
}) {
  function onBellClicked() {
    if (!notificationOpen && setNotificationOpen) {
      setNotificationOpen(true);
    } else if (setNotificationOpen) {
      setNotificationOpen(false);
    }
  }
  return (
    <header className="admin-topbar">
      <div className="topbar-left"></div>
      <div className="topbar-right">
        {/* Everything in one row */}
        <div className="topbar-profile-row">
          <button
            className="topbar-icon"
            onClick={onBellClicked}
            style={{ position: "relative", marginRight: "1.1rem" }}
            aria-label="Show notifications"
          >
            <svg width="23" height="23" fill="none" viewBox="0 0 24 24">
              <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.1-1.64-5.64-5-6.32V4a1 1 0 0 0-2 0v0.68C7.64 5.36 6 7.89 6 11v5l-1.71 1.71a1 1 0 0 0 .71 1.71h14a1 1 0 0 0 .71-1.71L18 16z" fill="#186ad6"/>
            </svg>
            {newUserCount > 0 && !notificationOpen && (
              <span className="notification-badge">{newUserCount}</span>
            )}
          </button>
          <span style={{ fontWeight: 600, color: "#186ad6" }}>👤 {adminName || "Admin"}</span>
          <span style={{
            fontWeight: 400,
            fontSize: "0.98rem",
            color: "#607ca0",
            marginLeft: "1rem",
            whiteSpace: "nowrap"
          }}>{adminEmail}</span>
          <NotificationPanel
            notifications={notifications}
            open={!!notificationOpen}
            onClose={() => setNotificationOpen && setNotificationOpen(false)}
          />
        </div>
      </div>
    </header>
  );
}

export default Topbar;
