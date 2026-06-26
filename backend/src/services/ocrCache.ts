/**
 * Persistent on-disk cache for OCR results, keyed by document content hash.
 *
 * This is the "save the OCR'd version for next time" feature: the first time a
 * scanned PDF is processed we recognize each page once and write it here, so
 * any later upload of the same file (same bytes → same hash) is instant.
 *
 * Copyright note: we only store the *recognized text* of a document the user
 * themselves uploaded, on the server that processes it, keyed by an anonymous
 * hash (no filename, no user identity). Entries expire after OCR_CACHE_TTL_DAYS.
 * Set OCR_CACHE_ENABLED=false to disable persistence entirely.
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from "fs";
import { join } from "path";
import type { OcrPageResult } from "./ocrExtract";

const ENABLED = (process.env.OCR_CACHE_ENABLED ?? "true").toLowerCase() !== "false";
const TTL_DAYS = Number(process.env.OCR_CACHE_TTL_DAYS || 30);
const CACHE_DIR = join(process.cwd(), ".ocr-cache");

interface CacheFile {
  hash: string;
  updatedAt: number;
  pages: Record<number, OcrPageResult>;
}

/** Stable content hash for a document buffer. */
export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function cachePath(hash: string): string {
  return join(CACHE_DIR, `${hash}.json`);
}

function ensureDir(): boolean {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function load(hash: string): CacheFile | null {
  if (!ENABLED) return null;
  const file = cachePath(hash);
  try {
    if (!existsSync(file)) return null;
    // Expire stale entries.
    const ageMs = Date.now() - statSync(file).mtimeMs;
    if (ageMs > TTL_DAYS * 24 * 60 * 60 * 1000) {
      try {
        rmSync(file);
      } catch {
        /* ignore */
      }
      return null;
    }
    return JSON.parse(readFileSync(file, "utf8")) as CacheFile;
  } catch {
    return null;
  }
}

function save(data: CacheFile): void {
  if (!ENABLED || !ensureDir()) return;
  try {
    writeFileSync(cachePath(data.hash), JSON.stringify(data), "utf8");
  } catch {
    /* cache is best-effort; never throw */
  }
}

/** Get a cached OCR result for one page, or null. */
export function ocrCacheGet(hash: string, page: number): OcrPageResult | null {
  const file = load(hash);
  return file?.pages?.[page] ?? null;
}

/** Store one page's OCR result (merges into the document's cache file). */
export function ocrCacheSet(hash: string, page: number, result: OcrPageResult): void {
  if (!ENABLED) return;
  const existing = load(hash) ?? { hash, updatedAt: Date.now(), pages: {} };
  existing.pages[page] = result;
  existing.updatedAt = Date.now();
  save(existing);
}
