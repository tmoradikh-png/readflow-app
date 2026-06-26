/**
 * Monthly usage tracking, keyed by (anonymous app-user id, calendar month).
 *
 * First release uses a simple JSON-file store (same philosophy as ocrCache) so
 * we don't need a database yet. The interface is deliberately small so it can
 * be swapped for Postgres/SQLite later without touching the routes.
 *
 * We store ONLY counters and hashes here — never document text or titles.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ENABLED = (process.env.USAGE_TRACKING ?? "true").toLowerCase() !== "false";
const DATA_DIR = join(process.cwd(), ".usage");

/** Countable usage fields (all reset each calendar month). */
export type UsageField =
  | "ocrPages"
  | "aiActions"
  | "pdfs"
  | "failedRequests"
  | "cacheHits";

export interface UsageRecord {
  ocrPages: number;
  aiActions: number;
  pdfs: number;
  failedRequests: number;
  cacheHits: number;
}

const ZERO: UsageRecord = {
  ocrPages: 0,
  aiActions: 0,
  pdfs: 0,
  failedRequests: 0,
  cacheHits: 0,
};

/** "2026-06" — the bucket usage is grouped by. */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthFile(month: string): string {
  return join(DATA_DIR, `${month}.json`);
}

function ensureDir(): boolean {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

// In-memory map per month: { [appUserId]: UsageRecord }. Lazily loaded from disk.
type MonthMap = Record<string, UsageRecord>;
const loaded = new Map<string, MonthMap>();
let dirty = false;

function loadMonth(month: string): MonthMap {
  const cached = loaded.get(month);
  if (cached) return cached;
  let map: MonthMap = {};
  try {
    const f = monthFile(month);
    if (existsSync(f)) map = JSON.parse(readFileSync(f, "utf8")) as MonthMap;
  } catch {
    map = {};
  }
  loaded.set(month, map);
  return map;
}

function persist(month: string): void {
  if (!ENABLED || !ensureDir()) return;
  try {
    writeFileSync(monthFile(month), JSON.stringify(loaded.get(month) ?? {}), "utf8");
    dirty = false;
  } catch {
    /* best-effort; never throw on usage write */
  }
}

/** Read a user's usage for the current month (zeros if none). */
export function getUsage(appUserId: string, month = currentMonth()): UsageRecord {
  const map = loadMonth(month);
  return { ...ZERO, ...(map[appUserId] || {}) };
}

/** Increment a usage counter and persist. Returns the new total for that field. */
export function addUsage(
  appUserId: string,
  field: UsageField,
  amount = 1,
  month = currentMonth()
): number {
  if (!ENABLED) return 0;
  const map = loadMonth(month);
  const rec = (map[appUserId] = { ...ZERO, ...(map[appUserId] || {}) });
  rec[field] += amount;
  dirty = true;
  persist(month);
  return rec[field];
}

export interface QuotaCheck {
  ok: boolean;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Check whether `amount` more of `field` fits under `limit` WITHOUT mutating.
 * Use this before doing paid work; call addUsage() after the work succeeds so
 * failed requests don't burn quota.
 */
export function checkQuota(
  appUserId: string,
  field: UsageField,
  limit: number,
  amount = 1,
  month = currentMonth()
): QuotaCheck {
  const used = getUsage(appUserId, month)[field];
  const remaining = Math.max(0, limit - used);
  return { ok: used + amount <= limit, used, limit, remaining };
}
