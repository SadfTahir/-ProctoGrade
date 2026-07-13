// src/pages/InstructorDashboard/InstructorDashboard.jsx
// ✅ Complete UI-linked file matching data states with real-time stats cards

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

  // Tab & UI States
  const [activeTab, setActiveTab] = useState("classes");
  const [userInfo, setUserInfo] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Form states
  const [className, setClassName] = useState("");
  const [classSection, setClassSection] = useState("");
  const [classSubject, setClassSubject] = useState("");
  const [classLoading, setClassLoading] = useState(false);
  const [classError, setClassError] = useState("");

  // Data states
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
        setUserInfo(JSON.parse(storedUser));
      } catch (e) {
        handleLogout();
      }
    }
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login");

    // Live counts on dashboard load
    fetchMyClasses();
    fetchExams();
  }, [navigate]);

  async function fetchMyClasses() {
    const token = localStorage.getItem("token");
    try {
      setLoadingClasses(true);
      const res = await fetch(`${BACKEND_URL}/api/classes/my-teacher`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      if (Array.isArray(data)) setMyClasses(data);
    } catch (err) {
      setClassesError("Error loading classes");
    } finally {
      setLoadingClasses(false);
    }
  }

  async function fetchExams() {
    try {
      setLoadingExams(true);
      const res = await fetch(`${BACKEND_URL}/api/exams`);
      const data = await res.json();
      if (Array.isArray(data)) setAllExams(data);
    } catch (err) {
      setExamsError("Failed to load exams");
    } finally {
      setLoadingExams(false);
    }
  }

  useEffect(() => {
    if (activeTab === "assigned-tests") {
      fetchExams();
    }
  }, [activeTab]);

  const handleCreateClass = async () => {
    if (!className.trim()) return setClassError("Class name is required");
    setClassLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/classes/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ name: className, section: classSection, subject: classSubject }),
      });
      const data = await res.json();
      if (res.ok) {
        setMyClasses([...myClasses, data.cls]);
        setActiveTab("classes");
        setClassName("");
        setClassSection("");
        setClassSubject("");
        setClassError("");
      }
    } catch (err) {
      setClassError("Error creating class");
    } finally {
      setClassLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".instructor-profile-wrapper")) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── DYNAMIC STATS COMPUTATION ───
  // ✅ Maps directly with the new backend schema data values
  const totalStudents = myClasses.reduce((acc, cls) => acc + (cls.studentCount || 0), 0);
  const activeExams = allExams.filter((e) => e.status === "Active").length;

  return (
    <div className="instructor-dashboard">

      {/* ─── TOP BAR ─── */}
      <header className="instructor-topbar">
        <div className="topbar-left">
          <div className="logo-mark">PG</div>
          <h2 className="app-title">ProctoGrade</h2>
          <span className="app-subtitle">Instructor Portal</span>
        </div>

        <div className="topbar-right">
          <button className="notif-btn" title="Notifications">
            🔔
            <span className="notif-dot" />
          </button>

          <div
            className="instructor-profile-wrapper"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="instructor-profile">
              <div className="avatar-circle">
                {userInfo?.name?.charAt(0).toUpperCase() || "T"}
              </div>
              <div className="profile-info">
                <span className="profile-name">{userInfo?.name || "Instructor"}</span>
                <span className="profile-role">● Active</span>
              </div>
            </div>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="profile-dropdown-card">
                <div className="dropdown-header">
                  <div className="large-avatar">
                    {userInfo?.name?.charAt(0).toUpperCase() || "T"}
                  </div>
                  <h4>{userInfo?.name || "Instructor"}</h4>
                  <p>{userInfo?.email || "instructor@proctograde.com"}</p>
                </div>

                <div className="dropdown-divider" />

                <div className="dropdown-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Classes</span>
                    <span className="stat-value">{myClasses.length}</span>
                  </div>
                  <div className="stat-item" style={{ marginTop: "6px" }}>
                    <span className="stat-label">Total Students</span>
                    <span className="stat-value">{totalStudents}</span>
                  </div>
                </div>

                <button className="dropdown-logout-btn" onClick={handleLogout}>
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="instructor-main">

        {/* ─── SIDEBAR ─── */}
        <aside className="instructor-sidebar">
          <span className="sidebar-section-label">Main Menu</span>

          <button
            className={`sidebar-item ${activeTab === "classes" ? "active" : ""}`}
            onClick={() => { setActiveTab("classes"); setSelectedClass(null); }}
          >
            📚 My Classes
            {myClasses.length > 0 && (
              <span className="sidebar-badge">{myClasses.length}</span>
            )}
          </button>

          <button
            className={`sidebar-item ${activeTab === "create" ? "active" : ""}`}
            onClick={() => { setActiveTab("create"); setSelectedClass(null); }}
          >
            ➕ Create Class
          </button>

          <button
            className={`sidebar-item ${activeTab === "assigned-tests" ? "active" : ""}`}
            onClick={() => { setActiveTab("assigned-tests"); setSelectedClass(null); }}
          >
            📝 Assigned Tests
            {activeExams > 0 && (
              <span className="sidebar-badge amber">{activeExams}</span>
            )}
          </button>

          <div className="sidebar-divider" />

          <button className="sidebar-item sidebar-logout" onClick={handleLogout}>
            🚪 Sign Out
          </button>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="instructor-content">

          {/* Stats Summary Panel */}
          {activeTab === "classes" && !selectedClass && (
            <div className="stats-grid">
              
              <div className="stat-overview-card purple">
                <div className="stat-icon-wrap purple">📚</div>
                <div className="stat-card-label">Total Classes</div>
                <div className="stat-card-value">{myClasses.length}</div>
                <div className="stat-card-change up">↑ Active this semester</div>
                <div className="stat-progress-wrap">
                  <div className="stat-progress-track">
                    <div
                      className="stat-progress-fill purple"
                      style={{ width: `${Math.min(myClasses.length * 25, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="stat-overview-card green">
                <div className="stat-icon-wrap green">👥</div>
                <div className="stat-card-label">Total Students</div>
                <div className="stat-card-value">{totalStudents}</div>
                <div className="stat-card-change up">↑ Enrolled</div>
                <div className="stat-progress-wrap">
                  <div className="stat-progress-track">
                    <div
                      className="stat-progress-fill green"
                      style={{ width: `${Math.min(totalStudents * 5, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="stat-overview-card amber">
                <div className="stat-icon-wrap amber">📝</div>
                <div className="stat-card-label">Active Tests</div>
                <div className="stat-card-value">{activeExams}</div>
                <div className="stat-card-change neutral">
                  <span className="live-dot" />
                  Live now
                </div>
                <div className="stat-progress-wrap">
                  <div className="stat-progress-track">
                    <div
                      className="stat-progress-fill amber"
                      style={{ width: `${Math.min(activeExams * 25, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="stat-overview-card blue">
                <div className="stat-icon-wrap blue">✅</div>
                <div className="stat-card-label">Total Exams</div>
                <div className="stat-card-value">{allExams.length}</div>
                <div className="stat-card-change up">↑ All time</div>
                <div className="stat-progress-wrap">
                  <div className="stat-progress-track">
                    <div
                      className="stat-progress-fill blue"
                      style={{ width: `${Math.min(allExams.length * 10, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── MY CLASSES TAB ── */}
          {activeTab === "classes" && (
            <InstructorClasses
              myClasses={myClasses}
              loadingClasses={loadingClasses}
              onViewStudents={(cls) => {
                setSelectedClass(cls);
                setActiveTab("class-detail");
              }}
            />
          )}

          {/* ── CREATE CLASS TAB ── */}
          {activeTab === "create" && (
            <div className="tab-panel">
              <div className="create-class-wrapper">
                <div className="create-class-title">Create New Class</div>
                <div className="create-class-subtitle">
                  Fill in the details below to set up a new class for your students.
                </div>
                <CreateClassForm
                  className={className}
                  setClassName={setClassName}
                  classSection={classSection}
                  setClassSection={setClassSection}
                  classSubject={classSubject}
                  setClassSubject={setClassSubject}
                  handleCreateClass={handleCreateClass}
                  classLoading={classLoading}
                  classError={classError}
                />
              </div>
            </div>
          )}

          {/* ── CLASS DETAIL TAB ── */}
          {activeTab === "class-detail" && selectedClass && (
            <ClassDetailView
              classInfo={selectedClass}
              onBack={() => setActiveTab("classes")}
            />
          )}

          {/* ── ASSIGNED TESTS TAB ── */}
          {activeTab === "assigned-tests" && (
            <div className="tab-panel">
              <div className="panel-header">
                <h3 className="panel-title">Active Test Schedules</h3>
                <span className="muted-text">
                  {allExams.filter((e) => e.status !== "Draft").length} test(s) scheduled
                </span>
              </div>

              {loadingExams && <p className="muted-text">Loading exams...</p>}
              {examsError && <p className="error-text">{examsError}</p>}

              <div className="assigned-tests-list">
                {allExams
                  .filter((e) => e.status !== "Draft")
                  .map((exam) => (
                    <div key={exam._id} className="assigned-test-card">
                      <div className="test-header">
                        <h4>{exam.title}</h4>
                        <span className={`status-pill status-${exam.status?.toLowerCase()}`}>
                          {exam.status === "Active" && <span className="live-dot" />}
                          {exam.status}
                        </span>
                      </div>

                      <div className="test-meta">
                        <span>📅 {new Date(exam.startTime).toLocaleDateString()}</span>
                        <span>⏰ {new Date(exam.startTime).toLocaleTimeString()}</span>
                        <span>❓ {exam.questions?.length || 0} Questions</span>
                      </div>

                      <button
                        className="class-secondary-btn"
                        style={{ alignSelf: "flex-start" }}
                        onClick={() => {
                          const cls = myClasses.find(
                            (c) => String(c.id) === String(exam.classId)
                          );
                          if (cls) {
                            setSelectedClass(cls);
                            setActiveTab("class-detail");
                          }
                        }}
                      >
                        View Class Details →
                      </button>
                    </div>
                  ))}

                {!loadingExams && allExams.filter((e) => e.status !== "Draft").length === 0 && (
                  <p className="muted-text" style={{ textAlign: "center", padding: "2rem 0" }}>
                    No active tests scheduled yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}