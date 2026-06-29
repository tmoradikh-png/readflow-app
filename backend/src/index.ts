import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { pdfRouter } from "./routes/pdf";
import { aiRouter } from "./routes/ai";
import { ttsRouter } from "./routes/tts";
import { configRouter } from "./routes/config";
import { attachEntitlement } from "./middleware/gate";
import { requireAppKey } from "./middleware/appKey";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Public health check (no entitlement needed).
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    aiProvider: process.env.AI_PROVIDER || "openai",
    ttsProvider: process.env.TTS_PROVIDER || "device",
  });
});

// Resolve the caller's plan for everything below (backend = source of truth).
app.use(attachEntitlement);

// Rate limits on the cost-bearing endpoints (per anonymous app-user id, or IP).
// Falls back to the IPv6-safe ipKeyGenerator helper when there's no user id.
const keyByUser = (req: express.Request) =>
  req.entitlement?.appUserId || ipKeyGenerator(req.ip || "");
const extractLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.RATE_EXTRACT_PER_MIN || 12),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
});
const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.RATE_AI_PER_MIN || 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
});
const ttsLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.RATE_TTS_PER_MIN || 180),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
});

app.use("/api", configRouter); // /api/config, /api/entitlements, /api/usage
app.use("/api/pdf", requireAppKey, extractLimiter, pdfRouter);
app.use("/api/ai", requireAppKey, aiLimiter, aiRouter);
app.use("/api/tts", requireAppKey, ttsLimiter, ttsRouter);

app.listen(PORT, () => {
  console.log(`readFlow backend listening on http://localhost:${PORT}`);
});
