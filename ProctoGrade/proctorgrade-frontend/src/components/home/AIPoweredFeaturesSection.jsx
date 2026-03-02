import React, { useState } from "react";
import "../componentStyles.css";


export default function AIPoweredFeaturesSection() {
  return (
    <section className="features" id="ai-features">
      <h2>AI-Powered Features</h2>
      <div className="feature-grid">
        <div className="feature-card fade-in">
          <h3>AI Question Generation</h3>
          <p>
            Generate high-quality, relevant questions instantly using advanced AI algorithms. Cover multiple topics and difficulty levels with just a few clicks.
          </p>
        </div>
        <div className="feature-card fade-in">
          <h3>Automated Grading</h3>
          <p>
            Let AI handle the heavy lifting with instant, accurate grading of objective and subjective responses, minimizing manual effort and ensuring consistency.
          </p>
        </div>
        <div className="feature-card fade-in">
          <h3>Assessment Reports</h3>
          <p>
            Get detailed breakdowns of test results, including scores, time taken, accuracy rates, and topic-wise performance — all in a clear and shareable format.
          </p>
        </div>
        <div className="feature-card fade-in">
          <h3>Feedback Reports</h3>
          <p>
            Provide personalized feedback to each learner based on their performance. Our AI analyzes strengths, weaknesses, and suggests areas for improvement.
          </p>
        </div>
      </div>
    </section>
  );
}
