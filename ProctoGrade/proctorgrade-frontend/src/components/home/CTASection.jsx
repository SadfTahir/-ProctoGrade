import "../componentStyles.css";
import { useNavigate } from "react-router-dom";

export default function CTASection() {
  const navigate = useNavigate();
  return (
    <section className="cta-section">
      <h2>Ready to Modernize Your Exams?</h2>
      <p>Experience secure, AI-driven assessments built for the future of learning.</p>
      <div className="cta-actions">
        <button
          className="cta-main-btn"
          type="button"
          onClick={() => navigate("/register")}
        >
          Get Started
        </button>
        <button
          className="cta-secondary-btn"
          type="button"
          onClick={() => navigate("/contact")}
        >
          Contact Us
        </button>
      </div>
    </section>
  );
}