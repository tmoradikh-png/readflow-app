/**
 * Tiny in-memory cache to reduce AI cost.
 * Caches summaries/explanations per (task + text hash + question).
 * Swap for Redis later without changing call sites.
 */
import crypto from "crypto";

interface Entry {
  value: unknown;
  expires: number;
}

const store = new Map<string, Entry>();
const TTL_MS = 1000 * 60 * 60 * 24; // 24h

export function cacheKey(parts: (string | undefined)[]): string {
  const joined = parts.filter(Boolean).join("|");
  return crypto.createHash("sha256").update(joined).digest("hex");
}

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown): void {
  store.set(key, { value, expires: Date.now() + TTL_MS });
}
