import React from "react";
import "./AboutUs.css";

export default function About() {
  return (
    <main className="about-main">
      <section className="about-intro">
        <h1>About Us</h1>
        <p>
          ProctoGrade is redefining the way assessments are delivered, monitored, and experienced. As a Unified Assessment Platform, our mission is to create a seamless, secure, and scalable solution that meets the evolving needs of educators, certifying bodies, and organizations worldwide.
        </p>
      </section>

      <section className="about-split about-vision-mission">
        <div className="about-block">
          <h2>Our Vision</h2>
          <p>
            To become the global standard for digital assessments, where institutions trust us, candidates prefer us, and innovation drives us.
          </p>
        </div>
        <div className="about-block">
          <h2>Our Mission</h2>
          <p>
            Our mission is to revolutionize the assessment experience through a unified, secure, and AI-powered platform. We empower organizations and learners by delivering seamless, scalable, and accessible testing solutions worldwide.
          </p>
        </div>
      </section>

      <section className="about-content">
        <h2>What We Do</h2>
        <p>
          ProctoGrade provides an end-to-end digital testing experience, integrating exam creation, delivery, AI-powered proctoring, identity verification, analytics, and post-assessment insights all in one platform. Whether it’s for academic exams, professional certifications, or enterprise training, we support organizations in delivering assessments that are secure, flexible, and data-driven.
        </p>
      </section>

      <section className="about-values">
        <h2>Why It Matters</h2>
        <div className="about-values-row">
          <div className="about-value-card">
            <span className="about-value-icon" aria-label="Integrity">🛡️</span>
            <strong>Integrity</strong>
            <p>Ensuring every exam is fair, secure, and trusted.</p>
          </div>
          <div className="about-value-card">
            <span className="about-value-icon" aria-label="Accessibility">🌍</span>
            <strong>Accessibility</strong>
            <p>Breaking barriers so learners and professionals can test from anywhere.</p>
          </div>
          <div className="about-value-card">
            <span className="about-value-icon" aria-label="Innovation">💡</span>
            <strong>Innovation</strong>
            <p>Harnessing AI and advanced technologies to enhance every step of the assessment lifecycle.</p>
          </div>
          <div className="about-value-card">
            <span className="about-value-icon" aria-label="Support">🤝</span>
            <strong>Support</strong>
            <p>Offering real-time assistance and a human-centered approach to every exam session.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
