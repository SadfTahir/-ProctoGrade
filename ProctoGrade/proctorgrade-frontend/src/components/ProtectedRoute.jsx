// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ requiredRole, children }) {
  const userJson = localStorage.getItem("user");
  const token = localStorage.getItem("token");
  const user = userJson ? JSON.parse(userJson) : null;

  // If not logged in, send to login
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  // If a role is required and user doesn't have it, block access
  if (requiredRole && user.role !== requiredRole) {
    // Optional: redirect to a "Not Authorized" page or home
    return <Navigate to="/" replace />;
  }

  // Otherwise, allow access
  return children;
}
