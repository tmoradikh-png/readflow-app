/**
 * Public + per-user metadata endpoints.
 *
 *   GET /api/config        public — plans, prices, limits (drives the paywall)
 *   GET /api/entitlements  the caller's resolved tier (backend = source of truth)
 *   GET /api/usage         the caller's current-month usage vs their limits
 *
 * Pricing/limits live in config/plans.ts so they can change server-side without
 * shipping a new app build.
 */
import { Router } from "express";
import { publicConfig } from "../config/plans";
import { getUsage, currentMonth } from "../services/usage";

export const configRouter = Router();

configRouter.get("/config", (_req, res) => {
  res.json(publicConfig());
});

configRouter.get("/entitlements", (req, res) => {
  const ent = req.entitlement!;
  res.json({
    tier: ent.tier.key,
    name: ent.tier.name,
    features: ent.tier.features,
    limits: ent.tier.limits,
    source: ent.source,
  });
});

configRouter.get("/usage", (req, res) => {
  const ent = req.entitlement!;
  const month = currentMonth();
  const usage = getUsage(ent.appUserId, month);
  const { limits } = ent.tier;
  res.json({
    month,
    tier: ent.tier.key,
    usage,
    limits: {
      ocrPagesPerMonth: limits.ocrPagesPerMonth,
      aiActionsPerMonth: limits.aiActionsPerMonth,
      pdfsPerMonth: limits.pdfsPerMonth,
    },
    remaining: {
      ocrPages: Math.max(0, limits.ocrPagesPerMonth - usage.ocrPages),
      aiActions: Math.max(0, limits.aiActionsPerMonth - usage.aiActions),
      pdfs: Math.max(0, limits.pdfsPerMonth - usage.pdfs),
    },
  });
});
