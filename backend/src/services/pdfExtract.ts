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
  /** True when the source page paints one or more raster images. */
  hasRasterImage?: boolean;
}

export interface ExtractedDocument {
  pageCount: number;
  pages: ExtractedPage[];
}

interface PositionedTextItem {
  str: string;
  dir?: string;
  fontName?: string;
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
const RAISED_REFERENCE_START = "\uE000";
const RAISED_REFERENCE_END = "\uE001";
// Private internal markers preserve PDF heading geometry through the text-only
// API. Mobile removes them before display/copy/speech and uses them only to set
// the block kind. PUA avoids collisions with ordinary manuscript characters.
const STRUCTURAL_HEADING_START = "\uE100";
const STRUCTURAL_HEADING_END = "\uE101";

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
  const candidatePages = pages
    .map((text, index) => ({ page: index + 1, chars: text.replace(/\s/g, "").length }))
    .filter((candidate) => candidate.chars > 0 && candidate.chars <= 1600)
    .slice(0, 160)
    .map((candidate) => candidate.page);
  const rasterPages = await detectRasterImagePages(buffer, candidatePages);

  return {
    pageCount: pages.length,
    pages: pages.map((text, i) => ({
      page: i + 1,
      text: text.trim(),
      source: "native" as const,
      // Empty PDF text almost always represents a scanned/visual page. Keeping
      // the original is useful even for a genuinely blank separator page.
      hasRasterImage: !text.trim() || rasterPages.has(i + 1),
    })),
  };
}

// PDF.js operator ids 83-90 are the stable raster paint family (mask,
// XObject, inline, repeats, and solid-color image masks).
const RASTER_PAINT_OPERATORS = new Set([83, 84, 85, 86, 87, 88, 89, 90]);

export function containsRasterImageOperators(
  fnArray: unknown,
  rasterOperators: Set<number> = RASTER_PAINT_OPERATORS
): boolean {
  return Array.isArray(fnArray) && fnArray.some((operator) => rasterOperators.has(Number(operator)));
}

const importPdfJs: (moduleName: string) => Promise<any> = new Function(
  "moduleName",
  "return import(moduleName)"
) as any;

async function detectRasterImagePages(buffer: Buffer, pageNumbers: number[]): Promise<Set<number>> {
  const found = new Set<number>();
  if (!pageNumbers.length) return found;

  let pdf: any = null;
  try {
    const canvas = require("@napi-rs/canvas");
    const globals = globalThis as any;
    if (!globals.DOMMatrix && canvas.DOMMatrix) globals.DOMMatrix = canvas.DOMMatrix;
    if (!globals.Path2D && canvas.Path2D) globals.Path2D = canvas.Path2D;
    if (!globals.ImageData && canvas.ImageData) globals.ImageData = canvas.ImageData;
    const pdfjs = await importPdfJs("pdfjs-dist/legacy/build/pdf.mjs");
    const operators = new Set<number>(
      [
        pdfjs.OPS?.paintImageMaskXObject,
        pdfjs.OPS?.paintImageMaskXObjectGroup,
        pdfjs.OPS?.paintImageXObject,
        pdfjs.OPS?.paintInlineImageXObject,
        pdfjs.OPS?.paintInlineImageXObjectGroup,
        pdfjs.OPS?.paintImageXObjectRepeat,
        pdfjs.OPS?.paintImageMaskXObjectRepeat,
        pdfjs.OPS?.paintSolidColorImageMask,
      ].filter((value): value is number => Number.isFinite(value))
    );
    pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
    for (const pageNumber of pageNumbers) {
      const page = await pdf.getPage(pageNumber);
      const list = await page.getOperatorList();
      if (containsRasterImageOperators(list?.fnArray, operators)) found.add(pageNumber);
      page.cleanup();
    }
  } catch (error: any) {
    console.warn("[pdf] visual page detection unavailable:", error?.message);
  } finally {
    try {
      await pdf?.destroy?.();
    } catch {
      // Best-effort cleanup; text extraction remains authoritative.
    }
  }
  return found;
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
  const paragraphGap = paragraphGapThreshold(lines);
  const typography = dominantPageTypography(lines);
  const ordinaryGap = ordinaryLineGap(lines, typography.bodyHeight);
  let out = "";
  let previous: TextLine | null = null;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const rendered = renderLine(line);
    if (!rendered) continue;
    if (out) {
      const gap = previous ? previous.y - line.y : 0;
      out += gap > paragraphGap ? "\n\n" : "\n";
    }
    out += isGeometricHeading(line, rendered, typography, {
      before: lineIndex > 0 ? lines[lineIndex - 1].y - line.y : 0,
      after: lineIndex + 1 < lines.length ? line.y - lines[lineIndex + 1].y : 0,
      ordinary: ordinaryGap,
    })
      ? `${STRUCTURAL_HEADING_START}${rendered}${STRUCTURAL_HEADING_END}`
      : rendered;
    previous = line;
  }
  return out;
}

