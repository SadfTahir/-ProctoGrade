import React, { useState } from "react";
import "../../Pages/Dashboards/InstructorDashboard.css";

const BACKEND_URL = "http://localhost:5000";

export default function InstructorClasses({
  myClasses,
  setMyClasses,       
  loadingClasses,
  classesError,
  onViewStudents,
}) {
  const [editingClassId, setEditingClassId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editSection, setEditSection] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [localError, setLocalError] = useState("");

  const token = localStorage.getItem("token");

  const startEdit = (cls) => {
    setEditingClassId(cls.id);
    setEditName(cls.name || "");
    setEditSection(cls.section || "");
    setEditSubject(cls.subject || "");
    setLocalError("");
  };

  const cancelEdit = () => {
    setEditingClassId(null);
    setEditName("");
    setEditSection("");
    setEditSubject("");
    setLocalError("");
  };

  const handleSave = async (classId) => {
    if (!token) {
      setLocalError("Not authenticated.");
      return;
    }
    if (!editName.trim()) {
      setLocalError("Class name is required.");
      return;
    }

    try {
      setSaving(true);
      setLocalError("");

      const res = await fetch(`${BACKEND_URL}/api/classes/${classId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName,
          section: editSection,
          subject: editSubject,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.msg || "Failed to update class");
      }

      
      setMyClasses((prev) =>
        prev.map((cls) =>
          cls.id === classId
            ? { ...cls, name: editName, section: editSection, subject: editSubject }
            : cls
        )
      );
      setEditingClassId(null);
    } catch (err) {
      console.error("Error updating class:", err);
      setLocalError(err.message || "Error updating class");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (classId) => {
    if (!token) {
      setLocalError("Not authenticated.");
      return;
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this class? Students will no longer see it."
    );
    if (!confirmDelete) return;

    try {
      setDeleteLoadingId(classId);
      setLocalError("");

      const res = await fetch(`${BACKEND_URL}/api/classes/${classId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.msg || "Failed to delete class");
      }

      // ✅ Correct: remove from list
      setMyClasses((prev) => prev.filter((cls) => cls.id !== classId));
    } catch (err) {
      console.error("Error deleting class:", err);
      setLocalError(err.message || "Error deleting class");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <div className="tab-panel">
      <h3 className="panel-title">My Classes</h3>

      {loadingClasses && <p>Loading classes...</p>}
      {classesError && <p className="error-text">{classesError}</p>}
      {localError && <p className="error-text">{localError}</p>}

      {!loadingClasses && !classesError && myClasses.length === 0 && (
        <p className="muted-text">You have not created any classes yet.</p>
      )}

      <div className="classes-grid">
        {myClasses.map((cls) => {
          const isEditing = editingClassId === cls.id;

          return (
            <div key={cls.id} className="class-card">
              <div className="class-card-header">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Class name"
                      className="class-input"
                    />
                    <input
                      type="text"
                      value={editSection}
                      onChange={(e) => setEditSection(e.target.value)}
                      placeholder="Section (optional)"
                      className="class-input"
                    />
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder="Subject (optional)"
                      className="class-input"
                    />
                  </>
                ) : (
                  <>
                    <h4 className="class-name">{cls.name}</h4>
                    {cls.subject && (
                      <span className="class-subject">{cls.subject}</span>
                    )}
                  </>
                )}
              </div>

              {!isEditing && (
                <div className="class-meta">
                  <span className="class-code-label">Class code</span>
                  <span className="class-code-value">{cls.joinCode}</span>
                </div>
              )}

              <div className="class-actions-row">
                {!isEditing && (
                  <>
                    <button
                      type="button"
                      className="class-primary-btn"
                      onClick={() => onViewStudents && onViewStudents(cls)}
                    >
                      View Class
                    </button>
                    <button
                      type="button"
                      className="class-secondary-btn"
                      onClick={() => startEdit(cls)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="class-danger-btn"
                      onClick={() => handleDelete(cls.id)}
                      disabled={deleteLoadingId === cls.id}
                    >
                      {deleteLoadingId === cls.id ? "Deleting..." : "Delete"}
                    </button>
                  </>
                )}

                {isEditing && (
                  <>
                    <button
                      type="button"
                      className="class-primary-btn"
                      onClick={() => handleSave(cls.id)}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      className="class-secondary-btn"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
