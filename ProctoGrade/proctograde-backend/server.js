require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const examRoutes = require("./routes/exams");
const classRoutes = require("./routes/classRoutes");
const selfLearningRoutes = require("./routes/selfLearning");
const fileUpload = require('express-fileupload');

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
  "http://localhost:3000"
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
  useTempFiles: false,  // Keep files in memory
  debug: false  // Set to true for debugging
}));
console.log("✅ File upload middleware enabled");

// ===== 5. Request Logging (Development) =====
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ✅ NEW: Increase timeout for AI operations (10 minutes)
app.use((req, res, next) => {
  // Only for AI endpoints
  if (req.path.includes('/generate-questions') || req.path.includes('/upload-material')) {
    req.setTimeout(600000);  // 10 minutes
    res.setTimeout(600000);  // 10 minutes
    console.log(`⏱️ Extended timeout for AI endpoint: ${req.path}`);
  }
  next();
});

// ===== 6. Routes =====
app.use("/api/auth", authRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/self-learning", selfLearningRoutes);

// ===== 7. Health Check =====
app.get("/", (req, res) => {
  res.json({ 
    status: "✅ Server running",
    timestamp: new Date().toISOString(),
    dbConnected: global.dbConnected || false,
    fileUploadEnabled: true,
    aiTimeout: "10 minutes",
    routes: ["/api/auth", "/api/exams", "/api/classes", "/api/self-learning"]
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
  await initDB();  // Wait for DB before listen
  
  const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║  ✅ ProctoGrade Backend Running        ║
║  📡 Port: ${PORT}                      ║
║  🗄️  Database: ✅ Connected            ║
║  📤 File Upload: ✅ Enabled            ║
║  ⏱️  AI Timeout: 10 minutes            ║
║  🔗 http://localhost:${PORT}           ║
╚════════════════════════════════════════╝
    `);
  });

  // ✅ Set server-wide timeout (10 minutes)
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