import * as FileSystem from "expo-file-system/legacy";
import { ParsedPdf, PdfPage } from "./PDFParser";

/**
 * DocCache — persists a document's PARSED TEXT (and any OCR'd pages) on the
 * device so an already-opened book can be reopened fully OFFLINE (airplane
 * mode) without re-uploading it to the backend.
 *
 * The raw source file is still kept by the Library; this cache holds the
 * extracted/​OCR'd page text that powers reading + device voice with no network.
 */
export interface CachedDoc {
  cacheVersion?: number;
  docId: string;
  fileName: string;
  kind: "pdf" | "docx";
  pageCount: number;
  scanned: boolean;
  ocrPages: number;
  needsPaidOcr: boolean;
  truncated?: boolean;
  pageCap?: number;
  ocrLang?: string;
  pages: PdfPage[];
  /** Pages still needing OCR (empty = fully saved for offline). */
  pendingOcr: number[];
  savedAt: number;
}

const DIR = (FileSystem.documentDirectory || "") + "doccache/";
const CACHE_SCHEMA_VERSION = 3;

function fileFor(docId: string): string {
  const safe = docId.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
  return `${DIR}${safe}.json`;
}

async function ensureDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  } catch {
    /* best effort */
  }
}

export const DocCache = {
  /** Load the cached parsed text for a document, or null if not saved. */
  async load(docId: string): Promise<CachedDoc | null> {
    try {
      const f = fileFor(docId);
      const info = await FileSystem.getInfoAsync(f);
      if (!info.exists) return null;
      const raw = await FileSystem.readAsStringAsync(f);
      const data = JSON.parse(raw) as CachedDoc;
      if (data?.cacheVersion !== CACHE_SCHEMA_VERSION) {
        FileSystem.deleteAsync(f, { idempotent: true }).catch(() => {});
        return null;
      }
      return data && Array.isArray(data.pages) ? data : null;
    } catch {
      return null;
    }
  },

  /** Save (or overwrite) the parsed text for a freshly parsed document. */
  async save(doc: ParsedPdf): Promise<void> {
    try {
      await ensureDir();
      const c: CachedDoc = {
        cacheVersion: CACHE_SCHEMA_VERSION,
        docId: doc.docId,
        fileName: doc.fileName,
        kind: doc.kind,
        pageCount: doc.pageCount,
        scanned: doc.scanned,
        ocrPages: doc.ocrPages,
        needsPaidOcr: Boolean(doc.needsPaidOcr),
        truncated: Boolean(doc.truncated),
        pageCap: doc.pageCap,
        ocrLang: doc.ocrLang,
        pages: doc.pages,
        pendingOcr: doc.pendingOcr ?? [],
        savedAt: Date.now(),
      };
      await FileSystem.writeAsStringAsync(fileFor(doc.docId), JSON.stringify(c));
    } catch {
      /* best effort — caching is an optimisation, never block reading */
    }
  },

  /** Update the cached pages as on-demand OCR fills scanned pages in. */
  async update(docId: string, pages: PdfPage[], pendingOcr: number[]): Promise<void> {
    try {
      const c = await this.load(docId);
      if (!c) return;
      c.pages = pages;
      c.pendingOcr = pendingOcr;
      c.ocrPages = pages.filter((p) => p.source === "ocr").length;
      c.savedAt = Date.now();
      await FileSystem.writeAsStringAsync(fileFor(docId), JSON.stringify(c));
    } catch {
      /* best effort */
    }
  },

  /** Delete a document's cached text (used when removing it from the Library). */
  async remove(docId: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(fileFor(docId), { idempotent: true });
    } catch {
      /* ignore */
    }
  },

  /** True when every page has text (nothing pending) — safe to read offline. */
  isComplete(c: CachedDoc): boolean {
    return (c.pendingOcr?.length ?? 0) === 0;
  },

  /** Rebuild a ParsedPdf from cache (no docToken: OCR can't continue offline). */
  toParsed(c: CachedDoc): ParsedPdf {
    return {
      pageCount: c.pageCount,
      pages: c.pages,
      scanned: c.scanned,
      fileName: c.fileName,
      kind: c.kind,
      ocrPages: c.ocrPages,
      docId: c.docId,
      ocrLang: c.ocrLang,
      pendingOcr: c.pendingOcr ?? [],
      needsPaidOcr: c.needsPaidOcr,
      truncated: Boolean(c.truncated),
      pageCap: c.pageCap,
    };
  },

  /** True when cached OCR/native extraction was created for the active book language. */
  isForLanguage(c: CachedDoc, ocrLang?: string): boolean {
    return (c.ocrLang || "eng") === (ocrLang || "eng");
  },

  /**
   * Merge any OCR'd text we already cached into a freshly re-parsed document,
   * so reopening online (which mints a new docToken) doesn't lose pages we
   * already recovered — and the pending list shrinks accordingly.
   */
  mergeCachedOcr(fresh: ParsedPdf, cached: CachedDoc): ParsedPdf {
    if (!this.isForLanguage(cached, fresh.ocrLang)) return fresh;
    const map = new Map<number, PdfPage>(fresh.pages.map((p) => [p.page, { ...p }] as const));
    for (const cp of cached.pages) {
      if (cp.source !== "ocr" || !cp.text) continue;
      const f = map.get(cp.page);
      if (!f || cp.text.length > (f.text?.length ?? 0)) {
        map.set(cp.page, {
          page: cp.page,
          text: cp.text,
          source: "ocr",
          confidence: cp.confidence,
        });
      }
    }
    const pages = Array.from(map.values()).sort((a, b) => a.page - b.page);
    const alreadyOcr = new Set(
      cached.pages.filter((p) => p.source === "ocr" && p.text).map((p) => p.page)
    );
    const pendingOcr = (fresh.pendingOcr ?? []).filter((p) => !alreadyOcr.has(p));
    return { ...fresh, pages, pendingOcr };
  },
};
