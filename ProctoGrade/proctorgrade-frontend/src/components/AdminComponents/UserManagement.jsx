import React, { useState } from "react";
import AdminLayout from "./AdminLayout";
import { useAdminNotifications } from "./useAdminNotifications";
import AddUser from "./AddUser";
import UserList from "./UserList";
import EditUserModal from "./EditUserModal";
import DeleteUserConfirmation from "./DeleteUserConfirmation";
import UserProfileModal from "./UserProfileModal";
import "./AdminComponents.css";

function getAdmin() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem("user")); } catch (_) {}
  return {
    name: user?.name || localStorage.getItem("adminName") || "Admin User",
    email: user?.email || localStorage.getItem("adminEmail") || "admin@email.com",
  };
}

export default function UserManagement() {
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [refresh, setRefresh] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [profileUser, setProfileUser] = useState(null);
  const [filterRole, setFilterRole] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [admin] = useState(getAdmin());
  const [showAddUser, setShowAddUser] = useState(false);

  const {
    pendingUserAlerts, contactPreview,
    notificationOpen, setNotificationOpen,
    handleBellClick, badgeCount,
  } = useAdminNotifications();

  const triggerRefresh = () => setRefresh(r => !r);

  const handleBulkDelete = async () => {
    if (!selectedUsers.length) return;
    if (!window.confirm(`Delete ${selectedUsers.length} selected user(s)?`)) return;
    setDeleting(true);
    setDeleteError("");
    try {
      for (const user of selectedUsers) {
        const res = await fetch(`http://localhost:5000/api/auth/users/${user._id}`, { method: "DELETE" });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || result.msg || "Delete failed");
      }
      setSelectedUsers([]);
      triggerRefresh();
    } catch (err) {
      setDeleteError(err.message || "Bulk delete failed");
    }
    setDeleting(false);
  };

  return (
    <AdminLayout
      adminName={admin.name}
      adminEmail={admin.email}
      badgeCount={badgeCount}
      contactNotifications={contactPreview}
      userNotifications={pendingUserAlerts}
      notificationOpen={notificationOpen}
      setNotificationOpen={setNotificationOpen}
      onBellClick={handleBellClick}
    >
      {/* Single clean card */}
      <div className="admin-section">

        {/* Header with Add User button */}
        <div className="admin-section-header">
          <span className="section-icon">👥</span>
          <h2>User Management</h2>
          <button
            className="add-user-fab-inline"
            onClick={() => setShowAddUser(true)}
            style={{ marginLeft: "auto" }}
          >
            <span>＋</span> Add User
          </button>
        </div>

        {/* Filters */}
        <div className="user-management-toolbar">
          <div className="user-role-tabs">
            {["all", "instructor", "student"].map(role => (
              <button
                key={role}
                type="button"
                className={filterRole === role ? "role-tab active" : "role-tab"}
                onClick={() => setFilterRole(role)}
              >
                {role === "all" ? "All Users" : role === "instructor" ? "Instructors" : "Students"}
              </button>
            ))}
          </div>

          <div className="user-filters-row">
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="🔍  Search by name or email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="status-filter-wrapper">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending Verification</option>
              </select>
            </div>
            <div className="bulk-actions-wrapper">
              <button
                type="button"
                className="bulk-btn danger"
                disabled={!selectedUsers.length || deleting}
                onClick={handleBulkDelete}
              >
                🗑 Delete Selected {selectedUsers.length > 0 && `(${selectedUsers.length})`}
              </button>
            </div>
          </div>

          {deleteError && (
            <p style={{ color: "var(--danger)", fontSize: "0.88rem", margin: 0 }}>{deleteError}</p>
          )}
        </div>

        {/* User List — directly inside same card */}
        <UserList
          key={refresh}
          onEdit={setEditUser}
          onDelete={setDeleteUser}
          onViewProfile={setProfileUser}
          filterRole={filterRole}
          statusFilter={statusFilter}
          searchTerm={searchTerm}
          selectedUsers={selectedUsers}
          onSelectionChange={setSelectedUsers}
        />
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="admin-modal" onClick={() => setShowAddUser(false)}>
          <div className="add-user-modal-box" onClick={e => e.stopPropagation()}>
            <div className="admin-section-header" style={{ marginBottom: "1.25rem" }}>
              <span className="section-icon">➕</span>
              <h2>Add New User</h2>
              <button
                onClick={() => setShowAddUser(false)}
                className="modal-close-x"
              >✕</button>
            </div>
            <AddUser
              onUserAdded={() => {
                triggerRefresh();
                setShowAddUser(false);
              }}
            />
          </div>
        </div>
      )}

      <EditUserModal
        open={!!editUser}
        user={editUser}
        onClose={() => setEditUser(null)}
        onUserUpdated={triggerRefresh}
      />
      <DeleteUserConfirmation
        open={!!deleteUser}
        user={deleteUser}
        onConfirm={async () => {
          setDeleting(true);
          setDeleteError("");
          try {
            const res = await fetch(`http://localhost:5000/api/auth/users/${deleteUser._id}`, { method: "DELETE" });
            const result = await res.json();
            if (res.ok) { setDeleteUser(null); triggerRefresh(); }
            else setDeleteError(result.error || result.msg || "Delete failed");
          } catch { setDeleteError("Delete failed - server error"); }
          setDeleting(false);
        }}
        onCancel={() => setDeleteUser(null)}
        deleting={deleting}
        error={deleteError}
      />
      <UserProfileModal
        open={!!profileUser}
        user={profileUser}
        onClose={() => setProfileUser(null)}
      />
    </AdminLayout>
  );
}