import "./Contact.css";

export default function ContactPage() {
  return (
    <section className="contact-section">
      <h2 className="contact-heading">Contact Us</h2>
      <div className="contact-main">
        <div className="contact-info">
          <h3>
            <span role="img" aria-label="location">📍</span> Address
          </h3>
          <p>
            FAST-NU, FAST Square,<br />
            9 Km from Faisalabad Motorway Interchange<br />
            towards Chiniot
          </p>
          <h3>
            <span role="img" aria-label="phone">📞</span> Phone
          </h3>
          <a href="tel:+1234567890" className="contact-link">123-456-7890</a>
          <h3>
            <span role="img" aria-label="mail">✉️</span> E-mail
          </h3>
          <a href="mailto:privacy@proctograde.com" className="contact-link">privacy@proctograde.com</a>
        </div>
        <form className="contact-form">
          <h3>Contact Us</h3>
          <input type="text" placeholder="Your Name" required />
          <input type="email" placeholder="Your Email" required />
          <textarea placeholder="Your Message" rows={5} required />
          <button type="submit" className="contact-btn">Send Message</button>
        </form>
      </div>
    </section>
  );
}
