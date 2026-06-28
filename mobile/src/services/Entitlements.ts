import { API_BASE, apiHeaders } from "../config";

export interface PlanFeatures {
  ads: boolean;
  ai: boolean;
  ocr: boolean;
  serverExtract: boolean;
  export: boolean;
  cloudVoice: boolean;
  unlimitedLibrary: boolean;
}

export interface PlanLimits {
  ocrPagesPerMonth: number;
  aiActionsPerMonth: number;
  cloudVoiceCharsPerMonth: number;
  pdfsPerMonth: number;
  maxFileSizeMb?: number;
  maxPages?: number;
  perDocPageCap?: number;
}

export interface EntitlementSnapshot {
  tier: string;
  name: string;
  features: PlanFeatures;
  limits: PlanLimits;
  source: "revenuecat" | "dev-override" | "free";
}

const FREE_FEATURES: PlanFeatures = {
  ads: true,
  ai: false,
  ocr: false,
  serverExtract: true,
  export: false,
  cloudVoice: false,
  unlimitedLibrary: false,
};

export const FREE_LIMITS: PlanLimits = {
  ocrPagesPerMonth: 0,
  aiActionsPerMonth: 0,
  cloudVoiceCharsPerMonth: 0,
  pdfsPerMonth: 30,
  maxFileSizeMb: 20,
  maxPages: 2000,
  perDocPageCap: 30,
};

export const FREE_ENTITLEMENT: EntitlementSnapshot = {
  tier: "free",
  name: "Free",
  features: FREE_FEATURES,
  limits: FREE_LIMITS,
  source: "free",
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

export async function fetchEntitlement(): Promise<EntitlementSnapshot> {
  try {
    const res = await fetch(`${API_BASE}/api/entitlements`, {
      headers: apiHeaders(),
    });
    if (!res.ok) return FREE_ENTITLEMENT;
    const data = (await res.json()) as Partial<EntitlementSnapshot>;
    return {
      tier: String(data.tier || "free"),
      name: String(data.name || "Free"),
      features: { ...FREE_FEATURES, ...(data.features || {}) },
      limits: { ...FREE_LIMITS, ...((data as any).limits || {}) },
      source:
        data.source === "revenuecat" || data.source === "dev-override" || data.source === "free"
          ? data.source
          : "free",
    };
  } catch {
    return FREE_ENTITLEMENT;
  }
}

export async function fetchUsage(): Promise<UsageSnapshot | null> {
  try {
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
