import React from "react";
import { useNavigate } from "react-router-dom";
import "../componentStyles.css";
import First_img from "../../assets/First_img.jpg";
import Second_img from "../../assets/Second_img.jpg";
import Third_img from "../../assets/Third_img.jpg";

export default function HeroSection() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/register");
  };

  return (
    <section className="hero" id="hero">
      <div className="hero-content hero-stagger">
        <div className="hero-text">
          <h1>Revolutionize Online Exams with AI Proctoring</h1>
          <p>
            Take exams with confidence — AI handles proctoring, evaluation,
            and analytics seamlessly.
          </p>
          <button className="cta-btn" onClick={handleGetStarted}>
            Get Started
          </button>
        </div>
        <div className="hero-vertical-images">
          <div className="stagger-img img1">
            <img src={First_img} alt="Student" />
          </div>
          <div className="stagger-img img2">
            <img src={Second_img} alt="AI environment" />
          </div>
          <div className="stagger-img img3">
            <img src={Third_img} alt="Tech support" />
          </div>
        </div>
      </div>
    </section>
  );
}