/** Preserve the larger baseline gap that visually separates PDF paragraphs. */
function paragraphGapThreshold(lines: TextLine[]): number {
  if (lines.length < 2) return Number.POSITIVE_INFINITY;
  const gaps = lines
    .slice(1)
    .map((line, index) => lines[index].y - line.y)
    .filter((gap) => Number.isFinite(gap) && gap > 0)
    .sort((a, b) => a - b);
  if (!gaps.length) return Number.POSITIVE_INFINITY;

  // The lower quartile represents ordinary line leading even on a page with
  // several paragraph, heading, or footer gaps.
  const ordinaryGap = gaps[Math.floor((gaps.length - 1) * 0.25)];
  const heights = lines
    .flatMap((line) => line.items.map((item) => item.height))
    .filter((height) => Number.isFinite(height) && height > 0)
    .sort((a, b) => a - b);
  const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 0;
  return Math.max(ordinaryGap * 1.35, medianHeight * 1.55, ordinaryGap + 2);
}

/** Estimate normal baseline leading without allowing a sparse page to inflate it. */
function ordinaryLineGap(lines: TextLine[], bodyHeight: number): number {
  const gaps = lines
    .slice(1)
    .map((line, index) => lines[index].y - line.y)
    .filter((gap) => Number.isFinite(gap) && gap > 0)
    .sort((a, b) => a - b);
  if (!gaps.length) return bodyHeight > 0 ? bodyHeight * 1.5 : 0;
  const lowerQuartile = gaps[Math.floor((gaps.length - 1) * 0.25)];
  return bodyHeight > 0 ? Math.min(lowerQuartile, bodyHeight * 1.65) : lowerQuartile;
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
    fontName: typeof item.fontName === "string" ? item.fontName : undefined,
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
  for (let index = 0; index < sorted.length; index++) {
    const item = sorted[index];
    const renderedItem = raisedReferenceDigits(sorted, index, rtl);
    const itemText = renderedItem
      ? `${RAISED_REFERENCE_START}${renderedItem}${RAISED_REFERENCE_END}`
      : item.str;
    if (!out) {
      out = itemText;
    } else {
      if (previous && shouldInsertSpace(previous, item, rtl)) out += " ";
      out += itemText;
    }
    previous = item;
  }
  return restoreRaisedReferences(cleanExtractedLine(out, rtl));
}

interface PageTypography {
  bodyHeight: number;
  bodyFontName?: string;
}

/** Infer body typography from the character-weighted majority on this page. */
function dominantPageTypography(lines: TextLine[]): PageTypography {
  const items = lines
    .flatMap((line) => line.items)
    .filter((item) => item.height > 0 && /[\p{L}\p{N}]/u.test(item.str));
  if (!items.length) return { bodyHeight: 0 };

  const heightWeights = new Map<number, number>();
  const fontWeights = new Map<string, number>();
  for (const item of items) {
    const weight = Math.max(1, item.str.replace(/\s/g, "").length);
    // PDF transforms contain tiny floating-point differences for one font size.
    const heightKey = Math.round(item.height * 20) / 20;
    heightWeights.set(heightKey, (heightWeights.get(heightKey) || 0) + weight);
    if (item.fontName) {
      fontWeights.set(item.fontName, (fontWeights.get(item.fontName) || 0) + weight);
    }
  }

  return {
    bodyHeight: greatestWeightKey(heightWeights) || 0,
    bodyFontName: greatestWeightKey(fontWeights) || undefined,
  };
}

function greatestWeightKey<T>(weights: Map<T, number>): T | undefined {
  let best: T | undefined;
  let bestWeight = -1;
  for (const [key, weight] of weights) {
    if (weight > bestWeight) {
      best = key;
      bestWeight = weight;
    }
  }
  return best;
}

/**
 * Detect display headings from PDF typography instead of English capitalization
 * or punctuation. All three independent layout signals are required: a larger
 * size, a uniform dedicated font, and vertical separation from surrounding
 * prose. Requiring the combination prevents an italic sentence or an inline
 * bold span from becoming a heading merely because its font differs.
 */
