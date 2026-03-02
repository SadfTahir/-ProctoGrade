import React from "react";
import "./AdminComponents.css";

function DashboardStats({ stats }) {
  return (
    <div className="dashboard-stats-wrapper">
      <div className="dashboard-stat-card">
        <div className="stat-label">Total Users</div>
        <div className="stat-value">{stats.totalUsers}</div>
      </div>
      <div className="dashboard-stat-card">
        <div className="stat-label">Total Instructors</div>
        <div className="stat-value">{stats.totalInstructors}</div>
      </div>
      <div className="dashboard-stat-card">
        <div className="stat-label">Total Students</div>
        <div className="stat-value">{stats.totalStudents}</div>
      </div>
      <div className="dashboard-stat-card">
        <div className="stat-label">Active Exams</div>
        <div className="stat-value">{stats.activeExams}</div>
      </div>
    </div>
  );
}

export default DashboardStats;
