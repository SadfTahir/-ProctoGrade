// models/ExamAttempt.js (COMPLETE FIXED VERSION)
const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String },
    questionText: String,
    type: { type: String, default: "mcq" },
    selectedOptionIndex: { type: Number },
    textAnswer: { type: String, maxlength: 500 },
    
    // ✅ ADDED: Grading fields (ye missing the!)
    correctAnswer: String,
    isCorrect: Boolean,
    pointsAwarded: { type: Number, default: 0 },
    maxPoints: { type: Number, default: 10 },
    aiGradingFeedback: String,
  },
  { _id: false }
);

const examAttemptSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    examTitle: String,
    className: String,
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date },
    answers: [answerSchema],
    
    status: {
      type: String,
      enum: ["in-progress", "submitted", "graded", "failed"],
      default: "in-progress",
    },
    
    // ✅ ADDED: Overall grading fields (ye bhi missing the!)
    totalScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    gradedAt: { type: Date },
    gradedBy: { type: String, default: "auto" }, // "auto" ya teacher ID
  },
  { timestamps: true }
);

examAttemptSchema.index({ examId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model("ExamAttempt", examAttemptSchema);