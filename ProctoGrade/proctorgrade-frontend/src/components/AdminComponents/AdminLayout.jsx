import React from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "./AdminComponents.css";

function AdminLayout({
  children,
  adminName,
  adminEmail,
  newUserCount,
  notifications,
  notificationOpen,
  setNotificationOpen,
  onBellClick
}) {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">
        <Topbar
          adminName={adminName}
          adminEmail={adminEmail}
          newUserCount={newUserCount}
          notifications={notifications}
          notificationOpen={notificationOpen}
          setNotificationOpen={setNotificationOpen}
          onBellClick={onBellClick}
        />
        {children}
      </main>
    </div>
  );
}

export default AdminLayout;
