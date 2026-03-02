// utils/emailService.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOtpEmail(toEmail, otp) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: toEmail,
    subject: "Your ProctoGrade OTP Verification Code",
    text: `Your OTP code is ${otp}. It will expire in 30 seconds.`,
    html: `
      <p>Dear user,</p>
      <p>Your OTP code is <b>${otp}</b>. It will expire in 30 seconds.</p>
      <p>If you did not request this, you can ignore this email.</p>
      <p>Regards,<br/>ProctoGrade Team</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

/**
 * Forgot-password email: sends reset link
 * resetLink = e.g. "http://localhost:5173/reset-password/ABC123TOKEN"
 */
async function sendResetPasswordEmail(toEmail, resetLink) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: toEmail,
    subject: "ProctoGrade Password Reset",
    text: `You requested to reset your password. Open this link to continue: ${resetLink}`,
    html: `
      <p>Dear user,</p>
      <p>You requested to reset your password for ProctoGrade.</p>
      <p>Please click the link below (or copy and paste it in your browser) to set a new password:</p>
      <p><a href="${resetLink}" target="_blank">${resetLink}</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <p>Regards,<br/>ProctoGrade Team</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendOtpEmail, sendResetPasswordEmail };
