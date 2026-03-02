import React, { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminComponents/AdminLayout";
import DashboardStats from "../../components/AdminComponents/DashboardStats";

// Utility to fetch admin info from localStorage
function getAdmin() {
  // It's best to read from user object, but use legacy keys if needed.
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch (_) {}
  return {
    name: user?.name || localStorage.getItem("adminName") || "Admin User",
    email: user?.email || localStorage.getItem("adminEmail") || "admin@email.com",
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalInstructors: 0,
    totalStudents: 0,
    activeExams: 0,
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [admin, setAdmin] = useState(getAdmin());
  const [newUserCount, setNewUserCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:5000/api/auth/users").then(res => res.json()),
      fetch("http://localhost:5000/api/exams/active").then(res => res.json()),
      fetch("http://localhost:5000/api/auth/users/recent").then(res => res.json())
    ]).then(([users, exams, recent]) => {
      const instructors = users.filter(u => u.role === "instructor").length;
      const students = users.filter(u => u.role === "examinee").length;
      setStats({
        totalUsers: users.length,
        totalInstructors: instructors,
        totalStudents: students,
        activeExams: Array.isArray(exams) ? exams.length : 0,
      });
      setRecentUsers(recent);

      // Notification count logic: count new users since last viewed
      const lastSeenCount = parseInt(localStorage.getItem("recentUserCount") || 0, 10);
      if (recent.length > lastSeenCount) {
        setNewUserCount(recent.length - lastSeenCount);
      } else {
        setNewUserCount(0);
      }
    }).catch(() => {
      setStats({ totalUsers: 0, totalInstructors: 0, totalStudents: 0, activeExams: 0 });
      setRecentUsers([]);
      setNewUserCount(0);
    });
  }, []);

  // When bell or panel is clicked to view notifications
  function handleBellClick() {
    // Only clear badge/count if opening (not closing)
    if (!notificationOpen) {
      localStorage.setItem("recentUserCount", recentUsers.length);
      setNewUserCount(0);
    }
    setNotificationOpen(v => !v); // Toggle open/close
  }

  return (
    <AdminLayout
      adminName={admin.name}
      adminEmail={admin.email}
      newUserCount={newUserCount}
      notifications={recentUsers.slice(0, newUserCount)}
      notificationOpen={notificationOpen}
      setNotificationOpen={setNotificationOpen}
      onBellClick={handleBellClick}
    >
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="section-icon">📊</span>
          <h2>Admin Dashboard</h2>
        </div>
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "1.6rem",
          marginBottom: "2rem"
        }}>
          <div className="admin-info-card">
            <strong style={{ fontSize: "1.18rem" }}>{admin.name}</strong>
            <div style={{ color: "#607ca0", fontSize: "1rem", marginTop: "0.2rem" }}>
              {admin.email}
            </div>
          </div>
        </div>
        <DashboardStats stats={stats} />
      </div>
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="section-icon">👥</span>
          <h2>Recent Users</h2>
        </div>
        <table className="admin-user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Date Joined</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.length ? recentUsers.map(user => (
              <tr key={user._id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4">No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
