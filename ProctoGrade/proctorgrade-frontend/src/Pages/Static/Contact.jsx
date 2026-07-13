import { useState } from "react";
import { getContactPostUrl } from "../../config/apiUrl";
import "./Contact.css";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ type: "", text: "" });
    setSubmitting(true);
    try {
      const res = await fetch(getContactPostUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        let errText =
          data.msg ||
          data.error ||
          (typeof data.message === "string" ? data.message : null) ||
          "Could not send message. Please try again.";
        if (data.path && errText === "Route not found") {
          errText = `Route not found (${data.path}). Is the backend running on port 5000?`;
        }
        setStatus({
          type: "error",
          text: errText,
        });
        setSubmitting(false);
        return;
      }
      setStatus({ type: "ok", text: data.msg || "Message sent successfully." });
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus({
        type: "error",
        text: "Network error. Please check your connection and try again.",
      });
    }
    setSubmitting(false);
  }

  return (
    <section className="contact-section" id="contact-page">
      <h2 className="contact-heading">Contact Us</h2>
      <div className="contact-main">
        <div className="contact-info">
          <h3>
            <span role="img" aria-label="location">
              📍
            </span>{" "}
            Address
          </h3>
          <p>
            FAST-NU, FAST Square,
            <br />
            9 Km from Faisalabad Motorway Interchange
            <br />
            towards Chiniot
          </p>
          <h3>
            <span role="img" aria-label="phone">
              📞
            </span>{" "}
            Phone
          </h3>
          <a href="tel:+923001234567" className="contact-link">
            +92 300 1234567
          </a>
          <h3>
            <span role="img" aria-label="mail">
              ✉️
            </span>{" "}
            E-mail
          </h3>
          <a href="mailto:support@proctograde.com" className="contact-link">
            support@proctograde.com
          </a>
        </div>
        <form className="contact-form" onSubmit={handleSubmit} noValidate>
          <h3>Contact Us</h3>
          {status.text ? (
            <div
              className={
                status.type === "ok" ? "contact-form-status ok" : "contact-form-status err"
              }
              role="alert"
            >
              {status.text}
            </div>
          ) : null}
          <input
            type="text"
            name="name"
            placeholder="Your Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            autoComplete="name"
          />
          <input
            type="email"
            name="email"
            placeholder="Your Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            autoComplete="email"
          />
          <textarea
            name="message"
            placeholder="Your Message"
            rows={5}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
          />
          <button type="submit" className="contact-btn" disabled={submitting}>
            {submitting ? "Sending…" : "Send Message"}
          </button>
        </form>
      </div>
    </section>
  );
}