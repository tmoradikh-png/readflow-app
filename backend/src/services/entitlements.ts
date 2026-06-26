/**
 * Entitlement resolution — the BACKEND's source of truth for what a user paid
 * for. The mobile app must never be trusted to assert its own tier; it only
 * sends its anonymous RevenueCat app-user id, and we verify entitlements with
 * RevenueCat's REST API using a server-only secret key.
 *
 * Resolution order for a request:
 *   1. If RC_SECRET_KEY is set and the request carries an app-user id, ask
 *      RevenueCat which entitlements are active → map to the highest tier.
 *   2. Otherwise (local dev / RC not configured): if ENTITLEMENTS_DEV_OVERRIDE
 *      is true, use DEV_DEFAULT_TIER (lets us test paid features without IAP).
 *   3. Fall back to the free tier.
 *
 * Results are cached briefly per user to avoid hammering RevenueCat.
 */
import type { Request } from "express";
import { FREE_TIER, highestTier, tierByKey, Tier } from "../config/plans";

const RC_SECRET_KEY = process.env.RC_SECRET_KEY || "";
const RC_API_BASE = process.env.RC_API_BASE || "https://api.revenuecat.com/v1";
const DEV_OVERRIDE =
  (process.env.ENTITLEMENTS_DEV_OVERRIDE ?? "false").toLowerCase() === "true";
const DEV_DEFAULT_TIER = process.env.DEV_DEFAULT_TIER || "free";
const CACHE_TTL_MS = Number(process.env.ENTITLEMENTS_CACHE_MS || 60_000);

export interface Entitlement {
  /** Anonymous RevenueCat app-user id (or a generated one for dev). */
  appUserId: string;
  tier: Tier;
  /** Where the decision came from (for debugging / headers). */
  source: "revenuecat" | "dev-override" | "free";
}

/** Read the anonymous app-user id the client sends (RevenueCat $RCAnonymousID). */
export function appUserIdFromRequest(req: Request): string | null {
  const raw = req.header("x-app-user-id");
  if (!raw) return null;
  const id = raw.trim();
  // Defensive: cap length and allow only safe id characters.
  if (!id || id.length > 128 || !/^[A-Za-z0-9:_\-.$]+$/.test(id)) return null;
  return id;
}

interface CacheEntry {
  entitlement: Entitlement;
  expires: number;
}
const cache = new Map<string, CacheEntry>();

/** Query RevenueCat for the user's active entitlement ids. */
async function fetchActiveEntitlements(appUserId: string): Promise<string[]> {
  const url = `${RC_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${RC_SECRET_KEY}` },
  });
  if (!res.ok) {
    // 404 = unknown user (never purchased) → no entitlements, not an error.
    if (res.status === 404) return [];
    throw new Error(`RevenueCat ${res.status}`);
  }
  const data: any = await res.json();
  const ents = data?.subscriber?.entitlements || {};
  const now = Date.now();
  const active: string[] = [];
  for (const [id, info] of Object.entries<any>(ents)) {
    const expires = info?.expires_date ? Date.parse(info.expires_date) : NaN;
    // No expiry (lifetime) or still in the future = active.
    if (!info?.expires_date || (Number.isFinite(expires) && expires > now)) {
      active.push(id);
    }
  }
  return active;
}

/**
 * Resolve the caller's entitlement. Never throws — on any failure it returns a
 * safe default (dev tier in dev, otherwise free), so a RevenueCat outage can't
 * take the API down. Paid work still rechecks quotas separately.
 */
export async function resolveEntitlement(req: Request): Promise<Entitlement> {
  const appUserId = appUserIdFromRequest(req);

  // Local dev / RC not configured.
  if (!RC_SECRET_KEY || !appUserId) {
    if (DEV_OVERRIDE) {
      return {
        appUserId: appUserId || "dev-local",
        tier: tierByKey(DEV_DEFAULT_TIER),
        source: "dev-override",
      };
    }
    return { appUserId: appUserId || "anonymous", tier: FREE_TIER, source: "free" };
  }

  const cached = cache.get(appUserId);
  if (cached && cached.expires > Date.now()) return cached.entitlement;

  let tier: Tier = FREE_TIER;
  let source: Entitlement["source"] = "free";
  try {
    const active = await fetchActiveEntitlements(appUserId);
    tier = highestTier(active);
    source = "revenuecat";
  } catch (err: any) {
    console.warn("[entitlements] RevenueCat lookup failed:", err?.message);
    // Fail safe to free (do not grant paid access on error).
    tier = FREE_TIER;
    source = "free";
  }

  const entitlement: Entitlement = { appUserId, tier, source };
  cache.set(appUserId, { entitlement, expires: Date.now() + CACHE_TTL_MS });
  return entitlement;
}
