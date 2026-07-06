import express from "express";
import cors from "cors";
import helmet from "helmet";
import * as cron from "node-cron";
import * as dotenv from "dotenv";

import verifyReceiptRouter from "./routes/verify-receipt.js";
import leaderboardRouter from "./routes/leaderboard.js";
import userRouter from "./routes/user.js";
import checkInRouter from "./routes/check-in.js";
import metaRouter from "./routes/meta.js";
import { runWeeklyFinalization } from "./cron/weekly.js";
import { setupEventListeners, invalidateLeaderboardCache } from "./services/events.js";
import { warmLeaderboardCache } from "./routes/leaderboard.js";


dotenv.config();

// Trigger reload dummy comment 1
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));

// CORS: env'den frontend URL'lerini al (virgülle ayrılmış liste desteklenir)
// FRONTEND_URL="https://replate-app.vercel.app,http://localhost:3000"
const rawOrigins = process.env.FRONTEND_URL || "";
const allowedOrigins = rawOrigins
  ? rawOrigins.split(",").map((o) => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Same-origin veya sunucu-sunucu istekleri (origin yok)
    if (!origin) return callback(null, true);
    // Tanımlı liste varsa kontrol et
    if (allowedOrigins.length > 0) {
      if (allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
        return callback(null, true);
      }
      return callback(new Error("CORS: origin not allowed"));
    }
    // FRONTEND_URL set edilmemişse tüm origin'lere izin ver (geliştirme modu)
    return callback(null, true);
  },
  credentials: true,
}));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: "10mb" })); // For base64 image uploads

// Health check & Root
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Replate API is running! 🚀" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/verify-receipt", verifyReceiptRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/user", userRouter);
app.use("/api/check-in", checkInRouter);
app.use("/api/meta", metaRouter);

// Cron endpoint for Vercel
app.get("/api/cron/weekly", async (req, res) => {
  // Check for Vercel Cron Secret (highly recommended for production)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  console.log("🕐 Running weekly finalization via API call...");
  try {
    await runWeeklyFinalization();
    res.json({ success: true, message: "Weekly finalization complete" });
  } catch (error) {
    console.error("❌ Weekly finalization failed:", error);
    res.status(500).json({ success: false, error: "Weekly finalization failed" });
  }
});

// Weekly cron job - runs every Sunday at 00:00 UTC
cron.schedule("0 0 * * 0", async () => {
  console.log("🕐 Running weekly finalization cron job...");
  try {
    await runWeeklyFinalization();
    console.log("✅ Weekly finalization complete");
  } catch (error) {
    console.error("❌ Weekly finalization failed:", error);
  }
});

// Start server - only if not running on Vercel
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Replate API server running on port ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);

    // Set up event listeners for real-time updates
    if (!process.env.VERCEL) {
      setupEventListeners();
    }

    // Pre-warm the leaderboard cache (users discovered from on-chain events)
    warmLeaderboardCache();
  });
}

export default app;
