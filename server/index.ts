import express from "express";
import cors from "cors";
import helmet from "helmet";
import * as cron from "node-cron";
import * as dotenv from "dotenv";

import verifyReceiptRouter from "./routes/verify-receipt.js";
import leaderboardRouter from "./routes/leaderboard.js";
import userRouter from "./routes/user.js";
import checkInRouter from "./routes/check-in.js";
import { runWeeklyFinalization } from "./cron/weekly.js";
import { setupEventListeners, invalidateLeaderboardCache } from "./services/events.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: "*", // Allows any origin from the UI so you don't get CORS 'Failed to Fetch'
}));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: "10mb" })); // For base64 image uploads

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/verify-receipt", verifyReceiptRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/user", userRouter);
app.use("/api/check-in", checkInRouter);

// Cron endpoint for Vercel
app.get("/api/cron/weekly", async (req, res) => {
  // Check for Vercel Cron Secret (optional but recommended)
  // if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).json({ error: "Unauthorized" });
  // }
  
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
  });
}

export default app;
