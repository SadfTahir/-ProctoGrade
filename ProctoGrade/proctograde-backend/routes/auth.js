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
const nameRegex = /^[A-Za-z][A-Za-z\s]{1,49}$/; // 2-50 chars, letters + spaces
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/; // min 8, letters + numbers

// REGISTER (Create User with OTP verification)
router.post(
  "/register",
  [
    body("name")
      .matches(nameRegex)
      .withMessage(
        "Name should contain only letters and spaces (2-50 characters)."
      ),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .matches(passwordRegex)
      .withMessage(
        "Password must be at least 8 characters and include letters and numbers."
      ),
    body("role").notEmpty().withMessage("Role is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: errors.array()[0].msg });

    const { name, email, password, role } = req.body;

    try {
      // Check if user already exists
      let user = await User.findOne({ email });

      if (user) {
        // If user exists but not verified
        if (!user.isVerified) {
          return res.status(400).json({
            msg: "An account with this email already exists but is not verified. Please verify your email.",
            code: "UNVERIFIED",
          });
        }
        // If user exists and verified
        return res
          .status(400)
          .json({ msg: "User already exists. Please login." });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      let finalRole;
      if (["instructor", "examinee"].includes(role)) {
        finalRole = role;
      } else {
        finalRole = "examinee";
      }

      // 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      user = new User({
        name,
        email,
        password: hashedPassword,
        role: finalRole,
        isVerified: false,
        verificationOtp: otp,
        verificationOtpExpires: Date.now() + 30 * 1000, // 30 seconds
      });

      await user.save();

      // Send OTP email
      try {
        await sendOtpEmail(email, otp);
      } catch (e) {
        console.error("Error sending OTP email:", e);
        return res
          .status(500)
          .json({ msg: "Could not send verification email" });
      }

      return res.json({
        msg: "Registered successfully. Please check your email for OTP to verify your account.",
      });
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
    body("otp")
      .isLength({ min: 6, max: 6 })
      .withMessage("Valid OTP is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: errors.array()[0].msg });

    const { email, otp } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ msg: "User not found" });

      if (user.isVerified)
        return res.status(400).json({ msg: "Email is already verified" });

      if (
        !user.verificationOtp ||
        user.verificationOtp !== otp ||
        !user.verificationOtpExpires ||
        user.verificationOtpExpires < Date.now()
      ) {
        return res.status(400).json({ msg: "Invalid or expired OTP" });
      }

      user.isVerified = true;
      user.verificationOtp = undefined;
      user.verificationOtpExpires = undefined;
      await user.save();

      return res.json({ msg: "Email verified successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  }
);

// LOGIN (only verified users)
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

    try {
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ msg: "Invalid credentials" });

      if (!user.isVerified) {
        return res.status(400).json({
          msg: "Please verify your email before logging in",
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch)
        return res.status(400).json({ msg: "Invalid credentials" });

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });

      res.json({
        msg: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
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

      // Security reason: always send same message
      if (!user) {
        return res.status(200).json({
          msg: "If this email exists, a reset link has been sent.",
        });
      }

      // Random token (32 bytes hex) + 1 hour expiry
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = Date.now() + 60 * 60 * 1000; // 1 hour

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetExpires;
      await user.save();

      // Frontend URL (adjust if needed)
      const resetLink = `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/reset-password/${resetToken}`;

      try {
        await sendResetPasswordEmail(email, resetLink);
      } catch (e) {
        console.error("Error sending reset password email:", e);
        return res.status(500).json({ msg: "Could not send reset email" });
      }

      return res.status(200).json({
        msg: "If this email exists, a reset link has been sent.",
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// RESET PASSWORD
router.post(
  "/reset-password/:token",
  [
    body("password")
      .matches(passwordRegex)
      .withMessage(
        "Password must be at least 8 characters and include letters and numbers."
      ),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ msg: errors.array()[0].msg });

    const { token } = req.params;
    const { password } = req.body;

    try {
      // Find user by valid token & non-expired
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res
          .status(400)
          .json({ msg: "Invalid or expired reset link." });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      return res.json({
        msg: "Password reset successful. You can now login.",
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

// ALL USERS (Read)
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
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(req.body.password, salt);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
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

      if (user.isVerified) {
        return res.status(400).json({ msg: "Email is already verified" });
      }

      // Naya OTP + expiry
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.verificationOtp = otp;
      user.verificationOtpExpires = Date.now() + 30 * 1000; // 30 seconds
      await user.save();

      try {
        await sendOtpEmail(email, otp);
      } catch (e) {
        console.error("Error sending OTP email (resend):", e);
        return res
          .status(500)
          .json({ msg: "Could not resend verification email" });
      }

      return res.json({ msg: "New OTP sent to your email." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  }
);

// RECENT USERS API (for dashboard)
router.get("/users/recent", async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 }).limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
