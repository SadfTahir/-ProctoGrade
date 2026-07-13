import { useState, useEffect, useCallback } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/**
 * Shared admin top-bar notifications: new users (vs last seen) + unread contact form messages.
 */
export function useAdminNotifications() {
  const [recentUsers, setRecentUsers] = useState([]);
  const [pendingUserAlerts, setPendingUserAlerts] = useState([]);
  const [contactUnread, setContactUnread] = useState(0);
  const [contactPreview, setContactPreview] = useState([]);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const [recentRes, msgRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/auth/users/recent`).then((r) => r.json()),
        token
          ? fetch(`${BACKEND_URL}/api/contact/messages`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then((r) => (r.ok ? r.json() : []))
          : Promise.resolve([]),
      ]);

      const recent = Array.isArray(recentRes) ? recentRes : [];
      setRecentUsers(recent);

      const lastSeenLen = parseInt(localStorage.getItem("recentUserCount") || "0", 10);
      if (recent.length > lastSeenLen) {
        const n = recent.length - lastSeenLen;
        setPendingUserAlerts(recent.slice(0, n));
      } else {
        setPendingUserAlerts([]);
      }

      const messages = Array.isArray(msgRes) ? msgRes : [];
      const unread = messages.filter((m) => !m.read);
      setContactUnread(unread.length);
      setContactPreview(unread.slice(0, 12));
    } catch {
      setRecentUsers([]);
      setPendingUserAlerts([]);
      setContactUnread(0);
      setContactPreview([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleBellClick = useCallback(() => {
    const opening = !notificationOpen;

    if (opening) {
      localStorage.setItem("recentUserCount", String(recentUsers.length));

      const token = localStorage.getItem("token");
      if (token && contactUnread > 0) {
        fetch(`${BACKEND_URL}/api/contact/messages/mark-read`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ all: true }),
        })
          .then(() => {
            setContactUnread(0);
            setContactPreview([]);
          })
          .catch(() => {});
      }
    } else {
      setPendingUserAlerts([]);
    }

    setNotificationOpen((v) => !v);
  }, [notificationOpen, recentUsers.length, contactUnread]);

  const badgeCount = pendingUserAlerts.length + contactUnread;

  return {
    recentUsers,
    pendingUserAlerts,
    contactUnread,
    contactPreview,
    notificationOpen,
    setNotificationOpen,
    handleBellClick,
    refreshNotifications: load,
    badgeCount,
  };
}
