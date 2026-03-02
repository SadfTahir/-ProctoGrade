// src/Pages/AssignedTestsTab.jsx
import React from "react";
import "../InstructorDashboard.css";

export default function AssignedTestsTab() {
  // Mock data (replace with real API call later)
  const assignedTests = [
    {
      id: 1,
      title: "Quiz: Linear Regression",
      class: "BSCS-5A",
      subject: "Machine Learning",
      dueDate: "2025-12-12",
      totalStudents: 32,
      submitted: 28,
    },
    {
      id: 2,
      title: "Quiz: Python Basics",
      class: "BSCS-6B",
      subject: "Programming",
      dueDate: "2025-12-15",
      totalStudents: 28,
      submitted: 15,
    },
  ];

  return (
    <div className="tab-panel">
      <h3 className="panel-title">Assigned Tests</h3>

      {assignedTests.length === 0 ? (
        <p className="muted-text">No tests have been assigned yet.</p>
      ) : (
        <div className="assigned-tests-list">
          {assignedTests.map((test) => (
            <div key={test.id} className="assigned-test-card">
              <div className="test-header">
                <h4>{test.title}</h4>
                <span className="test-class">
                  {test.class} ({test.subject})
                </span>
              </div>

              <div className="test-meta">
                <div className="meta-item">
                  <strong>Due:</strong>{" "}
                  {new Date(test.dueDate).toLocaleDateString()}
                </div>
                <div className="meta-item">
                  <strong>Students:</strong> {test.submitted}/{test.totalStudents}
                </div>
              </div>

              <div className="test-actions">
                <button className="class-secondary-btn">View Responses</button>
                <button className="class-primary-btn">Grade</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
