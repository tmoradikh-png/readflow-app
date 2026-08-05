import type { PdfPage } from "./PDFParser";

export interface Sentence {
  id: number;
  page: number;
  /** Stable position inside the page; unlike id, this survives earlier-page OCR updates. */
  pageSentenceIndex: number;
  /** Paragraph boundary retained from the source page for natural TTS batching. */
  paragraphIndex: number;
  /** Stable FlatList key while text on other pages is inserted or rebuilt. */
  key: string;
  text: string;
  kind: "body" | "heading";
}

interface TextUnit {
  text: string;
  kind: Sentence["kind"];
  paragraphIndex: number;
}

export interface ReflowChunk {
  /** 1-based index of the first page in this chunk. */
  startPage: number;
  /** 1-based index of the last page in this chunk. */
  endPage: number;
  sentences: Sentence[];
}

export interface ReferenceMarker {
  start: number;
  end: number;
  text: string;
}

export interface SpeechTextMap {
  text: string;
  /** Source character offset for each character retained in `text`. */
  sourceOffsets: number[];
}

// The backend wraps typography-detected PDF headings in private internal
// markers. They are stripped before any user-visible or spoken text leaves this
// module; only the structural `kind` survives.
const STRUCTURAL_HEADING_START = "\uE100";
const STRUCTURAL_HEADING_END = "\uE101";

/**
 * TextReflow — turns raw page text into clean reading units. Native PDF body
 * paragraphs remain whole so the Reader lays them out like a book; OCR lines
 * remain separate because scanned figures and lists depend on line structure.
 *
 * It also groups pages into chunks (default 10) so we "read 10 pages at a time".
 */
