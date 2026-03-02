import React, { useState } from "react";
import "../componentStyles.css";


export default function AssessmentTypesSection() {
  return (
    <section className="features" id="assessment-types">
      <h2>Assessment Types</h2>
      <div className="feature-grid">
        <div className="feature-card fade-in">
          <h3>MCQ-Based Assessments</h3>
          <p>
            Create and evaluate multiple-choice questions efficiently with AI-driven analytics, automated grading, and detailed performance insights.
          </p>
        </div>
        <div className="feature-card fade-in">
          <h3>Text-Based Assessments</h3>
          <p>
            Assess written responses with AI-powered evaluation, providing automated scoring, sentiment analysis, and constructive feedback.
          </p>
        </div>
      </div>
    </section>
  );
}
