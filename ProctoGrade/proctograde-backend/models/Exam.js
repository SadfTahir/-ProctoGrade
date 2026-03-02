// models/Exam.js
const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    type: { type: String, required: true }, // "mcq" | "short"
    options: [String],                       // MCQ only
    answer: String,                          // correct option text
    teacher_answer: String,                  // reference answer for short answer grading
  },
  { _id: false }
);

const ExamSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    title: { type: String, required: true },
    subject: { type: String },
    questions: {
      type: [QuestionSchema],
      required: true,
      default: [],
    },
    status: {
      type: String,
      enum: ["Draft", "Scheduled", "Active", "Closed"],
      default: "Draft",
    },
    startTime: { type: Date },
    endTime: { type: Date },

    // Generation metadata
    generatedFrom: {
      topic: String,
      difficulty: String,
      generatedAt: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exam", ExamSchema);