export const TextReflow = {
  PAGES_PER_CHUNK: 10,

  /** Normalize whitespace and join hard-wrapped lines into flowing paragraphs. */
  cleanPageText(raw: string, pageNumber?: number, skipLines?: Set<string>): string {
    return cleanCorruptScriptArtifacts(stripNonReadingLines(raw, pageNumber, skipLines))
      .replace(/\r/g, "")
      // de-hyphenate words split across line breaks: "exam-\nple" -> "example"
      .replace(/(\w)-\n(\w)/g, "$1$2")
      // single newlines inside a paragraph -> space
      .replace(/([^\n])\n([^\n])/g, "$1 $2")
      // collapse repeated spaces
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  },

  /**
   * Clean OCR text WITHOUT collapsing line breaks. Scanned figures, lists and
   * flowcharts rely on their line structure, so each line stays its own unit
   * instead of being flowed into one paragraph (which previously ran every
   * step together).
   */
  cleanOcrText(raw: string, pageNumber?: number, skipLines?: Set<string>): string {
    return repairLatinOcrWordBreaks(
      cleanCorruptScriptArtifacts(stripNonReadingLines(raw, pageNumber, skipLines))
    )
      .replace(/\r/g, "")
      // de-hyphenate words split across line breaks: "exam-\nple" -> "example"
      .replace(/(\w)-\n(\w)/g, "$1$2")
      // collapse repeated spaces/tabs but keep newlines
      .replace(/[ \t]{2,}/g, " ")
      // trim each line
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      // collapse 3+ blank lines to a single paragraph break
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  },

  /**
   * Produce sentence-level units for a single page, respecting its source.
   * Native pages flow wrapped lines into paragraphs; OCR pages keep each line
   * as its own unit so list/figure structure (and page enters) survive.
   */
  unitsForPage(p: PdfPage, skipLines?: Set<string>): TextUnit[] {
    if (p.source === "ocr") {
      const clean = this.cleanOcrText(p.text, p.page, skipLines);
      const units: TextUnit[] = [];
      const lines = clean.split("\n");
      let paragraphIndex = 0;
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const trimmed = line.trim();
        if (!trimmed) continue;
        const previousText = nearestNonBlankLine(lines, index, -1);
        const nextText = nearestNonBlankLine(lines, index, 1);
        const heading = isHeadingLine(trimmed, {
          isolated:
            index === 0 ||
            index === lines.length - 1 ||
            !lines[index - 1].trim() ||
            !lines[index + 1].trim(),
          followsChapterMarker: Boolean(previousText && isChapterMarker(previousText)),
          previousText,
          nextText,
        });
        for (const text of this.splitSentences(trimmed)) {
          const kind = heading ? "heading" : "body";
          units.push({
            text: canonicalizeLegacyReferenceMarkers(text, kind),
            kind,
            paragraphIndex,
          });
        }
        paragraphIndex++;
      }
      return units;
    }
    return nativeStructuredUnits(p.text, p.page, skipLines);
  },

  splitSentences(text: string): string[] {
    if (!text) return [];
    // Split after . ! ? (incl. common closing quotes) followed by a space.
    const parts = text
      .replace(/([.!?。！？؟]["”’)]?)\s+/g, "$1\u0001")
      .split("\u0001")
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : [text.trim()];
  },

  /**
   * Flatten every page into one continuous list of sentences with stable
   * global ids (id === array index). This is the backbone of the sliding
   * reading window: rendering slices this list by page range while playback
   * sequences by global index.
   */
  buildSentences(pages: PdfPage[]): Sentence[] {
    const out: Sentence[] = [];
    const skipLines = buildRepeatedSkipLines(pages);
    let id = 0;
    for (const p of pages) {
      let pageSentenceIndex = 0;
      for (const unit of this.unitsForPage(p, skipLines)) {
        out.push({
          id: id++,
          page: p.page,
          pageSentenceIndex,
          paragraphIndex: unit.paragraphIndex,
          key: `${p.page}:${pageSentenceIndex}`,
          text: unit.text,
          kind: unit.kind,
        });
        pageSentenceIndex++;
      }
    }
    return out;
  },

  /** Global index of the first sentence on a given 1-based page (or -1). */
  firstIndexOfPage(sentences: Sentence[], page: number): number {
    return sentences.findIndex((s) => s.page === page);
  },

  buildChunks(pages: PdfPage[]): ReflowChunk[] {
    const chunks: ReflowChunk[] = [];
    const skipLines = buildRepeatedSkipLines(pages);
    let sentenceId = 0;

    for (let i = 0; i < pages.length; i += this.PAGES_PER_CHUNK) {
      const slice = pages.slice(i, i + this.PAGES_PER_CHUNK);
      const sentences: Sentence[] = [];

      for (const p of slice) {
        let pageSentenceIndex = 0;
        for (const unit of this.unitsForPage(p, skipLines)) {
          sentences.push({
            id: sentenceId++,
            page: p.page,
            pageSentenceIndex,
            paragraphIndex: unit.paragraphIndex,
            key: `${p.page}:${pageSentenceIndex}`,
            text: unit.text,
            kind: unit.kind,
          });
          pageSentenceIndex++;
        }
      }

      chunks.push({
        startPage: slice[0]?.page ?? i + 1,
        endPage: slice[slice.length - 1]?.page ?? i + slice.length,
        sentences,
      });
    }

    return chunks;
  },

  /** Plain text of a chunk — used as the AI context for that 10-page section. */
  chunkText(chunk: ReflowChunk): string {
    return chunk.sentences.map((s) => s.text).join(" ");
  },

  /**
   * Split a sentence into word tokens, each with the character offset where it
   * begins inside the sentence. Used for tap-to-read: tapping a word starts the
   * voice from that word's offset.
   */
  tokenizeWords(text: string): { word: string; offset: number }[] {
    const tokens: { word: string; offset: number }[] = [];
    const re = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      tokens.push({ word: match[0], offset: match.index });
    }
    return tokens;
  },

  /** Inline citation/footnote markers that should be shown as superscripts and not spoken. */
  referenceMarkers(text: string, kind: Sentence["kind"] = "body"): ReferenceMarker[] {
    return findReferenceMarkers(text, kind);
  },

  /**
   * Prepare text for every voice engine while retaining a map back to the
   * displayed sentence. This keeps line highlighting aligned after silent
   * citation markers are removed.
   */
  speechText(
    text: string,
    kind: Sentence["kind"] = "body",
    sourceStart = 0,
    sourceEnd = text.length
  ): SpeechTextMap {
    const markers = findReferenceMarkers(text, kind);
    const sourceOffsets: number[] = [];
    let output = "";
    let markerIndex = markers.findIndex((marker) => marker.end > sourceStart);
    if (markerIndex < 0) markerIndex = markers.length;

    const boundedEnd = Math.max(sourceStart, Math.min(text.length, sourceEnd));
    for (let index = Math.max(0, sourceStart); index < boundedEnd; index++) {
      const marker = markers[markerIndex];
      if (marker && index >= marker.start && index < marker.end) {
        index = marker.end - 1;
        markerIndex++;
        continue;
      }

      const char = text[index];
      if (/\s/.test(char)) {
        if (!output || output.endsWith(" ")) continue;
        output += " ";
        sourceOffsets.push(index);
        continue;
      }

      output += char;
      sourceOffsets.push(index);
    }

    if (output.endsWith(" ")) {
      output = output.slice(0, -1);
      sourceOffsets.pop();
    }
    return { text: output, sourceOffsets };
  },

  /** True when adjacent visual rows are one sentence split by a PDF page turn. */
  continuesAcrossPage(previous: Sentence, next: Sentence): boolean {
    if (!previous || !next) return false;
    if (previous.kind !== "body" || next.kind !== "body") return false;
    if (next.page !== previous.page + 1 || next.pageSentenceIndex !== 0) return false;

    const previousText = previous.text.trim().replace(/["'”’)}\]]+$/g, "");
    if (!previousText || /[.!?。！？؟…:;؛]$/.test(previousText)) return false;

    const nextText = next.text.trim();
    if (!nextText) return false;
    if (/^(?:[-*•·]|\d{1,3}[.)]|[A-Za-z][.)])\s+/.test(nextText)) return false;
    return true;
  },

  /** Find the chunk index that contains a given 1-based page number. */
  chunkIndexForPage(chunks: ReflowChunk[], page: number): number {
    for (let i = 0; i < chunks.length; i++) {
      if (page >= chunks[i].startPage && page <= chunks[i].endPage) return i;
    }
    return -1;
  },
};

const SUPERSCRIPT_REFERENCE_RE = /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g;
const BRACKETED_REFERENCE_RE = /\[(?:\d{1,3})(?:\s*[,;\-–—]\s*\d{1,3})*\]/g;
// Legacy cached extracts predate geometry-aware superscript preservation. A
// year followed by a period, 1-3 citation digits, and the capitalized start of
// the next sentence is a citation (`2024.11 This`), not a decimal. New backend
// extracts carry those digits as real Unicode superscripts and do not need this
// fallback.
const YEAR_REFERENCE_RE = /\b(?:1[5-9]\d{2}|20\d{2}|21\d{2})\.(\d{1,3})(?=\s+["'“‘([]?[A-Z\u00c0-\u00de])/g;
// PDF text layers can flatten several adjacent superscript citations into one
// run: [1][10][13] becomes `.11013`. Keep the punctuation but silence and
// superscript the complete digit run. Colons are deliberately excluded because
// the digits are semantic in verses, times, ratios, schedules, and scores such
// as `John 3:16`, `12:30`, and `4:2`.
const PUNCTUATION_REFERENCE_RE = /[.!?;](\d{1,12})(?=\s|$)/g;
const ATTACHED_REFERENCE_RE = /[a-z\u00c0-\u024f]{4,}(\d{1,2})(?=\s|[,.;:!?)]|$)/g;
const SUPERSCRIPT_DIGIT_MAP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

function findReferenceMarkers(text: string, kind: Sentence["kind"]): ReferenceMarker[] {
  if (!text) return [];
  const ranges: ReferenceMarker[] = [];
  const add = (start: number, end: number) => {
    if (start < 0 || end <= start || ranges.some((range) => start < range.end && end > range.start)) {
      return;
    }
    ranges.push({ start, end, text: text.slice(start, end) });
  };

  for (const match of text.matchAll(SUPERSCRIPT_REFERENCE_RE)) {
    add(match.index, match.index + match[0].length);
  }
  for (const match of text.matchAll(BRACKETED_REFERENCE_RE)) {
    add(match.index, match.index + match[0].length);
  }
  for (const match of text.matchAll(YEAR_REFERENCE_RE)) {
    const digits = match[1];
    const start = match.index + match[0].length - digits.length;
    add(start, start + digits.length);
  }
  for (const match of text.matchAll(PUNCTUATION_REFERENCE_RE)) {
    const digits = match[1];
    const punctuationIndex = match.index;
    if (text[punctuationIndex] === "." && /\d/.test(text[punctuationIndex - 1] || "")) continue;
    const start = match.index + match[0].length - digits.length;
    add(start, start + digits.length);
  }

  // A lost PDF superscript often arrives attached to the preceding word. Keep
  // this conservative and body-only so headings, model names, dates and short
  // forms such as MP3 are not silently changed.
  if (kind === "body") {
    for (const match of text.matchAll(ATTACHED_REFERENCE_RE)) {
      const digits = match[1];
      const start = match.index + match[0].length - digits.length;
      add(start, start + digits.length);
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}

/**
 * Repair old cached PDF text once, at the reader's canonical reflow boundary.
 * Replacing ASCII digits with Unicode superscripts preserves string length and
 * offsets, while ensuring display, speech, highlighting, copy, and AI context
 * all consume the same corrected paragraph rather than a renderer-only patch.
 */
function canonicalizeLegacyReferenceMarkers(text: string, kind: Sentence["kind"]): string {
  const markers = findReferenceMarkers(text, kind).filter((marker) => /^\d+$/.test(marker.text));
  if (!markers.length) return text;

  const chars = text.split("");
  for (const marker of markers) {
    for (let index = marker.start; index < marker.end; index++) {
      chars[index] = SUPERSCRIPT_DIGIT_MAP[chars[index]] || chars[index];
    }
  }
  return chars.join("");
}

function nativeStructuredUnits(
  raw: string,
  pageNumber: number | undefined,
  skipLines: Set<string> | undefined
): TextUnit[] {
  const cleaned = cleanCorruptScriptArtifacts(stripNonReadingLines(raw, pageNumber, skipLines))
    .replace(/\r/g, "")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t]{2,}/g, " ");
  const lines = cleaned.split("\n");
  const hardWrappedLineWidth = inferHardWrappedLineWidth(lines);
  const units: TextUnit[] = [];
  let bodyLines: string[] = [];
  let previousWasChapterMarker = false;
  let paragraphIndex = 0;

  const flushBody = () => {
    const paragraph = bodyLines.join(" ").replace(/\s{2,}/g, " ").trim();
    bodyLines = [];
    if (!paragraph) return;
    const currentParagraph = paragraphIndex++;
    units.push({
      text: canonicalizeLegacyReferenceMarkers(paragraph, "body"),
      kind: "body",
      paragraphIndex: currentParagraph,
    });
  };

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index].trim();
    const structuralHeading = unwrapStructuralHeading(rawLine);
    const text = structuralHeading.text;
    if (!text) {
      flushBody();
      previousWasChapterMarker = false;
      continue;
    }

    const previousBlank = index === 0 || !lines[index - 1].trim();
    const nextBlank = index === lines.length - 1 || !lines[index + 1].trim();
    const chapterMarker = isChapterMarker(text);
    const heading = structuralHeading.marked || isHeadingLine(text, {
      isolated: previousBlank || nextBlank,
      followsChapterMarker: previousWasChapterMarker,
      previousText: nearestNonBlankLine(lines, index, -1),
      nextText: nearestNonBlankLine(lines, index, 1),
    });

    if (heading) {
      flushBody();
      units.push({
        text: canonicalizeLegacyReferenceMarkers(text, "heading"),
        kind: "heading",
        paragraphIndex: paragraphIndex++,
      });
      previousWasChapterMarker = chapterMarker;
      continue;
    }

    bodyLines.push(text);
    if (isInferredParagraphEnd(lines, index, hardWrappedLineWidth)) flushBody();
    previousWasChapterMarker = false;
  }

  flushBody();
  return units;
}

