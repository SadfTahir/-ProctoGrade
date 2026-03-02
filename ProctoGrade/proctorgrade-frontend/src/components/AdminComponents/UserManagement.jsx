import React, { useState } from "react";
import AdminLayout from "./AdminLayout";
import AddUser from "./AddUser";
import UserList from "./UserList";
import EditUserModal from "./EditUserModal";
import DeleteUserConfirmation from "./DeleteUserConfirmation";

export default function UserManagement() {
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [refresh, setRefresh] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const triggerRefresh = () => setRefresh(r => !r);

  return (
    <AdminLayout>
      <h1>User Management</h1>
      <AddUser onUserAdded={triggerRefresh} />
      <UserList
        key={refresh}
        onEdit={setEditUser}
        onDelete={setDeleteUser}
      />
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
            const res = await fetch(`http://localhost:5000/api/auth/users/${deleteUser._id}`, {
              method: "DELETE"
            });
            const result = await res.json();
            if (res.ok) {
              setDeleteUser(null);
              triggerRefresh();
            } else {
              setDeleteError(result.error || result.msg || "Delete failed");
            }
          } catch (err) {
            setDeleteError("Delete failed - server error");
          }
          setDeleting(false);
        }}
        onCancel={() => setDeleteUser(null)}
        deleting={deleting}
        error={deleteError}
      />
    </AdminLayout>
  );
}
