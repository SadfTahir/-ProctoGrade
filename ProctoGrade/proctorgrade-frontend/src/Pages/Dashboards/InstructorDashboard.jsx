// src/Pages/InstructorDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./InstructorDashboard.css";
import AiTestGenerator from "../../components/InstructorComponents/AiTestGenerator";

import ClassDetailView from "../../components/InstructorComponents/ClassDetailView";
import InstructorClasses from "../../components/InstructorComponents/InstructorClasses";
import CreateClassForm from "../../components/InstructorComponents/CreateClassForm";

const BACKEND_URL = "http://localhost:5000";

export default function InstructorDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("classes");
  const [userInfo, setUserInfo] = useState(null);

  const [className, setClassName] = useState("");
  const [classSection, setClassSection] = useState("");
  const [classSubject, setClassSubject] = useState("");
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState("");
  const [createdClassInfo, setCreatedClassInfo] = useState(null);

  const [myClasses, setMyClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [classesError, setClassesError] = useState("");

  const [selectedClass, setSelectedClass] = useState(null);

  const [allExams, setAllExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examsError, setExamsError] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserInfo(parsed);
      } catch (e) {
        console.error("Error parsing user from localStorage", e);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }
    }

    const token = localStorage.getItem("token");
    if (!token) {
      console.log("No token found, redirecting to login...");
      navigate("/login");
      return;
    }

    async function fetchMyClasses() {
      try {
        setLoadingClasses(true);
        setClassesError("");
        const res = await fetch(`${BACKEND_URL}/api/classes/my-teacher`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401) {
          console.log("Token is invalid, logging out...");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.msg || "Failed to load classes");
        }

        const data = await res.json();
        if (Array.isArray(data)) {
          setMyClasses(
            data.map((cls) => ({
              id: cls.id,
              name: cls.name,
              subject: cls.subject,
              joinCode: cls.joinCode,
              section: cls.section,
            }))
          );
        }
      } catch (err) {
        console.error("Error fetching teacher classes:", err);
        setClassesError(err.message || "Error loading classes");
      } finally {
        setLoadingClasses(false);
      }
    }

    fetchMyClasses();
  }, [navigate]);

  const fetchAllExams = async () => {
    try {
      setLoadingExams(true);
      setExamsError("");
      const res = await fetch(`${BACKEND_URL}/api/exams`);
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(data.msg || data.error || "Failed to load exams");
      }
      setAllExams(data);
    } catch (err) {
      console.error("Error loading all exams:", err);
      setExamsError(err.message || "Error loading exams");
    } finally {
      setLoadingExams(false);
    }
  };

  useEffect(() => {
    if (activeTab === "assigned-tests") {
      fetchAllExams();
    }
  }, [activeTab]);

  const handleCreateClass = async () => {
    setClassError("");
    setCreatedClassInfo(null);

    if (!className.trim()) {
      setClassError("Please enter a class name.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setClassError("Not authenticated. Please log in again.");
      return;
    }

    setClassLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/classes/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: className,
          section: classSection,
          subject: classSubject,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.msg || "Failed to create class");
      }

      if (data.cls) {
        setCreatedClassInfo(data.cls);
        setMyClasses((prev) => [...prev, data.cls]);
      }

      setClassName("");
      setClassSection("");
      setClassSubject("");
    } catch (err) {
      console.error(err);
      setClassError("Error creating class. Please try again.");
    } finally {
      setClassLoading(false);
    }
  };

  const handleViewClass = (cls) => {
    setSelectedClass(cls);
    setActiveTab("class-detail");
  };

  return (
    <div className="instructor-dashboard">
      {/* Topbar */}
      <header className="instructor-topbar">
        <div className="topbar-left">
          <h2 className="app-title">ProctoGrade</h2>
          <span className="app-subtitle">Instructor Dashboard</span>
        </div>
        <div className="topbar-right">
          <div className="instructor-profile">
            <div className="avatar-circle">
              {userInfo?.name ? userInfo.name.charAt(0).toUpperCase() : "T"}
            </div>
            <div className="profile-info">
              <span className="profile-name">
                {userInfo?.name || "Teacher Name"}
              </span>
              <span className="profile-role">
                {userInfo?.email || "instructor@example.com"}
              </span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="instructor-main">
        {/* Sidebar */}
        <aside className="instructor-sidebar">
          <button
            className={
              activeTab === "classes" ? "sidebar-item active" : "sidebar-item"
            }
            onClick={() => {
              setActiveTab("classes");
              setSelectedClass(null);
            }}
          >
            Classes
          </button>
          <button
            className={
              activeTab === "create" ? "sidebar-item active" : "sidebar-item"
            }
            onClick={() => {
              setActiveTab("create");
              setSelectedClass(null);
            }}
          >
            Create Class
          </button>
          <button
            className={
              activeTab === "assigned-tests"
                ? "sidebar-item active"
                : "sidebar-item"
            }
            onClick={() => {
              setActiveTab("assigned-tests");
              setSelectedClass(null);
            }}
          >
            Assigned Tests
          </button>
        </aside>

        {/* Content area */}
        <main className="instructor-content">
          {activeTab === "classes" && (
            <InstructorClasses
              myClasses={myClasses}
              loadingClasses={loadingClasses}
              classesError={classesError}
              onViewStudents={handleViewClass}
              setMyClasses={setMyClasses}
            />
          )}

          {activeTab === "create" && (
            <CreateClassForm
              className={className}
              setClassName={setClassName}
              classSection={classSection}
              setClassSection={setClassSection}
              classSubject={classSubject}
              setClassSubject={setClassSubject}
              classError={classError}
              classLoading={classLoading}
              createdClassInfo={createdClassInfo}
              handleCreateClass={handleCreateClass}
            />
          )}

          {activeTab === "class-detail" && selectedClass && (
            <ClassDetailView
              classInfo={selectedClass}
              onBack={() => {
                setActiveTab("classes");
                setSelectedClass(null);
              }}
            />
          )}

          {activeTab === "assigned-tests" && (
            <div className="tab-panel">
              <h3 className="panel-title">All Assigned Tests</h3>

              {examsError && <p className="error-text">{examsError}</p>}
              {loadingExams && <p>Loading exams...</p>}

              {!loadingExams &&
                !examsError &&
                allExams.filter((e) => e.status !== "Draft").length === 0 && (
                  <p className="muted-text">
                    No tests scheduled yet. Create and schedule tests from class
                    views.
                  </p>
                )}

              {!loadingExams && !examsError && (
                <div className="assigned-tests-list">
                  {allExams
                    .filter((e) => e.status !== "Draft")
                    .map((exam) => {
                      const cls = myClasses.find(
                        (c) => String(c.id) === String(exam.classId)
                      );
                      return (
                        <div key={exam._id} className="assigned-test-card">
                          <div className="test-header">
                            <h4>{exam.title}</h4>
                            <span className="test-class">
                              {cls ? cls.name : "Unknown class"}
                            </span>
                          </div>
                          <div className="test-meta">
                            <div className="meta-item">
                              <strong>Status:</strong>
                              <span>{exam.status}</span>
                            </div>
                            <div className="meta-item">
                              <strong>Start:</strong>
                              <span>
                                {exam.startTime
                                  ? new Date(
                                      exam.startTime
                                    ).toLocaleString()
                                  : "-"}
                              </span>
                            </div>
                            <div className="meta-item">
                              <strong>End:</strong>
                              <span>
                                {exam.endTime
                                  ? new Date(exam.endTime).toLocaleString()
                                  : "-"}
                              </span>
                            </div>
                            <div className="meta-item">
                              <strong>Questions:</strong>
                              <span>{exam.questions?.length || 0}</span>
                            </div>
                          </div>
                          <div className="test-actions">
                            <button
                              className="class-secondary-btn"
                              onClick={() => {
                                if (cls) {
                                  setSelectedClass(cls);
                                  setActiveTab("class-detail");
                                }
                              }}
                            >
                              Go to Class
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
