/**
 * OCR fallback for scanned / image-only PDF pages.
 *
 * Strategy:
 *   1. Native text extraction (pdfExtract) runs first and is preferred.
 *   2. Only pages whose native text is empty or low-quality are OCR'd here.
 *   3. Pages are rendered to images with pdfjs-dist + @napi-rs/canvas (both
 *      ship prebuilt binaries — no system packages like Ghostscript needed),
 *      cleaned up with sharp (grayscale + contrast + sharpen) for accuracy,
 *      then recognized with tesseract.js (pure WASM).
 *   4. Results are cached on disk by document hash so re-uploading the same
 *      scan is instant (the "saved OCR version" — see ocrCache.ts).
 *
 * All heavy dependencies are lazy-loaded so the server still boots and normal
 * (text) PDFs keep working even if the OCR stack isn't installed.
 */
import { ocrCacheGet, ocrCacheSet, hashBuffer } from "./ocrCache";

const OCR_ENABLED = (process.env.OCR_ENABLED ?? "true").toLowerCase() !== "false";
const OCR_LANG = process.env.OCR_LANG || "eng";
const OCR_MAX_PAGES = Number(process.env.OCR_MAX_PAGES || 50); // cap work per upload
const OCR_SCALE = Number(process.env.OCR_SCALE || 2.5); // render scale → OCR accuracy
const OCR_DPI = Number(process.env.OCR_DPI || 300); // hint Tesseract for sizing
const OCR_PREPROCESS = (process.env.OCR_PREPROCESS ?? "true").toLowerCase() !== "false";

export interface OcrPageResult {
  text: string;
  confidence: number; // 0–100
}

/**
 * Languages we allow for OCR. The value passed to Tesseract is used to fetch a
 * `<lang>.traineddata` file, so we ONLY accept codes from this fixed list — an
 * attacker must never be able to make the server download an arbitrary path.
 * Codes are official Tesseract language identifiers.
 */
export const SUPPORTED_OCR_LANGS = new Set<string>([
  "eng", // English
  "deu", // German
  "fra", // French
  "spa", // Spanish
  "ita", // Italian
  "por", // Portuguese (Portugal + Brazil share one pack)
  "nld", // Dutch
  "swe", // Swedish
  "nor", // Norwegian
  "dan", // Danish
  "fin", // Finnish
  "tur", // Turkish
  "ind", // Indonesian
  "vie", // Vietnamese
  "jpn", // Japanese
  "kor", // Korean
  "chi_sim", // Chinese (Simplified)
  "hin", // Hindi
  "rus", // Russian
  "ara", // Arabic
  "fas", // Persian
  "tha", // Thai
]);

/** Validate/normalize a requested OCR language, falling back to the default. */
export function resolveOcrLang(requested?: string): string {
  const lang = (requested || "").trim().toLowerCase();
  if (lang && SUPPORTED_OCR_LANGS.has(lang)) return lang;
  return SUPPORTED_OCR_LANGS.has(OCR_LANG) ? OCR_LANG : "eng";
}

/** Decide whether a page's native text is too poor to read and needs OCR. */
export function needsOcr(text: string, lang?: string): boolean {
  const t = (text || "").trim();
  if (t.length < 16) return true; // essentially empty → scanned image
  const ocrLang = resolveOcrLang(lang);
  if (looksCorrupted(t, ocrLang)) return true;

  const profile = scriptProfile(ocrLang);
  if (profile) {
    const scriptChars = (t.match(profile.re) || []).length;
    if (scriptChars >= profile.minChars) return false;
    const latinChars = (t.match(/[A-Za-z\u00C0-\u024F]/g) || []).length;
    if ((scriptChars + latinChars) / t.length > 0.45 && t.length >= 80) return false;
    const ratio = scriptChars / t.length;
    if (ratio < profile.minRatio) return true;
    return false;
  }

  const letters = (t.match(/[A-Za-z\u00C0-\u024F]/g) || []).length;
  const ratio = letters / t.length;
  // Mostly symbols/gibberish on a short page → likely a bad extraction.
  return ratio < 0.35 && t.length < 200;
}

