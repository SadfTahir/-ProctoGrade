import React from "react";
import "../componentStyles.css";

const features = [
  {
    icon: "🛡️",
    title: "Smart Vigilance Tools",
    desc: "Gain comprehensive insights into our assessments with gadget, face, and voice detectors."
  },
  {
    icon: "👁️",
    title: "Face Detection",
    desc: "Enhance security with face detection, including eyes detection—even with glasses."
  },
  {
    icon: "🏃‍♂️",
    title: "Activity Detection",
    desc: "Tracks user movement to detect any unauthorized activity or cheating."
  },
  {
    icon: "🎤",
    title: "Voice Detection",
    desc: "Detects conversations, ensuring a focused test environment."
  },
  {
    icon: "📱",
    title: "Gadget Detection",
    desc: "Scans for unauthorized gadgets to maintain fairness throughout evaluation."
  },
  {
    icon: "📝",
    title: "AI-Assisted Assessments",
    desc: "Create and evaluate multiple-choice (MCQ) and written (text-based) responses with instant AI scoring, analytics, and feedback."
  }
];
export default function OurFeatureSection() {
  return (
    <section className="features" id="our-features">
      <h2>Our Features</h2>
      <div className="feature-grid">
        {features.map((item, i) => (
          <div className="feature-card fade-in" key={i}>
            <span className="feature-icon">{item.icon}</span>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
