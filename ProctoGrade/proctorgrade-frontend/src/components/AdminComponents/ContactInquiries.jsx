import React, { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { useAdminNotifications } from "./useAdminNotifications";
import "./AdminComponents.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function getAdmin() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem("user")); } catch (_) {}
  return {
    name: user?.name || localStorage.getItem("adminName") || "Admin User",
    email: user?.email || localStorage.getItem("adminEmail") || "admin@email.com",
  };
}

export default function ContactInquiries() {
  const [admin] = useState(getAdmin());
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const {
    pendingUserAlerts, contactPreview, notificationOpen,
    setNotificationOpen, handleBellClick, badgeCount, refreshNotifications,
  } = useAdminNotifications();

  const loadMessages = async () => {
    const token = localStorage.getItem("token");
    if (!token) { setLoading(false); return; }
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/contact/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.msg || "Could not load messages"); setMessages([]); }
      else setMessages(Array.isArray(data) ? data : []);
    } catch { setError("Could not load messages"); setMessages([]); }
    setLoading(false);
  };

  useEffect(() => { loadMessages(); }, []);

  const markRead = async (ids) => {
    const token = localStorage.getItem("token");
    if (!token || !ids.length) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/contact/messages/mark-read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) { await loadMessages(); refreshNotifications(); }
    } catch {}
  };

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <AdminLayout
      adminName={admin.name}
      adminEmail={admin.email}
      badgeCount={badgeCount}
      contactNotifications={contactPreview}
      userNotifications={pendingUserAlerts}
      notificationOpen={notificationOpen}
      setNotificationOpen={setNotificationOpen}
      onBellClick={handleBellClick}
    >
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="section-icon">✉️</span>
          <h2>Contact Inquiries</h2>
        </div>

        <p className="unread-note">
          Messages from the public Contact Us form — Unread:{" "}
          <strong>{unreadCount}</strong>
        </p>

        {error && <p className="error-state">{error}</p>}

        {loading ? (
          <p className="loading-state">Loading messages</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-user-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {messages.length ? (
                  messages.map((m) => (
                    <tr key={m._id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: "0.82rem" }}>
                        {m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}
                      </td>
                      <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{m.name}</td>
                      <td>
                        <a href={`mailto:${m.email}`}>{m.email}</a>
                      </td>
                      <td className="contact-msg-cell">{m.message}</td>
                      <td>
                        <span className={m.read ? "status-read" : "status-unread"}>
                          {m.read ? "Read" : "Unread"}
                        </span>
                      </td>
                      <td>
                        {!m.read ? (
                          <button
                            type="button"
                            className="admin-inline-btn"
                            onClick={() => markRead([m._id])}
                          >
                            Mark read
                          </button>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">No contact messages yet</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}