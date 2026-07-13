import React from "react";
import "./AdminComponents.css";

const STAT_META = [
  { key: "totalUsers",       label: "Total Users",        icon: "👤" },
  { key: "totalInstructors", label: "Instructors",         icon: "🎓" },
  { key: "totalStudents",    label: "Students",            icon: "📚" },
  { key: "activeExams",      label: "Active Exams",        icon: "📝" },
  { key: "contactUnread",    label: "Unread Messages",     icon: "✉️" },
];

function DashboardStats({ stats }) {
  return (
    <div className="dashboard-stats-wrapper">
      {STAT_META.map(({ key, label, icon }) => (
        <div className="dashboard-stat-card" key={key}>
          <div style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>{icon}</div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{stats[key] ?? 0}</div>
        </div>
      ))}
    </div>
  );
}

export default DashboardStats;