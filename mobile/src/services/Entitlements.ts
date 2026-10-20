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

// All reading features are local and free. Zero denotes no commercial quota.
export const FREE_LIMITS: PlanLimits = {
  ocrPagesPerMonth: 0, aiActionsPerMonth: 0, cloudVoiceCharsPerMonth: 0,
  pdfsPerMonth: 0, maxFileSizeMb: 0, maxPages: 0, perDocPageCap: 0,
  localVoiceSecondsPerDay: 0,
};
export const FREE_ENTITLEMENT: EntitlementSnapshot = {
  tier: "free", name: "Free", source: "free",
  features: {
    ads: false, ai: false, ocr: true, serverExtract: false, export: true,
    cloudVoice: false, unlimitedLibrary: true, localVoice: true,
  },
  limits: FREE_LIMITS,
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

export async function fetchEntitlement(_forceRefresh = false): Promise<EntitlementSnapshot> {
  return FREE_ENTITLEMENT;
}
export async function fetchUsage(): Promise<UsageSnapshot | null> {
  return null;
}
