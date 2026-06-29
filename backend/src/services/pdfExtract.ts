// pdf-parse ships no types; require the lib entry directly to avoid its debug harness.
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

/** How a page's text was obtained. */
export type TextSource = "native" | "ocr";

export interface ExtractedPage {
  page: number;
  text: string;
  /** Where the text came from. Native = PDF text layer; OCR = recognized from image. */
  source: TextSource;
  /** OCR confidence 0–100 (only present for OCR pages). */
  confidence?: number;
}

export interface ExtractedDocument {
  pageCount: number;
  pages: ExtractedPage[];
}

interface PositionedTextItem {
  str: string;
  dir?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}

interface TextLine {
  y: number;
  items: PositionedTextItem[];
}

const RTL_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const RTL_CHAR_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const RTL_WORD_RUN = "\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF";
const CJK_CHAR_RE = /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;
const NO_SPACE_BEFORE_RE = /^[,.;:!?،؛؟)\]}”’"»٪%]/;
const NO_SPACE_AFTER_RE = /[(\[{“‘"«]$/;

/**
 * Extracts text per page from a clean (text-based) PDF buffer.
 * Image-only/scanned pages return little/no text; the route then falls back to
 * OCR for those pages (see services/ocrExtract.ts).
 */
export async function extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
  const pages: string[] = [];

  function renderPage(pageData: any): Promise<string> {
    const options = { normalizeWhitespace: false, disableCombineTextItems: false };
    return pageData.getTextContent(options).then((content: any) => {
      const text = renderPdfTextItems(content.items || []);
      pages.push(text);
      return text;
    });
  }

  await pdfParse(buffer, { pagerender: renderPage });

  return {
    pageCount: pages.length,
    pages: pages.map((text, i) => ({ page: i + 1, text: text.trim(), source: "native" as const })),
  };
}

/**
 * Rebuild readable page text from positioned PDF text items.
 *
 * PDF text streams are not guaranteed to arrive in reading order. This is very
 * visible in Persian/Arabic books: the text layer can contain correct words but
 * left/right chunks arrive in a visually scrambled order. We group by rendered
 * line and sort by X position; RTL lines are sorted right-to-left.
 */
export function renderPdfTextItems(rawItems: any[]): string {
  const items = rawItems.map(toPositionedItem).filter(Boolean) as PositionedTextItem[];
  if (items.length === 0) return "";

  const lines = groupIntoLines(items);
  return lines.map(renderLine).filter(Boolean).join("\n");
}

function toPositionedItem(item: any, index: number): PositionedTextItem | null {
  const str = typeof item?.str === "string" ? item.str : "";
  if (!str) return null;
  const transform = Array.isArray(item.transform) ? item.transform : [];
  const x = Number(transform[4]);
  const y = Number(transform[5]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const width = Math.abs(Number(item.width || 0));
  const height = Math.abs(Number(item.height || transform[3] || transform[0] || 0));
  return {
    str,
    dir: typeof item.dir === "string" ? item.dir : undefined,
    x,
    y,
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
    index,
  };
}

function groupIntoLines(items: PositionedTextItem[]): TextLine[] {
  const tolerance = lineTolerance(items);
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x || a.index - b.index);
  const lines: TextLine[] = [];

  for (const item of sorted) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (line) {
      line.items.push(item);
      line.y = (line.y * (line.items.length - 1) + item.y) / line.items.length;
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  return lines.sort((a, b) => b.y - a.y);
}

function lineTolerance(items: PositionedTextItem[]): number {
  const heights = items.map((item) => item.height).filter((n) => n > 0).sort((a, b) => a - b);
  const median = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
  return Math.max(1.5, Math.min(4, median * 0.35 || 2.5));
}

function renderLine(line: TextLine): string {
  const rtl = isRtlLine(line);
  const sorted = [...line.items].sort((a, b) => {
    const primary = rtl ? b.x - a.x : a.x - b.x;
    return primary || a.index - b.index;
  });

  let out = "";
  let previous: PositionedTextItem | null = null;
  for (const item of sorted) {
    if (!out) {
      out = item.str;
    } else {
      if (previous && shouldInsertSpace(previous, item, rtl)) out += " ";
      out += item.str;
    }
    previous = item;
  }
  return cleanExtractedLine(out, rtl);
}

function cleanExtractedLine(line: string, rtl: boolean): string {
  let out = line
    .normalize("NFKC")
    // Some old Distiller Persian PDFs emit U+0467 where the visual PDF only
    // has glyph shaping/spacing. Android renders it as odd A-like noise.
    .replace(/[\u0466\u0467]/g, "")
    .replace(/\(cid:\d+\)/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (rtl) {
    out = out
      .replace(/\u06BE/g, "ه")
      .replace(new RegExp(`([${RTL_WORD_RUN}]{3,})\\1`, "g"), "$1");
  }
  return out;
}

function isRtlLine(line: TextLine): boolean {
  const text = line.items.map((item) => item.str).join("");
  const rtlChars = (text.match(RTL_SCRIPT_RE) || []).length;
  if (rtlChars === 0) return false;
  const nonSpace = text.replace(/\s/g, "").length || 1;
  const rtlItems = line.items.filter((item) => item.dir === "rtl" || RTL_CHAR_RE.test(item.str)).length;
  return rtlItems >= line.items.length / 2 || rtlChars / nonSpace > 0.25;
}

function shouldInsertSpace(
  previous: PositionedTextItem,
  next: PositionedTextItem,
  rtl: boolean
): boolean {
  if (/\s$/.test(previous.str) || /^\s/.test(next.str)) return false;
  if (NO_SPACE_BEFORE_RE.test(next.str) || NO_SPACE_AFTER_RE.test(previous.str)) return false;
  if (CJK_CHAR_RE.test(previous.str.slice(-1)) && CJK_CHAR_RE.test(next.str.charAt(0))) {
    return false;
  }

  const gap = rtl
    ? previous.x - (next.x + next.width)
    : next.x - (previous.x + previous.width);
  if (!Number.isFinite(gap) || gap <= 0) return false;

  const avgCharWidth = averageCharWidth(previous, next);
  const threshold = Math.max(1.5, Math.min(4, avgCharWidth * 0.35 || 2.5));
  return gap > threshold;
}

function averageCharWidth(a: PositionedTextItem, b: PositionedTextItem): number {
  const aw = a.width > 0 ? a.width / Math.max(1, a.str.trim().length) : 0;
  const bw = b.width > 0 ? b.width / Math.max(1, b.str.trim().length) : 0;
  const values = [aw, bw].filter((n) => Number.isFinite(n) && n > 0);
  return values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0;
}
