import { PdfPage } from "./PDFParser";

export interface Sentence {
  id: number;
  page: number;
  text: string;
}

export interface ReflowChunk {
  /** 1-based index of the first page in this chunk. */
  startPage: number;
  /** 1-based index of the last page in this chunk. */
  endPage: number;
  sentences: Sentence[];
}

/**
 * TextReflow — turns raw page text into clean, sentence-level units that the
 * Reader renders. Sentences are the unit of highlighting AND the unit we feed
 * to the TTS engine, which keeps highlight + voice in sync cross-platform.
 *
 * It also groups pages into chunks (default 10) so we "read 10 pages at a time".
 */
export const TextReflow = {
  PAGES_PER_CHUNK: 10,

  /** Normalize whitespace and join hard-wrapped lines into flowing paragraphs. */
  cleanPageText(raw: string): string {
    return raw
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
  cleanOcrText(raw: string): string {
    return raw
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
  unitsForPage(p: PdfPage): string[] {
    if (p.source === "ocr") {
      const clean = this.cleanOcrText(p.text);
      const units: string[] = [];
      for (const line of clean.split(/\n+/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        for (const s of this.splitSentences(trimmed)) units.push(s);
      }
      return units;
    }
    return this.splitSentences(this.cleanPageText(p.text));
  },

  splitSentences(text: string): string[] {
    if (!text) return [];
    // Split after . ! ? (incl. common closing quotes) followed by a space.
    const parts = text
      .replace(/([.!?]["”’)]?)\s+/g, "$1\u0001")
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
    let id = 0;
    for (const p of pages) {
      for (const s of this.unitsForPage(p)) {
        out.push({ id: id++, page: p.page, text: s });
      }
    }
    return out;
  },

  /** Global index of the first sentence on a given 1-based page (or -1). */
  firstIndexOfPage(sentences: Sentence[], page: number): number {
    return sentences.findIndex((s) => s.page === page);
  },

  buildChunks(pages: PdfPage[]): ReflowChunk[] {    const chunks: ReflowChunk[] = [];
    let sentenceId = 0;

    for (let i = 0; i < pages.length; i += this.PAGES_PER_CHUNK) {
      const slice = pages.slice(i, i + this.PAGES_PER_CHUNK);
      const sentences: Sentence[] = [];

      for (const p of slice) {
        for (const s of this.unitsForPage(p)) {
          sentences.push({ id: sentenceId++, page: p.page, text: s });
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

  /** Find the chunk index that contains a given 1-based page number. */
  chunkIndexForPage(chunks: ReflowChunk[], page: number): number {
    for (let i = 0; i < chunks.length; i++) {
      if (page >= chunks[i].startPage && page <= chunks[i].endPage) return i;
    }
    return -1;
  },
};
