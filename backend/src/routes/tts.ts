import { Router } from "express";
import crypto from "crypto";
import OpenAI from "openai";
import { ensureFeature } from "../middleware/gate";
import { addUsage, checkQuota } from "../services/usage";

export const ttsRouter = Router();

/**
 * POST /api/tts
 * body: { text, voice?, speed?, language? }
 * -> audio/mpeg (spoken audio for one sentence/chunk)
 *
 * Natural cloud voice. The OpenAI key lives ONLY on the server; the mobile app
 * sends text and plays back the returned audio. Gated behind the same paid
 * feature flag as cloudVoice so the free tier and Reader Plus keep using
 * on-device voices (no OpenAI cost).
 */

const VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
]);

const MAX_CHARS = 1200; // one sentence/short chunk; keeps latency + cost low

const CLOUD_TTS_LANGUAGES = new Set([
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "sv",
  "no",
  "nb",
  "nn",
  "da",
  "fi",
  "tr",
  "id",
  "vi",
]);

// Small in-memory LRU so repeated sentences (and replays) don't re-bill OpenAI.
const CACHE_MAX = 300;
const cache = new Map<string, Buffer>();
function cacheGet(k: string): Buffer | undefined {
  const v = cache.get(k);
  if (v) {
    cache.delete(k);
    cache.set(k, v); // refresh LRU order
  }
  return v;
}
function cacheSet(k: string, v: Buffer) {
  cache.set(k, v);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set.");
    client = new OpenAI({ apiKey: key });
  }
  return client;
}

ttsRouter.post("/", async (req, res) => {
  try {
    // Cloud voice has its own allowance because it is far more expensive than
    // text AI actions. Free/Reader Plus users stay on device voice.
    if (!ensureFeature(req, res, "cloudVoice")) return;
    const ent = req.entitlement!;

    const body = (req.body || {}) as {
      text?: string;
      voice?: string;
      speed?: number;
      language?: string;
    };
    const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
    if (!text) return res.status(400).json({ error: "text is required." });
    const language = normalizeLanguage(body.language);
    if (!CLOUD_TTS_LANGUAGES.has(language)) {
      return res.status(422).json({
        error: "cloud_voice_language_unsupported",
        feature: "cloudVoice",
        language,
        message:
          "Cloud AI voice is not quality-approved for this language yet. Use device voice until this language pack passes QA.",
      });
    }

    const voice = body.voice && VOICES.has(body.voice) ? body.voice : process.env.TTS_VOICE || "nova";
    const speed = Math.min(4, Math.max(0.25, Number(body.speed) || 1));
    const model = process.env.TTS_MODEL || "tts-1-hd";

    const key = crypto
      .createHash("sha1")
      .update(`${model}|${language}|${voice}|${speed}|${text}`)
      .digest("hex");

    let audio = cacheGet(key);
    if (audio) {
      addUsage(ent.appUserId, "cacheHits");
    } else {
      const quota = checkQuota(
        ent.appUserId,
        "cloudVoiceChars",
        ent.tier.limits.cloudVoiceCharsPerMonth,
        text.length
      );
      if (!quota.ok) {
        return res.status(429).json({
          error: "quota_exceeded",
          feature: "cloudVoice",
          used: quota.used,
          limit: quota.limit,
          remaining: quota.remaining,
          requested: text.length,
          message:
            "You've reached this month's AI voice allowance. Use device voice, renew next month, or buy an AI voice pack.",
        });
      }
      const speech = await getClient().audio.speech.create({
        model,
        voice: voice as any,
        input: text,
        speed,
        response_format: "mp3",
      });
      audio = Buffer.from(await speech.arrayBuffer());
      cacheSet(key, audio);
      addUsage(ent.appUserId, "cloudVoiceChars", text.length);
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.send(audio);
  } catch (err: any) {
    console.error("TTS request failed:", err?.status, err?.code, err?.message);
    if (/OPENAI_API_KEY/.test(err?.message || "")) {
      return res
        .status(503)
        .json({ error: "Cloud voice is not configured. Add OPENAI_API_KEY to backend/.env." });
    }
    if (err?.status === 401) {
      return res.status(502).json({ error: "OpenAI rejected the API key. Update backend/.env." });
    }
    if (err?.status === 429 || err?.code === "insufficient_quota") {
      return res.status(502).json({
        error:
          "Your OpenAI account has no available quota. Add billing/credit at platform.openai.com to enable the natural voice.",
      });
    }
    return res.status(500).json({ error: "TTS request failed." });
  }
});

function normalizeLanguage(language?: string): string {
  const raw = String(language || "en-US").trim().toLowerCase().replace("_", "-");
  const primary = raw.split("-")[0] || "en";
  if (primary === "no") return "no";
  return primary;
}
