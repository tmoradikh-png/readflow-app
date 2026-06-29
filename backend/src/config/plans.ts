/**
 * Canonical plan / entitlement definitions for readFlow.
 *
 * This file is the SINGLE SOURCE OF TRUTH for tiers, prices, limits and
 * feature flags. The backend enforces these; the mobile app fetches a public
 * copy via `GET /api/config` so pricing/limits can change without an app
 * update (the app keeps a hard-coded fallback in case the network call fails).
 *
 * Business rules:
 * - Free and Reader Plus must have no per-use AI/OCR/cloud-voice vendor cost.
 * - Direct AI vendor COGS for AI Pro/Power must stay under 20% of conservative
 *   net subscription revenue, calculated against the cheaper annual plan.
 * - Scanned/image PDFs require AI Pro or Power because OCR consumes backend CPU
 *   and must be capped even though it has no OpenAI per-page charge.
 */

export type TierKey = "free" | "reader_plus" | "ai_pro" | "power";
export type BillingPeriod = "monthly" | "yearly";

/** Monthly usage allowances. Use Infinity sparingly — we avoid "unlimited". */
export interface PlanLimits {
  /** OCR pages allowed per calendar month. */
  ocrPagesPerMonth: number;
  /** AI actions (summary/explain/ask/...) per calendar month. */
  aiActionsPerMonth: number;
  /** Cloud AI voice characters allowed per calendar month. */
  cloudVoiceCharsPerMonth: number;
  /** Server PDF extractions per calendar month (abuse guard). */
  pdfsPerMonth: number;
  /** Largest file (MB) the backend will accept for this tier. */
  maxFileSizeMb: number;
  /** Most pages the backend will process for one document. */
  maxPages: number;
  /**
   * Free reading cap PER DOCUMENT (0 = no cap). Free users can read the first
   * N pages of their own PDF; beyond that we show the paywall.
   */
  perDocPageCap: number;
}

export interface PlanFeatures {
  /** Show ads (free tier only). */
  ads: boolean;
  /** AI summary/explain/simplify/key-points/ask. */
  ai: boolean;
  /** OCR for scanned/image PDFs. */
  ocr: boolean;
  /** May call the server PDF extraction endpoint at all. */
  serverExtract: boolean;
  /** Export notes/summaries. */
  export: boolean;
  /** Cloud natural voice, capped by cloudVoiceCharsPerMonth. */
  cloudVoice: boolean;
  /** Save an unlimited local library (vs the small free cap). */
  unlimitedLibrary: boolean;
}

export interface TierProduct {
  /** Store product identifier (App Store / Google Play, mirrored in RevenueCat). */
  productId: string;
  /** Display price in USD (stores localize the real charge). */
  priceUsd: number;
}

export interface Tier {
  key: TierKey;
  name: string;
  tagline: string;
  /** RevenueCat entitlement id that unlocks this tier (null for free). */
  entitlementId: string | null;
  /** Highlight this as the default/recommended plan in the paywall. */
  recommended?: boolean;
  products: Partial<Record<BillingPeriod, TierProduct>>;
  limits: PlanLimits;
  features: PlanFeatures;
}

/** Higher rank = more access. Used for "requires at least tier X" checks. */
export const TIER_RANK: Record<TierKey, number> = {
  free: 0,
  reader_plus: 1,
  ai_pro: 2,
  power: 3,
};

export const AI_ECONOMICS = {
  /** Conservative net after roughly 15% Google Play + 1% RevenueCat. */
  netRevenueRatio: 0.84,
  /** Direct AI vendor spend should not exceed 20% of the money we receive. */
  maxAiVendorCogsRatio: 0.2,
  /** Current production-safe assumption: OpenAI TTS-1 HD is $30 / 1M chars. */
  cloudVoiceUsdPerChar: 30 / 1_000_000,
  /**
   * Conservative text-AI estimate for one fresh action:
   * 12k chars input (~3k tokens) plus up to ~1k output tokens on gpt-5.4-nano.
   * Real usage should be lower with shorter selections and cache hits.
   */
  aiActionUsd: 0.00185,
};