function looksCorrupted(text: string, lang: string): boolean {
  const replacement = (text.match(/\uFFFD/g) || []).length;
  const mojibake = (text.match(/[ÂÃÄÅÆØÙÛÜÝÞÐ]/g) || []).length;
  const nonLatin = /[^\u0000-\u024F\s\d.,;:!?'"()[\]{}\-–—/\\]/.test(text);
  const repeatedA = nonLatin ? (text.match(/A{2,}/g) || []).length : 0;
  const hasArabicScript = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
  if ((lang === "ara" || lang === "fas") && hasArabicScript) {
    if (repeatedA > 0) return true;
  }
  const bad = replacement + mojibake + repeatedA * 2;
  return bad / Math.max(1, text.length) > 0.018;
}

function scriptProfile(lang: string): { re: RegExp; minRatio: number; minChars: number } | null {
  switch (lang) {
    case "ara":
    case "fas":
      return { re: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g, minRatio: 0.45, minChars: 12 };
    case "rus":
      return { re: /[\u0400-\u04FF]/g, minRatio: 0.45, minChars: 12 };
    case "hin":
      return { re: /[\u0900-\u097F]/g, minRatio: 0.45, minChars: 12 };
    case "jpn":
      return { re: /[\u3040-\u30FF\u4E00-\u9FFF]/g, minRatio: 0.35, minChars: 12 };
    case "kor":
      return { re: /[\uAC00-\uD7AF\u1100-\u11FF]/g, minRatio: 0.45, minChars: 12 };
    case "chi_sim":
      return { re: /[\u4E00-\u9FFF]/g, minRatio: 0.35, minChars: 12 };
    default:
      return null;
  }
}

let pdfjsLib: any = null;
let canvasLib: any = null;
let sharpLib: any = null;
let ocrUnavailable = false;

// True ESM dynamic import that survives CommonJS transpilation (pdfjs v4 is
// ESM-only). Using `new Function` prevents tsc from rewriting it to require().
const esmImport: (m: string) => Promise<any> = new Function(
  "m",
  "return import(m)"
) as any;

async function loadRenderDeps(): Promise<boolean> {
  if (ocrUnavailable) return false;
  if (pdfjsLib && canvasLib) return true;
  try {
    canvasLib = require("@napi-rs/canvas");
    // pdfjs touches a few DOM globals during rendering; polyfill from canvas.
    const g = globalThis as any;
    if (!g.DOMMatrix && canvasLib.DOMMatrix) g.DOMMatrix = canvasLib.DOMMatrix;
    if (!g.Path2D && canvasLib.Path2D) g.Path2D = canvasLib.Path2D;
    if (!g.ImageData && canvasLib.ImageData) g.ImageData = canvasLib.ImageData;
    // sharp is optional: preprocessing improves accuracy but isn't required.
    if (OCR_PREPROCESS && !sharpLib) {
      try {
        sharpLib = require("sharp");
      } catch {
        sharpLib = null; // fall back to raw render
      }
    }
    // Patched, ESM-only legacy build (Node-friendly, no worker).
    pdfjsLib = await esmImport("pdfjs-dist/legacy/build/pdf.mjs");
    return true;
  } catch (err: any) {
    console.warn(
      "[ocr] render deps unavailable (pdfjs-dist / @napi-rs/canvas):",
      err?.message
    );
    ocrUnavailable = true;
    return false;
  }
}

async function renderPageToPng(pdfDoc: any, pageNumber: number): Promise<Buffer | null> {
  try {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: OCR_SCALE });
    const canvas = canvasLib.createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );
    const context = canvas.getContext("2d");
    // White background so transparent scans don't OCR as black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context as any, viewport }).promise;
    return canvas.toBuffer("image/png");
  } catch (err: any) {
    console.warn(`[ocr] failed to render page ${pageNumber}:`, err?.message);
    return null;
  }
}

/**
 * Clean an image for OCR: grayscale, stretch contrast, denoise and sharpen.
 * Tesseract is far more accurate on crisp black-on-white than on raw scans.
 */
