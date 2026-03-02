import React from "react";
import "../componentStyles.css";

const whyChoose = [
  {
    icon: "🤖",
    title: "AI-Powered Proctoring",
    desc:
      "Advanced facial and behavior tracking ensures integrity throughout exams."
  },
  {
    icon: "⚡",
    title: "Instant Evaluation",
    desc:
      "Automated grading saves time and ensures fair assessment for every student."
  },
  {
    icon: "📊",
    title: "Smart Analytics",
    desc:
      "Get performance insights and cheating patterns in one interactive dashboard."
  },
  // REMOVED: "AI Question Generation"
  {
    icon: "🏅",
    title: "Automated Grading",
    desc:
      "Let AI handle the heavy lifting with instant, accurate grading of objective and subjective responses."
  },
  {
    icon: "📈",
    title: "Assessment Reports",
    desc:
      "Get detailed breakdowns of test results, including scores, time taken, accuracy rates, and topic-wise performance."
  },
  {
    icon: "💬",
    title: "Feedback Reports",
    desc:
      "Provide personalized feedback to each learner based on their performance. Our AI analyzes strengths and suggests areas for improvement."
  }
];


export default function WhyChooseUsSection() {
  return (
    <section className="features" id="why-choose-us">
      <h2>Why Choose Us</h2>
      <div className="feature-grid">
        {whyChoose.map((item, i) => (
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
