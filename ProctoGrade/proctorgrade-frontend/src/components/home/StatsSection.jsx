import "../componentStyles.css";

export default function StatsSection() {
  return (
    <section className="stats-section">
      <h2 className="stats-heading">Our Statistics</h2>
      <p className="stats-desc">
        Empowering institutions to deliver secure, scalable, and smart assessments
      </p>
      <div className="stats">
        <div className="stat-card">
          <h3>50+</h3>
          <span className="stat-icon">🧑‍💻</span>
          <p>AI-Proctored Exams</p>
        </div>
        <div className="stat-card">
          <h3>3000+</h3>
          <span className="stat-icon">🎓</span>
          <p>Students Enrolled</p>
        </div>
        <div className="stat-card">
          <h3>98%</h3>
          <span className="stat-icon">🛡️</span>
          <p>Cheat Detection Accuracy</p>
        </div>
        <div className="stat-card">
          <h3>24/7</h3>
          <span className="stat-icon">👁️</span>
          <p>Smart Monitoring</p>
        </div>
      </div>
    </section>
  );
}
