import { Router } from "express";
import { ensureFeature } from "../middleware/gate";
import { createAIProvider } from "../providers";
import { SpeechPreparationRequest } from "../providers/AIProvider";
import { cacheGet, cacheKey, cacheSet } from "../services/cache";
import { addUsage, checkQuota } from "../services/usage";

export const textIntelligenceRouter = Router();
const MAX_CURRENT_CHARS = 1800;
const MAX_CONTEXT_CHARS = 1200;
let provider: ReturnType<typeof createAIProvider> | null = null;

function getProvider() {
  if (!provider) provider = createAIProvider();
  return provider;
}

textIntelligenceRouter.post("/", async (req, res) => {
  try {
    if (!ensureFeature(req, res, "ai")) return;
    const entitlement = req.entitlement!;
    const body = req.body as Partial<SpeechPreparationRequest>;
    if (!body.rawText || typeof body.rawText !== "string") {
      return res.status(400).json({ error: "rawText is required." });
    }

    const request: SpeechPreparationRequest = {
      rawText: body.rawText.slice(0, MAX_CURRENT_CHARS),
      before: trimContext(body.before, true),
      after: trimContext(body.after, false),
      layout: body.layout,
      language: body.language,
      localStructure: body.localStructure,
    };
    const key = cacheKey(["speech-preparation-v1", JSON.stringify(request)]);
    const cached = cacheGet(key);
    if (cached) {
      addUsage(entitlement.appUserId, "cacheHits");
      return res.json({ ...cached, cached: true });
    }

    const quota = checkQuota(
      entitlement.appUserId,
      "aiActions",
      entitlement.tier.limits.aiActionsPerMonth
    );
    if (!quota.ok) {
      return res.status(429).json({
        error: "quota_exceeded",
        feature: "text_intelligence",
        used: quota.used,
        limit: quota.limit,
      });
    }

    const activeProvider = getProvider();
    if (!activeProvider.prepareSpeech) {
      return res.status(503).json({ error: "Online speech preparation is unavailable." });
    }
    const result = await activeProvider.prepareSpeech(request);
    if (!preservesWords(request.rawText, result.text)) {
      return res.status(422).json({ error: "Online preparation failed the fidelity check." });
    }
    cacheSet(key, result);
    addUsage(entitlement.appUserId, "aiActions");
    return res.json({ ...result, cached: false, provider: activeProvider.name });
  } catch (error: any) {
    console.error("Text intelligence fallback failed:", error?.status, error?.code, error?.message);
    if (req.entitlement) addUsage(req.entitlement.appUserId, "failedRequests");
    return res.status(500).json({ error: "Online speech preparation failed." });
  }
});

function trimContext(
  segments: SpeechPreparationRequest["before"],
  keepEnd: boolean
): SpeechPreparationRequest["before"] {
  const selected = (segments || []).slice(keepEnd ? -2 : 0, keepEnd ? undefined : 2);
  let remaining = MAX_CONTEXT_CHARS;
  const out: NonNullable<SpeechPreparationRequest["before"]> = [];
  for (const segment of selected) {
    if (remaining <= 0) break;
    const text = String(segment.text || "").slice(0, remaining);
    out.push({ text, kind: segment.kind });
    remaining -= text.length;
  }
  return out;
}

function preservesWords(source: string, candidate: string): boolean {
  const words = (value: string) =>
    (value.toLocaleLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || []).filter(Boolean);
  const expected = words(source);
  const actual = words(candidate);
  if (Math.abs(expected.length - actual.length) > Math.max(1, expected.length * 0.02)) return false;
  if (!expected.length) return actual.length === 0;
  const matching = expected.filter((word, index) => actual[index] === word).length;
  return matching / expected.length >= 0.98;
}
