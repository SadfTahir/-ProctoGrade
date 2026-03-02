import React, { useState } from "react";
import "../componentStyles.css"; // Use your main CSS file

const faqs = [
  {
    question: "How does AI proctoring work?",
    answer:
      "Our AI proctoring uses facial recognition, voice detection, and gadget detection to monitor exams securely and fairly."
  },
  {
    question: "Is my data safe?",
    answer:
      "Yes, all student and exam data is encrypted and complies with privacy policies."
  },
  {
    question: "Can I customize assessment types?",
    answer:
      "Absolutely! You can create MCQ, text-based, and other custom assessments as per your needs."
  }
  // Add more FAQs as needed
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section className="features" id="faq-section">
      <h2>Frequently Asked Questions</h2>
      <div className="feature-grid">
        {faqs.map((faq, idx) => (
          <div
            key={idx}
            className="feature-card"
            style={{ cursor: "pointer" }}
            onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
          >
            <h3>{faq.question}</h3>
            {openIndex === idx && (
              <p style={{ marginTop: "0.8rem", color: "#374151" }}>{faq.answer}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
