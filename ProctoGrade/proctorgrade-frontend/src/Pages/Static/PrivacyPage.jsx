import React from "react";
import "./TermsPrivacy.css";

export default function PrivacyPage() {
  return (
    <main className="terms-privacy-main">
      <h1>Privacy Policy</h1>
      <p>
        Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information.
      </p>
      <ul>
        <li>
          <strong>Data Collection:</strong> We collect necessary information for assessments and to improve platform functionality. 
        </li>
        <li>
          <strong>Security:</strong> Your data is encrypted and protected with industry standards.
        </li>
        <li>
          <strong>Privacy Choices:</strong> You may reach out to ask about, update, or delete your data by contacting us.
        </li>
      </ul>
      <p>
        For questions or requests regarding your data, email <a href="mailto:privacy@proctograde.com">privacy@proctograde.com</a>.
      </p>
    </main>
  );
}
