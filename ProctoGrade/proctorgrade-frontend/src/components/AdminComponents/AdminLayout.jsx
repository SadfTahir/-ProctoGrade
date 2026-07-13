import React from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "./AdminComponents.css";

function AdminLayout({
  children,
  adminName,
  adminEmail,
  badgeCount = 0,
  contactNotifications = [],
  userNotifications = [],
  notificationOpen,
  setNotificationOpen,
  onBellClick,
}) {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">
        <Topbar
          adminName={adminName}
          adminEmail={adminEmail}
          badgeCount={badgeCount}
          contactNotifications={contactNotifications}
          userNotifications={userNotifications}
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
