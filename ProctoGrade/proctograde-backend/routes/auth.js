// routes/auth.js

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const {
  sendOtpEmail,
  sendResetPasswordEmail,
} = require("../utils/emailService");
const router = express.Router();

// Common regex patterns
const nameRegex = /^[A-Za-z][A-Za-z\s]{1,49}$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

// ── Login attempt tracker (in-memory) ──
const loginAttempts = {};
const MAX_ATTEMPTS  = 5;
const LOCK_TIME     = 15 * 60 * 1000; // 15 minutes

// REGISTER
router.post(
  "/register",
  [
    body("name").matches(nameRegex).withMessage("Name can contain only letters and spaces (2-50 characters)."),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").matches(passwordRegex).withMessage("Password must be at least 8 characters and include letters and numbers."),
    body("role").notEmpty().withMessage("Role is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: errors.array()[0].msg });

    const { name, email, password, role } = req.body;

    try {
      let user = await User.findOne({ email });
      if (user) {
        if (!user.isVerified) {
          return res.status(400).json({ msg: "An account with this email already exists but is not verified. Please verify your email.", code: "UNVERIFIED" });
        }
        return res.status(400).json({ msg: "User already exists. Please login." });
      }

      const salt         = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const finalRole    = ["instructor", "examinee"].includes(role) ? role : "examinee";
      const otp          = Math.floor(100000 + Math.random() * 900000).toString();

      user = new User({
        name, email, password: hashedPassword, role: finalRole,
        isVerified: false,
        verificationOtp: otp,
        verificationOtpExpires: Date.now() + 30 * 1000,
      });
      await user.save();

      try {
        await sendOtpEmail(email, otp);
      } catch (e) {
        console.error("Error sending OTP email:", e);
        return res.status(500).json({ msg: "Could not send verification email" });
      }

      return res.json({ msg: "Registered successfully. Please check your email for OTP to verify your account." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  }
);

// VERIFY EMAIL WITH OTP
router.post(
  "/verify-email",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("otp").isLength({ min: 6, max: 6 }).withMessage("Valid OTP is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: errors.array()[0].msg });

    const { email, otp } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ msg: "User not found" });
      if (user.isVerified) return res.status(400).json({ msg: "Email is already verified" });

      if (!user.verificationOtp || user.verificationOtp !== otp ||
          !user.verificationOtpExpires || user.verificationOtpExpires < Date.now()) {
        return res.status(400).json({ msg: "Invalid or expired OTP" });
      }

      user.isVerified            = true;
      user.verificationOtp       = undefined;
      user.verificationOtpExpires = undefined;
      await user.save();

      return res.json({ msg: "Email verified successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  }
);

// LOGIN — with lockout (TC-00013 fix)
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").exists().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: errors.array()[0].msg });

    const { email, password } = req.body;

    // ── FIX TC-00013: Lockout check ──
    const record = loginAttempts[email] || { count: 0, lockedUntil: null };

    if (record.lockedUntil && Date.now() < record.lockedUntil) {
      const remaining = Math.ceil((record.lockedUntil - Date.now()) / 60000);
      return res.status(423).json({
        msg: `Account temporarily locked due to multiple failed attempts. Try again in ${remaining} minute(s).`,
      });
    }

    // Reset if lock expired
    if (record.lockedUntil && Date.now() >= record.lockedUntil) {
      record.count      = 0;
      record.lockedUntil = null;
    }

    try {
      const user = await User.findOne({ email });
      if (!user) {
        // Count failed attempt
        record.count += 1;
        if (record.count >= MAX_ATTEMPTS) {
          record.lockedUntil = Date.now() + LOCK_TIME;
          record.count       = 0;
          loginAttempts[email] = record;
          return res.status(423).json({ msg: "Account temporarily locked due to multiple failed attempts. Try again in 15 minute(s)." });
        }
        loginAttempts[email] = record;
        return res.status(400).json({ msg: "Invalid credentials" });
      }

      if (!user.isVerified) {
        return res.status(400).json({ msg: "Please verify your email before logging in" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        // Count failed attempt
        record.count += 1;
        if (record.count >= MAX_ATTEMPTS) {
          record.lockedUntil   = Date.now() + LOCK_TIME;
          record.count         = 0;
          loginAttempts[email] = record;
          return res.status(423).json({ msg: "Account temporarily locked due to multiple failed attempts. Try again in 15 minute(s)." });
        }
        loginAttempts[email] = record;
        return res.status(400).json({ msg: "Invalid credentials" });
      }

      // ── Success: reset attempts ──
      delete loginAttempts[email];

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

      res.json({
        msg: "Login successful",
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  }
);

// FORGOT PASSWORD
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Valid email is required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: errors.array()[0].msg });

    const { email } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(200).json({ msg: "If this email exists, a reset link has been sent." });
      }

      const resetToken   = crypto.randomBytes(32).toString("hex");
      const resetExpires = Date.now() + 60 * 60 * 1000;

      user.resetPasswordToken   = resetToken;
      user.resetPasswordExpires = resetExpires;
      await user.save();

      const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`;

      try {
        await sendResetPasswordEmail(email, resetLink);
      } catch (e) {
        console.error("Error sending reset password email:", e);
        return res.status(500).json({ msg: "Could not send reset email" });
      }

      return res.status(200).json({ msg: "If this email exists, a reset link has been sent." });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// RESET PASSWORD
router.post(
  "/reset-password/:token",
  [body("password").matches(passwordRegex).withMessage("Password must be at least 8 characters and include letters and numbers.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: errors.array()[0].msg });

    const { token }    = req.params;
    const { password } = req.body;

    try {
      const user = await User.findOne({
        resetPasswordToken:   token,
        resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user) return res.status(400).json({ msg: "Invalid or expired reset link." });

      const salt           = await bcrypt.genSalt(10);
      user.password        = await bcrypt.hash(password, salt);
      user.resetPasswordToken   = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      return res.json({ msg: "Password reset successful. You can now login." });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// ALL USERS
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE USER
router.put("/users/:id", async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const updateData = { name, email, role };
    if (req.body.password) {
      const salt       = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(req.body.password, salt);
    }
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json({ msg: "User updated successfully", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE USER
router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json({ msg: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RESEND OTP
router.post(
  "/resend-otp",
  [body("email").isEmail().withMessage("Valid email is required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: errors.array()[0].msg });

    const { email } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ msg: "User not found" });
      if (user.isVerified) return res.status(400).json({ msg: "Email is already verified" });

      const otp                   = Math.floor(100000 + Math.random() * 900000).toString();
      user.verificationOtp        = otp;
      user.verificationOtpExpires = Date.now() + 30 * 1000;
      await user.save();

      try {
        await sendOtpEmail(email, otp);
      } catch (e) {
        console.error("Error sending OTP email (resend):", e);
        return res.status(500).json({ msg: "Could not resend verification email" });
      }

      return res.json({ msg: "New OTP sent to your email." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  }
);

// RECENT USERS
router.get("/users/recent", async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 }).limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;