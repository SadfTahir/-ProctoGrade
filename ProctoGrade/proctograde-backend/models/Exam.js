// models/Exam.js
// ProctoGrade — ✅ UPDATED v2.0
// Added: max_marks, model_answer, key_concepts, marking_guide, rubric fields

const mongoose = require("mongoose");

// ============================================================
// RUBRIC CRITERION SCHEMA
// ============================================================
const RubricCriterionSchema = new mongoose.Schema(
  {
    name        : { type: String, default: "" },
    description : { type: String, default: "" },
    max_marks   : { type: Number, default: 0 },
    weight      : { type: Number, default: 0 },
  },
  { _id: false }
);

// ============================================================
// QUESTION SCHEMA
// ============================================================
const QuestionSchema = new mongoose.Schema(
  {
    text          : { type: String, required: true },
    type          : { type: String, required: true }, // "mcq" | "short" | "code"
    options       : [String],                          // MCQ only
    answer        : String,                            // MCQ correct option text

    // ✅ ADDED: Short answer reference
    teacher_answer: { type: String, default: null },

    // ✅ ADDED: AI-generated model answer for teacher preview
    model_answer  : { type: String, default: null },

    // ✅ ADDED: Key concepts for grading
    key_concepts  : { type: [String], default: [] },

    // ✅ ADDED: Marking guide / rubric hint
    marking_guide : { type: String, default: null },

    // ✅ ADDED: Per-question max marks (teacher sets this in UI)
    max_marks     : { type: Number, default: 10 },

    // ✅ ADDED: Full rubric (teacher defines criteria in UI)
    rubric: {
      criteria   : { type: [RubricCriterionSchema], default: [] },
      total_marks: { type: Number, default: 10 },
    },

    // ✅ ADDED: For code questions
    language: { type: String, default: null },
  },
  { _id: false }
);

// ============================================================
// EXAM SCHEMA
// ============================================================
const ExamSchema = new mongoose.Schema(
  {
    classId: {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : "Class",
      required: true,
    },
    title   : { type: String, required: true },
    subject : { type: String, default: "General" },

    questions: {
      type    : [QuestionSchema],
      required: true,
      default : [],
    },

    status: {
      type   : String,
      enum   : ["Draft", "Scheduled", "Active", "Closed"],
      default: "Draft",
    },

    startTime: { type: Date },
    endTime  : { type: Date },

    // Generation metadata
    generatedFrom: {
      topic      : String,
      difficulty : String,
      generatedAt: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exam", ExamSchema);