import React, { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminComponents/AdminLayout";
import DashboardStats from "../../components/AdminComponents/DashboardStats";

function getAdmin() {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch (_) {}
  return {
    name: user?.name || localStorage.getItem("adminName") || "Admin User",
    email: user?.email || localStorage.getItem("adminEmail") || "admin@email.com",
  };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalInstructors: 0,
    totalStudents: 0,
    activeExams: 0,
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [admin] = useState(getAdmin());
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
      const lastSeenCount = parseInt(localStorage.getItem("recentUserCount") || 0, 10);
      setNewUserCount(recent.length > lastSeenCount ? recent.length - lastSeenCount : 0);
    }).catch(() => {
      setStats({ totalUsers: 0, totalInstructors: 0, totalStudents: 0, activeExams: 0 });
      setRecentUsers([]);
      setNewUserCount(0);
    });
  }, []);

  function handleBellClick() {
    if (!notificationOpen) {
      localStorage.setItem("recentUserCount", recentUsers.length);
      setNewUserCount(0);
    }
    setNotificationOpen(v => !v);
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });

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
      {/* Welcome Banner */}
      <div className="dashboard-welcome">
        <div className="dashboard-welcome-text">
          <h1>{getGreeting()}, {admin.name.split(" ")[0]} 👋</h1>
          <p>Here's what's happening on ProctoGrade today.</p>
        </div>
        <div className="dashboard-welcome-badge">📅 {today}</div>
      </div>

      {/* Stats */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="section-icon">📊</span>
          <h2>Overview</h2>
        </div>
        <DashboardStats stats={stats} />
      </div>

      {/* Recent Users */}
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="section-icon">👥</span>
          <h2>Recent Users</h2>
        </div>
        <div className="admin-table-wrap">
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
                  <td style={{ textTransform: "capitalize" }}>{user.role}</td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                    No recent users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}