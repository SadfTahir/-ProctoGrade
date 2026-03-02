// src/Pages/CalendarTab.jsx
import React from "react";
import "../InstructorDashboard.css";

export default function CalendarTab() {
  return (
    <div className="tab-panel">
      <h3 className="panel-title">Calendar</h3>
      <p className="muted-text">
        Calendar view for classes, tests, and deadlines will be shown here.
      </p>

      {/* Simple calendar placeholder */}
      <div className="calendar-placeholder">
        <div className="calendar-month">
          <div className="calendar-header">
            <span>December 2025</span>
          </div>
          <div className="calendar-weekdays">
            <span>S</span>
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>T</span>
            <span>F</span>
            <span>S</span>
          </div>
          <div className="calendar-dates">
            {[...Array(31)].map((_, i) => (
              <div key={i + 1} className="calendar-date">
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="calendar-events">
        <h4>Upcoming Events</h4>
        <ul className="events-list">
          <li>
            <strong>Class: BSCS-5A</strong> – 10 Dec 2025
          </li>
          <li>
            <strong>Quiz: ML Basics</strong> – 12 Dec 2025
          </li>
          <li>
            <strong>Class: BSCS-6B</strong> – 15 Dec 2025
          </li>
        </ul>
      </div>
    </div>
  );
}
