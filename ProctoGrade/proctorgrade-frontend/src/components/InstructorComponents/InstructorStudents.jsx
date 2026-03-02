// src/components/InstructorComponents/InstructorStudents.jsx
import React, { useEffect, useState } from "react";
import "../../Pages/Dashboards/InstructorDashboard.css";

const BACKEND_URL = "http://localhost:5000";

export default function InstructorStudents({ selectedClassId }) {
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState("");
  const [removingId, setRemovingId] = useState(null);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const fetchStudents = async () => {
    if (!selectedClassId || !token) return;

    try {
      setLoadingStudents(true);
      setStudentsError("");
      const res = await fetch(
        `${BACKEND_URL}/api/classes/${selectedClassId}/students`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.msg || "Failed to load students");
      }

      const data = await res.json();
      setStudents(data);
    } catch (err) {
      console.error("Error fetching students:", err);
      setStudentsError(err.message || "Error loading students");
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (!selectedClassId) return;
    if (!token) {
      setStudentsError("Not authenticated.");
      return;
    }
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId]);

  const handleRemove = async (studentId) => {
    if (!token) {
      setStudentsError("Not authenticated.");
      return;
    }

    const confirmRemove = window.confirm(
      "Are you sure you want to remove this student from the class?"
    );
    if (!confirmRemove) return;

    try {
      setRemovingId(studentId);
      setStudentsError("");

      const res = await fetch(
        `${BACKEND_URL}/api/classes/${selectedClassId}/students/${studentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.msg || "Failed to remove student");
      }

      setStudents((prev) => prev.filter((s) => s.id !== studentId));
    } catch (err) {
      console.error("Error removing student:", err);
      setStudentsError(err.message || "Error removing student");
    } finally {
      setRemovingId(null);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  };

  return (
    <div>
      {loadingStudents && <p className="muted-text">Loading students...</p>}
      {studentsError && <p className="error-text">{studentsError}</p>}

      {!loadingStudents && !studentsError && students.length === 0 && (
        <p className="muted-text">No students enrolled in this class yet.</p>
      )}

      {students.length > 0 && (
        <table className="students-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Student name</th>
              <th>Email</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((stu, index) => (
              <tr key={stu.id}>
                <td>{index + 1}</td>
                <td>{stu.name}</td>
                <td>{stu.email}</td>
                <td>{formatDate(stu.joinedAt)}</td>
                <td>
                  <button
                    type="button"
                    className="class-danger-btn"
                    onClick={() => handleRemove(stu.id)}
                    disabled={removingId === stu.id}
                  >
                    {removingId === stu.id ? "Removing..." : "Remove"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
