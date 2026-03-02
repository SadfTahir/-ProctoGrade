import React from "react";
import "./TermsPrivacy.css";

export default function TermsPage() {
  return (
    <main className="terms-privacy-main">
      <h1>Terms of Service</h1>
      <p>
        Welcome to ProctoGrade. These terms of service (“Terms”) govern your use of our platform. By using our services, you agree to comply with and be bound by these Terms.
      </p>
      <ul>
        <li>
          <strong>Usage:</strong> Use the platform only as permitted and do not attempt any unauthorized access or misuse.
        </li>
        <li>
          <strong>Content:</strong> You remain responsible for your activities, content, and data submitted during assessments.
        </li>
        <li>
          <strong>Updates:</strong> Terms may be updated occasionally; continued use means acceptance of changes.
        </li>
      </ul>
      <p>
        For more detailed legal information, please contact <a href="mailto:support@proctograde.com">support@proctograde.com</a>.
      </p>
    </main>
  );
}
