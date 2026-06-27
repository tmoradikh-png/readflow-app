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

export interface EntitlementSnapshot {
  tier: string;
  name: string;
  features: PlanFeatures;
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

export const FREE_ENTITLEMENT: EntitlementSnapshot = {
  tier: "free",
  name: "Free",
  features: FREE_FEATURES,
  source: "free",
};

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
      source:
        data.source === "revenuecat" || data.source === "dev-override" || data.source === "free"
          ? data.source
          : "free",
    };
  } catch {
    return FREE_ENTITLEMENT;
  }
}