function isGeometricHeading(
  line: TextLine,
  rendered: string,
  typography: PageTypography,
  separation: { before: number; after: number; ordinary: number }
): boolean {
  const value = rendered.trim();
  if (!value || value.length > 180 || !/\p{L}/u.test(value)) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 20 || !typography.bodyHeight) return false;

  const visibleItems = line.items.filter((item) => item.height > 0 && item.str.trim());
  if (!visibleItems.length) return false;
  const lineHeight = greatestWeightKey(
    visibleItems.reduce((weights, item) => {
      const key = Math.round(item.height * 20) / 20;
      weights.set(key, (weights.get(key) || 0) + Math.max(1, item.str.replace(/\s/g, "").length));
      return weights;
    }, new Map<number, number>())
  ) || 0;

  const fontWeights = new Map<string, number>();
  let totalFontWeight = 0;
  for (const item of visibleItems) {
    if (!item.fontName) continue;
    const weight = Math.max(1, item.str.replace(/\s/g, "").length);
    fontWeights.set(item.fontName, (fontWeights.get(item.fontName) || 0) + weight);
    totalFontWeight += weight;
  }
  const lineFont = greatestWeightKey(fontWeights);
  const lineFontWeight = lineFont ? fontWeights.get(lineFont) || 0 : 0;
  const uniformlyStyled = totalFontWeight === 0 || lineFontWeight / totalFontWeight >= 0.8;
  const largerThanBody = lineHeight >= typography.bodyHeight * 1.11;
  const hasDedicatedFont = Boolean(
    lineFont && typography.bodyFontName && lineFont !== typography.bodyFontName
  );
  // When a PDF omits font names, a substantially larger size still provides a
  // usable structural signal. With font metadata, require a dedicated font.
  const fontSupportsHeading = hasDedicatedFont ||
    (!lineFont && lineHeight >= typography.bodyHeight * 1.25);
  const separationThreshold = Math.max(
    separation.ordinary * 1.25,
    typography.bodyHeight * 1.8
  );
  const verticallySeparated = Math.max(separation.before, separation.after) >= separationThreshold;
  return largerThanBody && uniformlyStyled && fontSupportsHeading && verticallySeparated;
}

/**
 * PDF text layers usually retain the smaller font and raised baseline of a
 * citation even when they flatten its characters into the surrounding prose.
 * Preserve that geometry as Unicode superscript digits before mobile reflow.
 * This distinguishes `2024.¹¹` from a real decimal such as `2024.11` without
 * guessing from punctuation alone.
 */
function raisedReferenceDigits(
  sorted: PositionedTextItem[],
  index: number,
  rtl: boolean
): string | null {
  const item = sorted[index];
  const digits = item.str.trim();
  if (!/^\d{1,3}$/.test(digits) || sorted.length < 2 || item.height <= 0) return null;

  const heights = sorted
    .map((candidate) => candidate.height)
    .filter((height) => Number.isFinite(height) && height > 0)
    .sort((a, b) => a - b);
  const dominantHeight = heights[Math.floor(heights.length / 2)] || 0;
  if (!dominantHeight || item.height > dominantHeight * 0.72) return null;

  const bodyItems = sorted.filter((candidate) => candidate.height >= dominantHeight * 0.82);
  if (!bodyItems.length) return null;
  const bodyBaselines = bodyItems.map((candidate) => candidate.y).sort((a, b) => a - b);
  const bodyBaseline = bodyBaselines[Math.floor(bodyBaselines.length / 2)];
  const rise = item.y - bodyBaseline;
  if (rise < Math.max(0.5, dominantHeight * 0.08) || rise > dominantHeight * 0.65) return null;

  const previous = sorted[index - 1];
  if (!previous) return null;
  const gap = rtl
    ? previous.x - (item.x + item.width)
    : item.x - (previous.x + previous.width);
  const adjacentLimit = Math.max(4, dominantHeight * 0.6);
  if (!Number.isFinite(gap) || gap < -1 || gap > adjacentLimit) return null;
  return digits;
}

function restoreRaisedReferences(value: string): string {
  const re = new RegExp(`${RAISED_REFERENCE_START}(\\d{1,3})${RAISED_REFERENCE_END}`, "g");
  return value.replace(re, (_match, digits: string) =>
    digits
      .split("")
      .map((digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(digit)] || digit)
      .join("")
  );
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
