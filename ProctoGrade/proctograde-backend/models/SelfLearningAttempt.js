// models/SelfLearningAttempt.js
const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String },
    questionText: String,
    type: { type: String, default: "mcq" },
    selectedOptionIndex: { type: Number },
    textAnswer: { type: String, maxlength: 500 },

    // Grading fields
    correctAnswer: String,
    isCorrect: Boolean,
    pointsAwarded: { type: Number, default: 0 },
    maxPoints: { type: Number, default: 10 },
    aiGradingFeedback: String,
  },
  { _id: false }
);

const selfLearningAttemptSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    topic: { type: String, required: true },
    subject: { type: String, default: "General" },
    contentType: { type: String, default: "mixed" },

    // Questions with answers — stored for grading, never sent to student
    questions: { type: Array, default: [] },

    // Student answers — populated after submission
    answers: [answerSchema],

    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },

    status: {
      type: String,
      enum: ["in-progress", "completed"],
      default: "in-progress",
    },

    // Grading results
    score: { type: Number, min: 0, max: 100, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Index for fast student queries
selfLearningAttemptSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model("SelfLearningAttempt", selfLearningAttemptSchema);