/**
 * Older cached native extractions contain every visual PDF line but not the
 * larger vertical gaps between paragraphs. Recover only strong paragraph-end
 * signals: a short final line with terminal punctuation followed by a new
 * capitalized line. New extractions carry explicit blank lines and do not need
 * this fallback.
 */
function inferHardWrappedLineWidth(lines: string[]): number {
  const lengths = lines
    .map((line) => line.trim().length)
    .filter((length) => length >= 20)
    .sort((a, b) => a - b);
  if (lengths.length < 4) return 0;
  const upperQuartile = lengths[Math.floor((lengths.length - 1) * 0.75)];
  if (upperQuartile < 55) return 0;
  const fullLines = lengths.filter((length) => length >= upperQuartile * 0.82).length;
  return fullLines >= Math.max(3, Math.floor(lengths.length * 0.3)) ? upperQuartile : 0;
}

function isInferredParagraphEnd(lines: string[], index: number, lineWidth: number): boolean {
  if (!lineWidth) return false;
  const current = lines[index]?.trim() || "";
  if (!current || current.length > lineWidth * 0.88) return false;
  if (!/[.!?。！？؟…](?:\d{1,12})?["”’')\]]?$/.test(current)) return false;
  if (/\b(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|No|Fig|Eq|Vol|vs)\.$/i.test(current)) return false;

  let nextIndex = index + 1;
  while (nextIndex < lines.length && !lines[nextIndex].trim()) nextIndex++;
  const next = lines[nextIndex]?.trim() || "";
  return /^['"“‘([]?[A-Z\u00c0-\u00de\u0400-\u042f]/.test(next);
}

function nearestNonBlankLine(lines: string[], index: number, direction: -1 | 1): string {
  for (let cursor = index + direction; cursor >= 0 && cursor < lines.length; cursor += direction) {
    const value = lines[cursor].trim();
    if (value) return unwrapStructuralHeading(value).text;
  }
  return "";
}

function unwrapStructuralHeading(value: string): { text: string; marked: boolean } {
  const trimmed = value.trim();
  if (
    trimmed.startsWith(STRUCTURAL_HEADING_START) &&
    trimmed.endsWith(STRUCTURAL_HEADING_END)
  ) {
    return {
      text: trimmed.slice(STRUCTURAL_HEADING_START.length, -STRUCTURAL_HEADING_END.length).trim(),
      marked: true,
    };
  }
  return { text: trimmed, marked: false };
}

function isChapterMarker(text: string): boolean {
  const value = text.trim();
  return (
    /^(chapter|part|book|section|prologue|epilogue|introduction|conclusion|preface|foreword|appendix)\b/i.test(
      value
    ) ||
    /^(فصل|بخش|کتاب|مقدمه|نتیجه|پیوست)(?:\s|$)/.test(value) ||
    /^(الفصل|الباب|الجزء|الكتاب|مقدمة|الخاتمة|ملحق)(?:\s|$)/.test(value) ||
    /^(kapittel|del|innledning|konklusjon|vedlegg)\b/i.test(value) ||
    /^(kapitel|teil|einleitung|schluss|anhang)\b/i.test(value) ||
    /^(глава|часть|книга|раздел|введение|заключение|приложение)(?:\s|$)/i.test(value) ||
    /^(cap[ií]tulo|parte|libro|introducci[oó]n|conclusi[oó]n|ap[eé]ndice)\b/i.test(value) ||
    /^(chapitre|partie|livre|introduction|conclusion|annexe)\b/i.test(value) ||
    /^(capitolo|parte|libro|introduzione|conclusione|appendice)\b/i.test(value) ||
    /^(cap[ií]tulo|parte|livro|introdu[cç][aã]o|conclus[aã]o|ap[eê]ndice)\b/i.test(value) ||
    /^(b[oö]l[uü]m|k[iı]s[iı]m|kitap|giri[sş]|sonu[cç]|ek)\b/i.test(value) ||
    /^(第[一二三四五六七八九十百千\d]+[章节卷部篇]|前言|序言|引言|结论|附录)/.test(value) ||
    /^(第[一二三四五六七八九十百千\d]+[章部編]|序章|終章|はじめに|結論|付録)/.test(value) ||
    /^(제\s*[\d일이삼사오육칠팔구십백]+\s*[장부]|서문|소개|결론|부록)/.test(value)
  );
}

function isHeadingLine(
  text: string,
  context: {
    isolated: boolean;
    followsChapterMarker: boolean;
    previousText?: string;
    nextText?: string;
  }
): boolean {
  const value = text.trim();
  if (!value || value.length > 100) return false;
  if (isChapterMarker(value)) return true;
  if (context.followsChapterMarker && value.split(/\s+/).length <= 14 && !/[.!?؟]$/.test(value)) {
    return true;
  }
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 12) return false;

  // PDF text layers often preserve visual line breaks but lose the blank
  // space around a heading. A short sentence-case line between a completed
  // body line and a new capitalized body line is still a heading. Requiring
  // the next line to start with a capital avoids treating wrapped fragments
  // such as "Human life is\nwritten ..." as headings.
  const previousText = context.previousText?.trim() || "";
  const nextText = context.nextText?.trim() || "";
  const sentenceCaseHeading =
    words.length <= 12 &&
    value.length <= 100 &&
    !/[.!?؟]["'\u201d\u2019)]?$/.test(value) &&
    /^[A-Z\u00c0-\u00de\u0400-\u042f]/.test(value) &&
    /[.!?]["'\u201d\u2019)]?$/.test(previousText) &&
    /^["'\u201c\u2018([]?[A-Z\u00c0-\u00de\u0400-\u042f]/.test(nextText);
  if (sentenceCaseHeading) return true;

  if (!context.isolated || /[.!?؟]$/.test(value)) return false;
  if (/^[IVXLCDM\d\s.:-]+$/i.test(value)) return true;

  const latinWords = words.filter((word) => /[A-Za-z]/.test(word));
  if (latinWords.length === 0) return false;
  const titleLike = latinWords.filter(
    (word) => /^[A-Z][A-Za-z'’\-]*$/.test(word) || /^[A-Z\d'’\-]+$/.test(word)
  ).length;
  return titleLike / latinWords.length >= 0.72;
}

function stripNonReadingLines(
  raw: string,
  pageNumber?: number,
  skipLines?: Set<string>
): string {
  const lines = (raw || "")
    .replace(/\r/g, "")
    .split("\n");
  const kept: string[] = [];
  let inFootnoteBlock = false;
  const contentIndexes = lines
    .map((line, index) => (line.trim() ? index : -1))
    .filter((index) => index >= 0);
  const edgeIndexes = new Set([
    ...contentIndexes.slice(0, 3),
    ...contentIndexes.slice(-3),
  ]);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inFootnoteBlock) {
      if (isFootnoteBlockStop(trimmed)) {
        inFootnoteBlock = false;
      } else {
        continue;
      }
    }

    if (isFootnoteBlockStart(trimmed, i, lines.length)) {
      inFootnoteBlock = true;
      continue;
    }

    if (shouldSkipReaderLine(line, pageNumber, skipLines, edgeIndexes.has(i))) continue;
    kept.push(line);
  }

  return kept.join("\n");
}

function shouldSkipReaderLine(
  line: string,
  pageNumber?: number,
  skipLines?: Set<string>,
  isPageEdge = false
): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isStandaloneFootnoteMarkerLine(trimmed)) return true;
  const normalized = normalizeReaderLine(trimmed);
  if (!normalized) return false;
  if (
    isPageEdge &&
    (skipLines?.has(normalized) || skipLines?.has(`#pattern:${boilerplatePattern(normalized)}`))
  ) return true;
  if (isPageEdge && isPageNumberLine(normalized, pageNumber)) return true;
  if (isUrlOrWatermarkLine(normalized)) return true;
  if (/^[._=\-*~•·\s]{4,}$/.test(trimmed)) return true;
  return false;
}

function isStandaloneFootnoteMarkerLine(trimmed: string): boolean {
  return /^[∗*＊﹡]{1,4}$/.test(trimmed);
}

function isFootnoteBlockStart(trimmed: string, lineIndex: number, lineCount: number): boolean {
  if (!trimmed) return false;
  const position = lineIndex / Math.max(1, lineCount);
  const markerStart = trimmed.match(/^[∗*＊﹡]{1,4}\s*(.+)$/);
  if (markerStart) {
    const rest = markerStart[1].trim();
    if (!rest) return false;
    return position > 0.45 || rest.length > 80;
  }

  if (position <= 0.45 || !/[∗*＊﹡]\s*$/.test(trimmed)) return false;
  return isMostlyLatin(trimmed);
}

function isFootnoteBlockStop(trimmed: string): boolean {
  return /^(سوال|جواب)[\s-]/.test(trimmed) || /^(question|answer)\b/i.test(trimmed);
}

function isMostlyLatin(value: string): boolean {
  const letters = value.match(/[A-Za-z\u00C0-\u024F]/g)?.length ?? 0;
  if (letters < 6) return false;
  const script = value.match(new RegExp(`[${NON_LATIN_SCRIPT_RANGES}]`, "g"))?.length ?? 0;
  return letters > script * 2;
}

function buildRepeatedSkipLines(pages: PdfPage[]): Set<string> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    const lines = (page.text || "").split(/\r?\n/).filter((line) => line.trim());
    const edgeLines = [...lines.slice(0, 3), ...lines.slice(-3)];
    for (const line of edgeLines) {
      const normalized = normalizeReaderLine(line);
      if (!isRepeatableBoilerplate(normalized)) continue;
      seen.add(normalized);
      const pattern = boilerplatePattern(normalized);
      if (pattern !== normalized) seen.add(`#pattern:${pattern}`);
    }
    for (const line of seen) counts.set(line, (counts.get(line) || 0) + 1);
  }

  // Running furniture often belongs to one preface/chapter rather than the
  // complete book. Requiring a large percentage of every page leaves those
  // section headers in long books, while three edge-only repeats are already
  // strong evidence that a line is not body prose.
  const threshold = 3;
  const skip = new Set<string>();
  for (const [line, count] of counts) {
    if (count >= threshold) skip.add(line);
  }
  return skip;
}