async function preprocess(png: Buffer): Promise<Buffer> {
  if (!sharpLib) return png;
  try {
    return await sharpLib(png)
      .grayscale()
      .normalize() // stretch contrast to full range
      .median(1) // remove speckle noise
      .sharpen()
      .png()
      .toBuffer();
  } catch {
    return png; // never let preprocessing break OCR
  }
}

// ----- persistent Tesseract worker (reused across requests) -----
// ----- persistent Tesseract workers (one per language, reused across requests) -----
const workerPromises = new Map<string, Promise<any>>();

async function getWorker(lang: string): Promise<any | null> {
  const existing = workerPromises.get(lang);
  if (existing) return existing;
  let tesseract: any;
  try {
    tesseract = require("tesseract.js");
  } catch (err: any) {
    console.warn("[ocr] tesseract.js unavailable:", err?.message);
    return null;
  }
  const promise = (async () => {
    const worker = await tesseract.createWorker(lang);
    await worker.setParameters({
      preserve_interword_spaces: "1", // keep word/column spacing
      user_defined_dpi: String(OCR_DPI), // avoids "low resolution" guesses
    });
    return worker;
  })().catch((err) => {
    console.warn(`[ocr] worker init failed (${lang}):`, err?.message);
    workerPromises.delete(lang);
    return null;
  });
  workerPromises.set(lang, promise);
  return promise;
}

/** Normalize OCR text: trim line ends, collapse big gaps, keep real line breaks. */
function tidy(text: string): string {
  return (text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // collapse big gaps to a single paragraph break
    .trim();
}

/**
 * OCR the given (1-based) page numbers of a PDF buffer.
 * Returns a map of pageNumber → { text, confidence }. Pages that fail to
 * render or recognize are simply omitted (caller keeps the native text).
 *
 * Results are cached on disk by document hash + page so the same scan is only
 * ever OCR'd once.
 */
export async function ocrPdfPages(
  buffer: Buffer,
  pageNumbers: number[],
  lang?: string
): Promise<Map<number, OcrPageResult>> {
  const results = new Map<number, OcrPageResult>();
  if (!OCR_ENABLED || pageNumbers.length === 0) return results;

  const ocrLang = resolveOcrLang(lang);
  // Cache is keyed by document AND language (same scan can be OCR'd per-lang).
  const docHash = `${hashBuffer(buffer)}.${ocrLang}`;

  // 1) Serve whatever we already have cached (instant on re-upload).
  const misses: number[] = [];
  for (const pageNumber of pageNumbers) {
    const cached = ocrCacheGet(docHash, pageNumber);
    if (cached) results.set(pageNumber, cached);
    else misses.push(pageNumber);
  }
  if (misses.length === 0) return results;

  if (!(await loadRenderDeps())) return results;
  const worker = await getWorker(ocrLang);
  if (!worker) return results;

  const targets = misses.slice(0, OCR_MAX_PAGES);

  let pdfDoc: any;
  try {
    pdfDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      verbosity: 0, // keep pdfjs quiet on malformed scans
      isEvalSupported: false, // security: never eval embedded JS
    }).promise;

    for (const pageNumber of targets) {
      const raw = await renderPageToPng(pdfDoc, pageNumber);
      if (!raw) continue;
      const img = await preprocess(raw);
      try {
        const { data } = await worker.recognize(img);
        const text = tidy(data?.text || "");
        if (text) {
          const result: OcrPageResult = {
            text,
            confidence: Math.round(data?.confidence ?? 0),
          };
          results.set(pageNumber, result);
          ocrCacheSet(docHash, pageNumber, result); // persist for next time
        }
      } catch (err: any) {
        console.warn(`[ocr] recognize failed on page ${pageNumber}:`, err?.message);
      }
    }
  } catch (err: any) {
    console.warn("[ocr] OCR pass failed:", err?.message);
  } finally {
    try {
      await pdfDoc?.destroy();
    } catch {
      /* ignore */
    }
    // Worker is intentionally kept alive and reused across requests.
  }

  return results;
}

