import React from "react";
import "../../Pages/Dashboards/InstructorDashboard.css";

export default function CreateClassForm({
  className,
  setClassName,
  classSection,
  setClassSection,
  classSubject,
  setClassSubject,
  classError,
  classLoading,
  createdClassInfo,
  handleCreateClass,
}) {
  return (
    <div className="tab-panel">
      <h3 className="panel-title">Create Class (Join Code)</h3>

      <div className="ai-form">
        <label className="ai-field">
          <span>Class Name:</span>
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="e.g. BSCS-5A"
          />
        </label>

        {/* Section dropdown */}
        <label className="ai-field">
          <span>Section:</span>
          <select
            value={classSection}
            onChange={(e) => setClassSection(e.target.value)}
          >
            <option value="">Select section</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </label>

        <label className="ai-field">
          <span>Subject:</span>
          <input
            type="text"
            value={classSubject}
            onChange={(e) => setClassSubject(e.target.value)}
            placeholder="e.g. Machine Learning"
          />
        </label>

        {classError && <div className="ai-error">{classError}</div>}

        <button
          className="ai-generate-btn"
          onClick={handleCreateClass}
          disabled={classLoading}
        >
          {classLoading ? "Creating..." : "Create Class"}
        </button>
      </div>

      {createdClassInfo && (
        <div className="ai-result" style={{ marginTop: "1rem" }}>
          <strong>Class created successfully!</strong>
          <br />
          Name: {createdClassInfo.name}
          <br />
          Subject: {createdClassInfo.subject || "-"}
          <br />
          Join Code:{" "}
          <span style={{ fontWeight: 700, color: "#4f46e5" }}>
            {createdClassInfo.joinCode}
          </span>
          <br />
          <small>
            Share this code with students so they can join this class.
          </small>
        </div>
      )}
    </div>
  );
}
