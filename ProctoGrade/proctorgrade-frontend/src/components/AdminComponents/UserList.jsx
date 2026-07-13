import React, { useState, useEffect } from "react";
import "./AdminComponents.css";

function getStatus(user) {
  if (user.isVerified === false) return "Pending Verification";
  return "Active";
}

function UserList({
  onEdit,
  onDelete,
  onViewProfile,
  filterRole,
  statusFilter,
  searchTerm,
  selectedUsers,
  onSelectionChange
}) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/auth/users")
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(() => setUsers([]));
  }, []);

  const isSelected = (id) =>
    selectedUsers.some((u) => u._id === id);

  const toggleSelectAll = () => {
    const filtered = getFilteredUsers();
    if (!filtered.length) {
      onSelectionChange([]);
      return;
    }
    const allSelected = filtered.every((u) => isSelected(u._id));
    if (allSelected) {
      const remaining = selectedUsers.filter(
        (sel) => !filtered.some((u) => u._id === sel._id)
      );
      onSelectionChange(remaining);
    } else {
      const combined = [
        ...selectedUsers,
        ...filtered.filter((u) => !isSelected(u._id))
      ];
      onSelectionChange(combined);
    }
  };

  const toggleSingle = (user) => {
    if (isSelected(user._id)) {
      onSelectionChange(
        selectedUsers.filter((u) => u._id !== user._id)
      );
    } else {
      onSelectionChange([...selectedUsers, user]);
    }
  };

  const getFilteredUsers = () => {
    let list = [...users];

    if (filterRole === "instructor") {
      list = list.filter((u) => u.role === "instructor");
    } else if (filterRole === "student") {
      list = list.filter((u) => u.role === "examinee");
    }

    if (statusFilter === "active") {
      list = list.filter((u) => getStatus(u) === "Active");
    } else if (statusFilter === "pending") {
      list = list.filter((u) => getStatus(u) === "Pending Verification");
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(term)) ||
          (u.email && u.email.toLowerCase().includes(term))
      );
    }

    list.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da; // newest first
    });

    return list;
  };

  const filteredUsers = getFilteredUsers();
  const allVisibleSelected =
    filteredUsers.length &&
    filteredUsers.every((u) => isSelected(u._id));

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <span className="section-icon">📋</span>
        <h2>Users List</h2>
      </div>
      <table className="admin-user-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={!!filteredUsers.length && allVisibleSelected}
                onChange={toggleSelectAll}
              />
            </th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Registered</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length ? (
            filteredUsers.map((user) => {
              const status = getStatus(user);
              return (
                <tr key={user._id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isSelected(user._id)}
                      onChange={() => toggleSingle(user)}
                    />
                  </td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <span
                      className={
                        status === "Active"
                          ? "status-badge status-active"
                          : "status-badge status-pending"
                      }
                    >
                      {status}
                    </span>
                  </td>
                  <td>
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString()
                      : ""}
                  </td>
                  <td>
                    <button onClick={() => onViewProfile && onViewProfile(user)}>
                      View
                    </button>
                    <button onClick={() => onEdit(user)}>Edit</button>
                    <button onClick={() => onDelete(user)}>Delete</button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="7">No users found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default UserList;
