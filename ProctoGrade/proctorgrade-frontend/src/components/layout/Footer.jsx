import { Link } from "react-router-dom";
import { FaLinkedinIn, FaGithub, FaInstagram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import "../componentStyles.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand-block">
          <div className="footer-brand-title">ProctoGrade</div>
          <p className="footer-tagline">
            Secure, AI-assisted online exams and proctoring for modern education.
          </p>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Quick links</h4>
          <nav className="footer-nav-links">
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/contact">Contact Us</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
          </nav>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Contact</h4>
          <ul className="footer-contact-list">
            <li>
              <span className="footer-contact-label">Email</span>
              <a href="mailto:support@proctograde.com" className="footer-contact-value">
                support@proctograde.com
              </a>
            </li>
            <li>
              <span className="footer-contact-label">Phone</span>
              <a href="tel:+923001234567" className="footer-contact-value">
                +92 300 1234567
              </a>
            </li>
            <li>
              <span className="footer-contact-label">Location</span>
              <span className="footer-contact-value footer-contact-multiline">
                FAST-NU, FAST Square,
                <br />
                Faisalabad, Pakistan
              </span>
            </li>
          </ul>
        </div>

        <div className="footer-col footer-col-social">
          <h4 className="footer-col-title">Follow us</h4>
          <div className="footer-social">
            <a
              href="https://www.linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
            >
              <FaLinkedinIn />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
              <FaGithub />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
            >
              <FaXTwitter />
            </a>
            <a
              href="https://www.instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <FaInstagram />
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copy">
          © {new Date().getFullYear()} ProctoGrade. Empowering online learning with AI.
        </p>
      </div>
    </footer>
  );
}