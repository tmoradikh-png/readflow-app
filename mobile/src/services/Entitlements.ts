import { API_BASE, apiHeaders, REVIEWER_QA_MODE } from "../config";
import { loadAppUserId } from "./AppIdentity";
import { loadReviewerToken } from "./ReviewerToken";

export interface PlanFeatures {
  ads: boolean;
  ai: boolean;
  ocr: boolean;
  serverExtract: boolean;
  export: boolean;
  cloudVoice: boolean;
  unlimitedLibrary: boolean;
  localVoice: boolean;
}

export interface PlanLimits {
  ocrPagesPerMonth: number;
  aiActionsPerMonth: number;
  cloudVoiceCharsPerMonth: number;
  pdfsPerMonth: number;
  maxFileSizeMb?: number;
  maxPages?: number;
  perDocPageCap?: number;
  /** Daily on-device rF AI seconds. 0 means unlimited when localVoice is enabled. */
  localVoiceSecondsPerDay?: number;
}

export interface EntitlementSnapshot {
  tier: string;
  name: string;
  features: PlanFeatures;
  limits: PlanLimits;
  source: "revenuecat" | "reviewer-access" | "dev-override" | "free";
}

const FREE_FEATURES: PlanFeatures = {
  ads: false,
  ai: false,
  ocr: false,
  serverExtract: true,
  export: false,
  cloudVoice: false,
  unlimitedLibrary: false,
  localVoice: true,
};

export const FREE_LIMITS: PlanLimits = {
  ocrPagesPerMonth: 0,
  aiActionsPerMonth: 0,
  cloudVoiceCharsPerMonth: 0,
  pdfsPerMonth: 1,
  maxFileSizeMb: 20,
  maxPages: 300,
  perDocPageCap: 300,
  localVoiceSecondsPerDay: 5 * 60,
};

export const FREE_ENTITLEMENT: EntitlementSnapshot = {
  tier: "free",
  name: "Free",
  features: FREE_FEATURES,
  limits: FREE_LIMITS,
  source: "free",
};

type RevenueCatTier = "reader_plus" | "ai_pro" | "power";

const REVENUECAT_ENTITLEMENTS: Record<RevenueCatTier, EntitlementSnapshot> = {
  reader_plus: {
    tier: "reader_plus",
    name: "Reader Plus",
    features: {
      ads: false,
      ai: false,
      ocr: false,
      serverExtract: true,
      export: false,
      cloudVoice: false,
      unlimitedLibrary: true,
      localVoice: true,
    },
    limits: {
      ocrPagesPerMonth: 0,
      aiActionsPerMonth: 0,
      cloudVoiceCharsPerMonth: 0,
      pdfsPerMonth: 100,
      maxFileSizeMb: 100,
      maxPages: 2000,
      perDocPageCap: 0,
      localVoiceSecondsPerDay: 30 * 60,
    },
    source: "revenuecat",
  },
  ai_pro: {
    tier: "ai_pro",
    name: "AI Pro",
    features: {
      ads: false,
      ai: true,
      ocr: true,
      serverExtract: true,
      export: false,
      cloudVoice: true,
      unlimitedLibrary: true,
      localVoice: true,
    },
    limits: {
      ocrPagesPerMonth: 750,
      aiActionsPerMonth: 150,
      cloudVoiceCharsPerMonth: 20_000,
      pdfsPerMonth: 300,
      maxFileSizeMb: 100,
      maxPages: 2500,
      perDocPageCap: 0,
      localVoiceSecondsPerDay: 0,
    },
    source: "revenuecat",
  },
  power: {
    tier: "power",
    name: "Power",
    features: {
      ads: false,
      ai: true,
      ocr: true,
      serverExtract: true,
      export: true,
      cloudVoice: true,
      unlimitedLibrary: true,
      localVoice: true,
    },
    limits: {
      ocrPagesPerMonth: 2500,
      aiActionsPerMonth: 400,
      cloudVoiceCharsPerMonth: 100_000,
      pdfsPerMonth: 1000,
      maxFileSizeMb: 200,
      maxPages: 5000,
      perDocPageCap: 0,
      localVoiceSecondsPerDay: 0,
    },
    source: "revenuecat",
  },
};

export function entitlementForRevenueCatTier(
  tier: RevenueCatTier
): EntitlementSnapshot {
  return REVENUECAT_ENTITLEMENTS[tier];
}

const QA_REVIEWER_ENTITLEMENT: EntitlementSnapshot = {
  tier: "reviewer",
  name: "QA Reviewer",
  features: {
    ads: false,
    ai: false,
    ocr: false,
    serverExtract: true,
    export: true,
    cloudVoice: false,
    unlimitedLibrary: true,
    localVoice: true,
  },
  limits: {
    ocrPagesPerMonth: 0,
    aiActionsPerMonth: 0,
    cloudVoiceCharsPerMonth: 0,
    pdfsPerMonth: 10_000,
    maxFileSizeMb: 200,
    maxPages: 5000,
    perDocPageCap: 0,
    localVoiceSecondsPerDay: 0,
  },
  source: "dev-override",
};

export interface UsageSnapshot {
  month: string;
  tier: string;
  usage: {
    ocrPages: number;
    aiActions: number;
    cloudVoiceChars: number;
    pdfs: number;
    failedRequests?: number;
    cacheHits?: number;
  };
  limits: {
    ocrPagesPerMonth: number;
    aiActionsPerMonth: number;
    cloudVoiceCharsPerMonth: number;
    pdfsPerMonth: number;
  };
  remaining: {
    ocrPages: number;
    aiActions: number;
    cloudVoiceChars: number;
    pdfs: number;
  };
}

export async function fetchEntitlement(forceRefresh = false): Promise<EntitlementSnapshot> {
  if (REVIEWER_QA_MODE) return QA_REVIEWER_ENTITLEMENT;
  try {
    await Promise.all([loadAppUserId(), loadReviewerToken()]);
    const res = await fetch(`${API_BASE}/api/entitlements`, {
      headers: apiHeaders(
        forceRefresh ? { "x-readflow-entitlement-refresh": "1" } : undefined
      ),
    });
    if (!res.ok) return FREE_ENTITLEMENT;
    const data = (await res.json()) as Partial<EntitlementSnapshot>;
    return {
      tier: String(data.tier || "free"),
      name: String(data.name || "Free"),
      features: { ...FREE_FEATURES, ...(data.features || {}) },
      limits: { ...FREE_LIMITS, ...((data as any).limits || {}) },
      source:
        data.source === "revenuecat" ||
        data.source === "reviewer-access" ||
        data.source === "dev-override" ||
        data.source === "free"
          ? data.source
          : "free",
    };
  } catch {
    return FREE_ENTITLEMENT;
  }
}

export async function fetchUsage(): Promise<UsageSnapshot | null> {
  try {
    await Promise.all([loadAppUserId(), loadReviewerToken()]);
    const res = await fetch(`${API_BASE}/api/usage`, {
      headers: apiHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data as UsageSnapshot;
  } catch {
    return null;
  }
}
