import { Router } from "express";
import { createAIProvider } from "../providers";
import { AIRequest, AITask } from "../providers/AIProvider";
import { cacheGet, cacheKey, cacheSet } from "../services/cache";
import { ensureFeature } from "../middleware/gate";
import { addUsage, checkQuota } from "../services/usage";

export const aiRouter = Router();

const VALID_TASKS: AITask[] = ["summary", "explain", "simplify", "key_points", "ask"];
const MAX_CHARS = 12000; // keep cost down: only send the needed chunk

// Lazily created so the server still boots (for PDF/reflow/TTS testing)
// even before an OPENAI_API_KEY is configured.
let provider: ReturnType<typeof createAIProvider> | null = null;
function getProvider() {
  if (!provider) provider = createAIProvider();
  return provider;
}

/**
 * POST /api/ai
 * body: { task, text, question?, language? }
 * -> { summary, simple_explanation, key_points, terms, answer? }
 *
 * PAID feature (AI Pro and above). The OpenAI key lives only on the server.
 * Cached results are free and do not consume the monthly AI-action quota.
 */
aiRouter.post("/", async (req, res) => {
  try {
    // 1) Entitlement: AI is a paid feature.
    if (!ensureFeature(req, res, "ai")) return;
    const ent = req.entitlement!;

    const { task, text, question, language } = req.body as Partial<AIRequest>;

    if (!task || !VALID_TASKS.includes(task)) {
      return res.status(400).json({ error: `task must be one of: ${VALID_TASKS.join(", ")}` });
    }
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "text is required." });
    }

    const chunk = text.slice(0, MAX_CHARS);
    const key = cacheKey([task, language, question, chunk]);

    // 2) Cache hit → return for free (no quota burn).
    const cached = cacheGet(key);
    if (cached) {
      addUsage(ent.appUserId, "cacheHits");
      return res.json({ ...cached, cached: true });
    }

    // 3) Quota: only fresh AI work counts against the monthly limit.
    const quota = checkQuota(ent.appUserId, "aiActions", ent.tier.limits.aiActionsPerMonth);
    if (!quota.ok) {
      return res.status(429).json({
        error: "quota_exceeded",
        feature: "ai",
        used: quota.used,
        limit: quota.limit,
        message: "You've reached this month's AI limit. It resets next month, or upgrade for higher limits.",
      });
    }

    const activeProvider = getProvider();
    const result = await activeProvider.run({ task, text: chunk, question, language });
    cacheSet(key, result);
    addUsage(ent.appUserId, "aiActions");
    return res.json({ ...result, cached: false, provider: activeProvider.name });
  } catch (err: any) {
    console.error("AI request failed:", err?.status, err?.code, err?.message);
    if (req.entitlement) addUsage(req.entitlement.appUserId, "failedRequests");
    if (/OPENAI_API_KEY/.test(err?.message || "")) {
      return res.status(503).json({ error: "AI is not configured yet. Add OPENAI_API_KEY to backend/.env and restart." });
    }
    if (err?.status === 401) {
      return res.status(502).json({ error: "OpenAI rejected the API key. Create a new key and update backend/.env." });
    }
    if (err?.status === 429 || err?.code === "insufficient_quota") {
      return res.status(502).json({
        error:
          "Your OpenAI account has no available quota. Add a payment method / credit at platform.openai.com (Billing) to enable AI.",
      });
    }
    return res.status(500).json({ error: "AI request failed." });
  }
});