export const TIERS: Tier[] = [
  {
    key: "free",
    name: "Free",
    tagline: "Read your PDFs aloud, on your phone.",
    entitlementId: null,
    products: {},
    limits: {
      ocrPagesPerMonth: 0,
      aiActionsPerMonth: 0,
      cloudVoiceCharsPerMonth: 0,
      pdfsPerMonth: 1,
      maxFileSizeMb: 20,
      maxPages: 2000,
      perDocPageCap: 100,
    },
    features: {
      ads: true,
      ai: false,
      ocr: false,
      serverExtract: true, // native text only; OCR stays off
      export: false,
      cloudVoice: false,
      unlimitedLibrary: false,
    },
  },
  {
    key: "reader_plus",
    name: "Reader Plus",
    tagline: "Ad-free reading for full text PDFs.",
    entitlementId: "reader_plus",
    products: {
      monthly: { productId: "readflow_reader_plus_monthly", priceUsd: 4.99 },
      yearly: { productId: "readflow_reader_plus_yearly", priceUsd: 39.99 },
    },
    limits: {
      ocrPagesPerMonth: 0,
      aiActionsPerMonth: 0,
      cloudVoiceCharsPerMonth: 0,
      pdfsPerMonth: 100,
      maxFileSizeMb: 100,
      maxPages: 2000,
      perDocPageCap: 0,
    },
    features: {
      ads: false,
      ai: false,
      ocr: false,
      serverExtract: true,
      export: false,
      cloudVoice: false,
      unlimitedLibrary: true,
    },
  },
  {
    key: "ai_pro",
    name: "AI Pro",
    tagline: "Summaries, explanations and Q&A on any PDF.",
    entitlementId: "ai_pro",
    recommended: true,
    products: {
      monthly: { productId: "readflow_ai_pro_monthly", priceUsd: 12.99 },
      yearly: { productId: "readflow_ai_pro_yearly", priceUsd: 119.99 },
    },
    limits: {
      ocrPagesPerMonth: 750,
      aiActionsPerMonth: 150,
      cloudVoiceCharsPerMonth: 45000,
      pdfsPerMonth: 300,
      maxFileSizeMb: 100,
      maxPages: 1500,
      perDocPageCap: 0,
    },
    features: {
      ads: false,
      ai: true,
      ocr: true,
      serverExtract: true,
      export: false,
      cloudVoice: true,
      unlimitedLibrary: true,
    },
  },
  {
    key: "power",
    name: "Power",
    tagline: "High limits, export and batch tools for heavy users.",
    entitlementId: "power",
    products: {
      monthly: { productId: "readflow_power_monthly", priceUsd: 29.99 },
      yearly: { productId: "readflow_power_yearly", priceUsd: 279.99 },
    },
    limits: {
      ocrPagesPerMonth: 2500,
      aiActionsPerMonth: 400,
      cloudVoiceCharsPerMonth: 100000,
      pdfsPerMonth: 1000,
      maxFileSizeMb: 200,
      maxPages: 5000,
      perDocPageCap: 0,
    },
    features: {
      ads: false,
      ai: true,
      ocr: true,
      serverExtract: true,
      export: true,
      cloudVoice: true,
      unlimitedLibrary: true,
    },
  },
];

export const FREE_TIER = TIERS[0];

function conservativeMonthlyNetRevenue(tier: Tier): number {
  const monthly = tier.products.monthly?.priceUsd;
  const yearly = tier.products.yearly ? tier.products.yearly.priceUsd / 12 : undefined;
  const listedMonthly = Math.min(
    monthly ?? Number.POSITIVE_INFINITY,
    yearly ?? Number.POSITIVE_INFINITY
  );
  return Number.isFinite(listedMonthly) ? listedMonthly * AI_ECONOMICS.netRevenueRatio : 0;
}

export function estimatedMonthlyAiVendorCostUsd(tier: Tier): number {
  return (
    tier.limits.cloudVoiceCharsPerMonth * AI_ECONOMICS.cloudVoiceUsdPerChar +
    tier.limits.aiActionsPerMonth * AI_ECONOMICS.aiActionUsd
  );
}

export function aiVendorBudgetUsd(tier: Tier): number {
  return conservativeMonthlyNetRevenue(tier) * AI_ECONOMICS.maxAiVendorCogsRatio;
}

function assertAiPlanEconomics() {
  for (const tier of TIERS) {
    if (!tier.features.ai && !tier.features.cloudVoice) continue;
    const estimated = estimatedMonthlyAiVendorCostUsd(tier);
    const budget = aiVendorBudgetUsd(tier);
    if (estimated > budget + 0.005) {
      throw new Error(
        `Plan ${tier.key} exceeds AI vendor budget: estimated $${estimated.toFixed(
          2
        )} > budget $${budget.toFixed(2)}`
      );
    }
  }
}

assertAiPlanEconomics();

const TIER_BY_KEY = new Map<TierKey, Tier>(TIERS.map((t) => [t.key, t]));
const TIER_BY_ENTITLEMENT = new Map<string, Tier>(
  TIERS.filter((t) => t.entitlementId).map((t) => [t.entitlementId as string, t])
);

export function tierByKey(key: string | undefined | null): Tier {
  return (key && TIER_BY_KEY.get(key as TierKey)) || FREE_TIER;
}

/** Map a RevenueCat entitlement id to its tier (or free if unknown). */
export function tierByEntitlement(entitlementId: string | undefined | null): Tier {
  return (entitlementId && TIER_BY_ENTITLEMENT.get(entitlementId)) || FREE_TIER;
}

/**
 * Given the set of active RevenueCat entitlement ids for a user, return the
 * highest tier they own (users may technically hold more than one).
 */
export function highestTier(activeEntitlementIds: string[]): Tier {
  let best = FREE_TIER;
  for (const id of activeEntitlementIds) {
    const t = TIER_BY_ENTITLEMENT.get(id);
    if (t && TIER_RANK[t.key] > TIER_RANK[best.key]) best = t;
  }
  return best;
}

export function meetsTier(current: TierKey, required: TierKey): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

/** Public marketing/config payload for the mobile app (no secrets here). */
export function publicConfig() {
  return {
    currency: "USD",
    recommendedTier: TIERS.find((t) => t.recommended)?.key ?? "ai_pro",
    cloudVoiceAvailable: true,
    tiers: TIERS.map((t) => ({
      key: t.key,
      name: t.name,
      tagline: t.tagline,
      recommended: Boolean(t.recommended),
      products: t.products,
      limits: t.limits,
      features: t.features,
    })),
  };
}