function isRepeatableBoilerplate(normalized: string): boolean {
  if (normalized.length < 4 || normalized.length > 90) return false;
  if (isUrlOrWatermarkLine(normalized)) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (/[.!?]$/.test(normalized)) return false;
  return true;
}

function boilerplatePattern(normalized: string): string {
  return normalized
    .replace(/^\b[ivxlcdm]{1,8}\b/i, "#roman")
    .replace(/\b[ivxlcdm]{1,8}\b$/i, "#roman")
    .replace(/\d+/g, "#")
    // Old scans frequently damage a running Roman page label into another
    // short token (for example `viii Preface` -> `ate Preface`). Group those
    // edge-only variants by their stable section title.
    .replace(/^(?:#roman|[a-z]{1,4})\s+/i, "#edge ")
    .replace(/\s+(?:#roman|[a-z]{1,4})$/i, " #edge");
}

function isPageNumberLine(normalized: string, pageNumber?: number): boolean {
  if (/^(?:\d+|[ivxlcdm]{1,8})$/i.test(normalized)) return true;
  if (/^(?:page|صفحه)\s+(?:\d+|[ivxlcdm]{1,8})$/i.test(normalized)) return true;
  if (!pageNumber || pageNumber < 1) return false;
  const page = String(pageNumber);
  return normalized === page || normalized === `page ${page}` || normalized === `صفحه ${page}`;
}

function isUrlOrWatermarkLine(normalized: string): boolean {
  return (
    /https?:\/\//i.test(normalized) ||
    /\bwww\./i.test(normalized) ||
    /\.(com|ir|org|net)\b/i.test(normalized) ||
    /ketabfarsi|takbook|veyq|ebook|persianblog|golshan/i.test(normalized)
  );
}

function normalizeReaderLine(line: string): string {
  return normalizeDigits(line)
    .replace(/\s+/g, " ")
    .replace(/[ـ]+/g, "")
    .trim()
    .toLowerCase();
}

function normalizeDigits(value: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const faIndex = fa.indexOf(ch);
    if (faIndex >= 0) return String(faIndex);
    const arIndex = ar.indexOf(ch);
    return arIndex >= 0 ? String(arIndex) : ch;
  });
}

const NON_LATIN_SCRIPT_RANGES =
  "\\u0400-\\u04FF" + // Cyrillic
  "\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF" + // Arabic/Persian
  "\\u0900-\\u097F" + // Devanagari
  "\\u0E00-\\u0E7F" + // Thai
  "\\u3040-\\u30FF\\u3400-\\u9FFF" + // Japanese/Chinese
  "\\uAC00-\\uD7AF\\u1100-\\u11FF"; // Korean
const NON_LATIN_SCRIPT_RE = new RegExp(`[${NON_LATIN_SCRIPT_RANGES}]`);
const ARTIFACT_CLASS = "AÂÃÄÅÆØÙÚÛÜÝÞÐÑ�Ѧѧ";
const ARTIFACT_BETWEEN_SCRIPT_RE = new RegExp(
  `([${NON_LATIN_SCRIPT_RANGES}])[${ARTIFACT_CLASS}]{1,4}(?=[${NON_LATIN_SCRIPT_RANGES}])`,
  "g"
);
const ARTIFACT_AFTER_SCRIPT_RE = new RegExp(
  `([${NON_LATIN_SCRIPT_RANGES}])[${ARTIFACT_CLASS}]{1,4}(?=\\s|$|[،؛؟,.!?\\-])`,
  "g"
);
const ARTIFACT_BEFORE_SCRIPT_RE = new RegExp(
  `(^|\\s|[،؛؟,.!?\\-])[${ARTIFACT_CLASS}]{1,4}(?=[${NON_LATIN_SCRIPT_RANGES}])`,
  "g"
);

function cleanCorruptScriptArtifacts(raw: string): string {
  return (raw || "")
    .split("\n")
    .map((line) => {
      if (!NON_LATIN_SCRIPT_RE.test(line)) return line;
      return collapseDuplicateScriptRuns(
        line
          .normalize("NFKC")
          .replace(/\(cid:\d+\)/g, "")
          .replace(/[∗*＊﹡¥￥]{1,4}/g, " ")
          .replace(ARTIFACT_BETWEEN_SCRIPT_RE, "$1")
          .replace(ARTIFACT_AFTER_SCRIPT_RE, "$1")
          .replace(ARTIFACT_BEFORE_SCRIPT_RE, "$1")
      );
    })
    .join("\n");
}

function collapseDuplicateScriptRuns(line: string): string {
  return line.replace(new RegExp(`([${NON_LATIN_SCRIPT_RANGES}]{3,})\\1`, "g"), "$1");
}

function repairLatinOcrWordBreaks(raw: string): string {
  return (raw || "")
    .split("\n")
    .map((line) => {
      if (!isMostlyLatin(line)) return line;
      let out = line
        .replace(/\b([A-Za-z]{3,})\s+(er|ers|est|ing|ed|ly|ment|ness|tion|tions|sion|ter|der|per|able|ible|ally|ive|ous)\b/g, "$1$2")
        .replace(/\b([A-Za-z]{5,})\s+(al|ic|ical|ity|ies)\b/g, "$1$2");
      for (const word of COMMON_LATIN_OCR_JOIN_WORDS) out = joinKnownWord(out, word);
      return out;
    })
    .join("\n");
}

const COMMON_LATIN_OCR_JOIN_WORDS = [
  "apache",
  "helicopter",
  "sniper",
  "overwatch",
  "south-central",
];

function joinKnownWord(line: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (let i = 2; i <= word.length - 2; i++) {
    const left = escaped.slice(0, i);
    const right = escaped.slice(i);
    const re = new RegExp(`\\b(${left})\\s+(${right})\\b`, "gi");
    line = line.replace(re, (_match, a: string, b: string) => `${a}${b}`);
  }
  return line;
}
