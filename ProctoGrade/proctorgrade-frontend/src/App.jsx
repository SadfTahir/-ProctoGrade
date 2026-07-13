import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";

import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";

import Home from "./Pages/Static/Home";
import About from "./Pages/Static/About";
import Contact from "./Pages/Static/Contact";
import TermsPage from "./Pages/Static/TermsPage";
import PrivacyPage from "./Pages/Static/PrivacyPage";

import Login from "./Pages/Auth/Login";
import Register from "./Pages/Auth/Register";
import VerifyEmail from "./Pages/Auth/VerifyEmail";
import ForgotPassword from "./Pages/Auth/ForgotPassword";
import ResetPassword from "./Pages/Auth/ResetPassword"; 

import AdminDashboard from "./Pages/Dashboards/AdminDashboard";
import InstructorDashboard from "./Pages/Dashboards/InstructorDashboard";
import StudentDashboard from "./Pages/Dashboards/StudentDashboard";

import UserManagement from "./components/AdminComponents/UserManagement";
import ContactInquiries from "./components/AdminComponents/ContactInquiries";
import ProtectedRoute from "./components/ProtectedRoute";
import StudentClassDetailView from "./components/StudentComponents/StudentClassDetailView";
import StudentExamAttempt from "./components/StudentComponents/StudentExamAttempt";

import TeacherExamResults from './components/InstructorComponents/TeacherExamResults';

function LayoutManager({ children }) {
  const location = useLocation();

  const dashboardPrefixes = [
    "/admin-dashboard",
    "/instructor-dashboard",
    "/student-dashboard",
  ];

  const hideHeaderFooter = dashboardPrefixes.some((prefix) =>
    location.pathname.startsWith(prefix)
  );

  return (
    <>
      {!hideHeaderFooter && <Header />}
      {children}
      {!hideHeaderFooter && <Footer />}
    </>
  );
}

function App() {
  return (
    <Router>
      <LayoutManager>
        <Routes>
          <Route path="/" element={<Home />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} /> {/* NEW */}

          {/* Static pages */}
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />

          {/* Protected dashboards */}
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard/users"
            element={
              <ProtectedRoute requiredRole="admin">
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/instructor-dashboard"
            element={
              <ProtectedRoute requiredRole="instructor">
                <InstructorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student-dashboard"
            element={
              <ProtectedRoute requiredRole="examinee">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard/contact-inquiries"
            element={
              <ProtectedRoute requiredRole="admin">
                <ContactInquiries />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student-dashboard/classes/:id"
            element={
              <ProtectedRoute requiredRole="examinee">
                <StudentClassDetailView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student-dashboard/exams/:examId"
            element={
              <ProtectedRoute requiredRole="examinee">
                <StudentExamAttempt />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/instructor-dashboard/exams/:examId/results"
            element={
              <ProtectedRoute requiredRole="instructor">
               <TeacherExamResults />
              </ProtectedRoute>
            } 
          />
          
        </Routes>
      </LayoutManager>
    </Router>
  );
}

export default App;
