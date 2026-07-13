// backend/routes/classRoutes.js (Ya jo bhi aapki backend classes route file hai)
// ✅ Updated with Dynamic studentCount aggregation for Instructor Portal

const express = require("express");
const Class = require("../models/Class");
const User = require("../models/User");
const auth = require("../middleware/auth"); // token se req.user banata hai

const router = express.Router();

function generateJoinCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST /api/classes/create (teacher banata hai)
router.post("/create", auth, async (req, res) => {
  try {
    const { name, section, subject } = req.body;
    if (!name) return res.status(400).json({ msg: "Class name required" });

    const teacherId = req.user.id;

    let code;
    let exists = true;
    while (exists) {
      code = generateJoinCode();
      exists = await Class.findOne({ joinCode: code });
    }

    const cls = await Class.create({
      name,
      section,
      subject,
      joinCode: code,
      teacher: teacherId,
    });

    res.json({
      msg: "Class created",
      cls: {
        id: cls._id,
        name: cls.name,
        section: cls.section,
        subject: cls.subject,
        joinCode: cls.joinCode,
        studentCount: 0 // New class has 0 students initially
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/classes/join (student code se join karta hai)
router.post("/join", auth, async (req, res) => {
  try {
    const { joinCode } = req.body;
    if (!joinCode) return res.status(400).json({ msg: "Join code required" });

    const cls = await Class.findOne({
      joinCode: joinCode.trim().toUpperCase(),
    });
    if (!cls) return res.status(404).json({ msg: "Class not found" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.classes = user.classes || [];
    const already = user.classes.some(
      (cId) => cId.toString() === cls._id.toString()
    );
    if (!already) {
      user.classes.push(cls._id);
      await user.save();
    }

    res.json({
      msg: "Joined class",
      class: {
        id: cls._id,
        name: cls.name,
        subject: cls.subject,
        joinCode: cls.joinCode,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// GET /api/classes/my (current user ki classes - student side)
router.get("/my", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("classes");
    if (!user) return res.status(404).json({ msg: "User not found" });

    const classes = (user.classes || []).map((cls) => ({
      id: cls._id,
      name: cls.name,
      subject: cls.subject,
      joinCode: cls.joinCode,
    }));

    res.json(classes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// 📊 GET /api/classes/my-teacher (Gimi Fixed — Fetches real student counts per class)
router.get("/my-teacher", auth, async (req, res) => {
  try {
    const classes = await Class.find({ teacher: req.user.id });
    
    // Har class ke liye real-time background counter mapping
    const mapped = await Promise.all(
      classes.map(async (cls) => {
        const studentCount = await User.countDocuments({
          role: "examinee",
          classes: cls._id,
        });

        return {
          id: cls._id,
          name: cls.name,
          section: cls.section,
          subject: cls.subject,
          joinCode: cls.joinCode,
          studentCount: studentCount, // ✅ Passed directly to dynamic UI cards
        };
      })
    );
    
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// PATCH /api/classes/:id (update name/section/subject - sirf owner teacher)
router.patch("/:id", auth, async (req, res) => {
  try {
    const classId = req.params.id;
    const { name, section, subject } = req.body;

    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ msg: "Class not found" });
    }

    if (cls.teacher.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    if (name !== undefined && name.trim() !== "") cls.name = name;
    if (section !== undefined) cls.section = section;
    if (subject !== undefined) cls.subject = subject;

    await cls.save();

    return res.json({
      msg: "Class updated",
      cls: {
        id: cls._id,
        name: cls.name,
        section: cls.section,
        subject: cls.subject,
        joinCode: cls.joinCode,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// DELETE /api/classes/:id (delete class - sirf owner teacher)
router.delete("/:id", auth, async (req, res) => {
  try {
    const classId = req.params.id;

    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ msg: "Class not found" });
    }

    if (cls.teacher.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    await Class.findByIdAndDelete(classId);

    await User.updateMany(
      { classes: classId },
      { $pull: { classes: classId } }
    );

    return res.json({ msg: "Class deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// DELETE /api/classes/:classId/students/:studentId (remove student from class)
router.delete("/:classId/students/:studentId", auth, async (req, res) => {
  try {
    const { classId, studentId } = req.params;

    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ msg: "Class not found" });
    }

    if (cls.teacher.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ msg: "Student not found" });
    }

    await User.updateOne(
      { _id: studentId },
      { $pull: { classes: classId } }
    );

    return res.json({ msg: "Student removed from class" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// GET /api/classes/:id/students (us class me enrolled students)
router.get("/:id/students", auth, async (req, res) => {
  try {
    const classId = req.params.id;

    const cls = await Class.findById(classId);
    if (!cls) {
      return res.status(404).json({ msg: "Class not found" });
    }

    const students = await User.find({
      role: "examinee",
      classes: classId,
    }).select("name email createdAt");

    const mapped = students.map((stu) => ({
      id: stu._id,
      name: stu.name,
      email: stu.email,
      joinedAt: stu.createdAt,
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;