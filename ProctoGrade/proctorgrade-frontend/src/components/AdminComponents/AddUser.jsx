import React, { useState } from "react";
import "./AdminComponents.css";

function AddUser({ onUserAdded }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "instructor",
    password: ""
  });
  const [message, setMessage] = useState("");

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    fetch("http://localhost:5000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    })
      .then(res => res.json())
      .then((data) => {
        setMessage(data.msg || "User added!");
        setForm({ name: "", email: "", role: "instructor", password: "" });
        if (onUserAdded) onUserAdded();
      })
      .catch(() => setMessage("Error adding user."));
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <span className="section-icon">➕</span>
        <h2>Add New User</h2>
      </div>
      <form className="add-user-form" onSubmit={handleSubmit}>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Name"
          required
        />
        <input
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Email"
          type="email"
          required
        />
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Password"
          required
        />
        <select name="role" value={form.role} onChange={handleChange}>
          <option value="instructor">Instructor</option>
          <option value="examinee">Examinee</option>
        </select>
        <button type="submit">Add User</button>
        {message && <p>{message}</p>}
      </form>
    </div>
  );
}

export default AddUser;
