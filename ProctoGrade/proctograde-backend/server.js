require("dotenv").config();
const path = require("path");
console.log("📂 Backend folder:", __dirname);
console.log("📂 Process CWD:", process.cwd());
console.log("📄 This server.js file:", path.resolve(__filename));
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const examRoutes = require("./routes/exams");
const classRoutes = require("./routes/classRoutes");
const selfLearningRoutes = require("./routes/selfLearning");
const contactRoutes = require("./routes/contact");
const { body, validationResult } = require("express-validator");
const ContactMessage = require("./models/ContactMessage");
const proctoringRoutes = require("./routes/proctoringRoutes"); // ✅ Proctoring
const fileUpload = require('express-fileupload');

const CONTACT_NAME_REGEX = /^[A-Za-z][A-Za-z\s]{1,99}$/;

const app = express();

// ===== 0. Validate Environment =====
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env file!");
  process.exit(1);
}
console.log("✅ Environment loaded");

// ===== 1. Connect to Database =====
async function initDB() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ Database connected successfully!");
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
}

// ===== 2. Basic Middleware =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== 3. CORS Configuration =====
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:3000",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`⚠️ CORS blocked: ${origin}`);
    return callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ===== 4. File Upload Middleware (MUST BE BEFORE ROUTES!) =====
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  abortOnLimit: true,
  createParentPath: true,
  useTempFiles: false,
  debug: false
}));
console.log("✅ File upload middleware enabled");

// ===== 5. Request Logging (Development) =====
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ===== Extended Timeout for AI & Proctoring Operations =====
app.use((req, res, next) => {
  if (
    req.path.includes('/generate-questions') ||
    req.path.includes('/upload-material') ||
    req.path.includes('/proctoring')        // ✅ Proctoring needs longer timeout
  ) {
    req.setTimeout(600000);
    res.setTimeout(600000);
    console.log(`⏱️ Extended timeout for: ${req.path}`);
  }
  next();
});

// ===== 6. Routes =====
// Public contact form — registered directly on `app` so GET/POST /api/contact always resolve.
app.get("/api/contact", (req, res) => {
  res.json({
    ok: true,
    hint: "POST JSON { name, email, message }",
  });
});

app.post(
  "/api/contact",
  [
    body("name")
      .trim()
      .matches(CONTACT_NAME_REGEX)
      .withMessage("Name should be 2–100 letters or spaces."),
    body("email").isEmail().withMessage("Valid email is required"),
    body("message")
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage("Message must be between 1 and 5000 characters."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ msg: errors.array()[0].msg });
    }
    const { name, email, message } = req.body;
    try {
      const doc = await ContactMessage.create({ name, email, message });
      return res.status(201).json({
        msg: "Message received. We will get back to you soon.",
        id: doc._id,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ msg: "Could not save message" });
    }
  }
);

app.use("/api/auth", authRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/self-learning", selfLearningRoutes);
app.use("/api/proctoring", proctoringRoutes); // ✅ Proctoring
// Admin-only contact sub-routes: /api/contact/messages, etc.
app.use("/api/contact", contactRoutes);
console.log("📬 Contact API: GET/POST /api/contact on app + /api/contact/* on router");

// ===== 7. Health Check =====
app.get("/", (req, res) => {
  res.json({
    status: "✅ Server running",
    serverFile: "server.js",
    serverJsFullPath: path.resolve(__filename),
    processId: process.pid,
    apiRevision: "contact-route-v2-app-mounted",
    timestamp: new Date().toISOString(),
    dbConnected: global.dbConnected || false,
    fileUploadEnabled: true,
    aiTimeout: "10 minutes",
    routes: [
      "/api/auth",
      "/api/exams",
      "/api/classes",
      "/api/self-learning",
      "/api/contact",
      "/api/proctoring"  // ✅ Proctoring
    ]
  });
});

// ===== 8. 404 Handler =====
app.use((req, res) => {
  res.status(404).json({ error: "Route not found", path: req.path });
});

// ===== 9. Global Error Handler =====
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS blocked" });
  }
  res.status(err.status || 500).json({
    error: err.message || "Server error",
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ===== 10. Start Server =====
const PORT = process.env.PORT || 5000;

async function startServer() {
  await initDB();

  const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║  ✅ ProctoGrade Backend Running        ║
║  📡 Port: ${PORT}                      ║
║  PID: ${process.pid}                   ║
║  🗄️  Database: ✅ Connected            ║
║  📤 File Upload: ✅ Enabled            ║
║  🎥 Proctoring: ✅ Enabled             ║
║  ⏱️  AI Timeout: 10 minutes            ║
║  🔗 http://localhost:${PORT}           ║
╚════════════════════════════════════════╝
    `);
    console.log(
      "\n⚠️  Testing ke dauran is terminal ko BAND mat karo (Ctrl+C mat dabao).\n" +
        "   Browser test: http://127.0.0.1:" +
        PORT +
        "/  aur  http://127.0.0.1:" +
        PORT +
        "/api/contact\n"
    );
  });

  server.timeout = 600000;
  server.keepAliveTimeout = 610000;
  server.headersTimeout = 620000;
}

startServer().catch(err => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});

// ===== 11. Graceful Shutdown =====
process.on('SIGTERM', () => {
  console.log('👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT - shutting down...');
  process.exit(0);
});