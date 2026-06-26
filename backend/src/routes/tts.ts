import { Router } from "express";
import crypto from "crypto";
import OpenAI from "openai";
import { ensureFeature } from "../middleware/gate";

export const ttsRouter = Router();

/**
 * POST /api/tts
 * body: { text, voice?, speed? }
 * -> audio/mpeg (spoken audio for one sentence/chunk)
 *
 * Natural cloud voice. The OpenAI key lives ONLY on the server; the mobile app
 * sends text and plays back the returned audio. Gated behind the same paid
 * feature flag as AI so the free tier keeps using the on-device voice (no cost).
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
    // Cloud voice is a paid feature (free tier uses the device voice).
    if (!ensureFeature(req, res, "ai")) return;

    const body = (req.body || {}) as { text?: string; voice?: string; speed?: number };
    const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
    if (!text) return res.status(400).json({ error: "text is required." });

    const voice = body.voice && VOICES.has(body.voice) ? body.voice : process.env.TTS_VOICE || "nova";
    const speed = Math.min(4, Math.max(0.25, Number(body.speed) || 1));
    const model = process.env.TTS_MODEL || "tts-1-hd";

    const key = crypto
      .createHash("sha1")
      .update(`${model}|${voice}|${speed}|${text}`)
      .digest("hex");

    let audio = cacheGet(key);
    if (!audio) {
      const speech = await getClient().audio.speech.create({
        model,
        voice: voice as any,
        input: text,
        speed,
        response_format: "mp3",
      });
      audio = Buffer.from(await speech.arrayBuffer());
      cacheSet(key, audio);
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
