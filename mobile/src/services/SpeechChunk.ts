import { Sentence, TextReflow } from "./TextReflow";

export type SpeechChunkMode = "natural" | "device" | "local";

export interface SpeechChunkSpan {
  sentence: Sentence;
  start: number;
  end: number;
  sourceStart: number;
  sourceOffsets: number[];
}

export interface SpeechChunk {
  text: string;
  spans: SpeechChunkSpan[];
  nextIndex: number;
  /** Source offset when the next block continues inside the same rendered paragraph. */
  nextOffset: number;
  lastPage: number;
  lastWithin: number;
}

interface BuildSpeechChunkOptions {
  mode: SpeechChunkMode;
  pageCap: number;
  firstOffset?: number;
}

// Keep normal paragraphs intact. Exceptionally long paragraphs are divided at
// grammatical sentence boundaries. A malformed or unusually long sentence also
// has a hard local-AI guard: very large one-shot Supertonic requests can exhaust
// Android memory and leave the reader UI unable to navigate.
const LOCAL_AI_BLOCK_MAX_CHARS = 1000;
const LOCAL_AI_UNBROKEN_MAX_CHARS = 260;
const CLOUD_AI_BLOCK_MAX_CHARS = 1100;
const DEVICE_BLOCK_MAX_CHARS = 1000;
const NON_TERMINAL_ABBREVIATIONS = new Set([
  "dr",
  "mr",
  "mrs",
  "ms",
  "prof",
  "sr",
  "jr",
  "st",
  "no",
  "fig",
  "eq",
  "vol",
  "vs",
]);

/**
 * Builds one natural speech unit while retaining source offsets for line
 * highlighting. A sentence split by a PDF page boundary is kept in the same
 * audio unit even though it remains two visual rows with a page divider.
 */
export function buildSpeechChunk(
  startIndex: number,
  list: Sentence[],
  options: BuildSpeechChunkOptions
): SpeechChunk | null {
  const first = list[startIndex];
  if (!first) return null;
  if (first.page > options.pageCap) return null;

  const firstOffset = Math.max(0, options.firstOffset || 0);
  const spans: SpeechChunkSpan[] = [];
  const parts: string[] = [];
  let charCursor = 0;
  const sourceStart = Math.min(firstOffset, first.text.length);
  const sourceEnd =
    first.kind === "heading" && options.mode !== "local"
      ? first.text.length
      : safeBlockEnd(
          first.text,
          sourceStart,
          maxCharsFor(options.mode),
          options.mode === "local" ? LOCAL_AI_UNBROKEN_MAX_CHARS : Number.POSITIVE_INFINITY
        );
  const prepared = TextReflow.speechText(first.text, first.kind, sourceStart, sourceEnd);
  if (!prepared.text.trim()) {
    return buildSpeechChunk(
      sourceEnd < first.text.length ? startIndex : startIndex + 1,
      list,
      {
        ...options,
        firstOffset: sourceEnd < first.text.length ? sourceEnd : 0,
      }
    );
  }

  appendSpan(first, sourceStart, prepared, "", spans, parts, charCursor);
  charCursor = prepared.text.length;

  if (sourceEnd < first.text.length) {
    return {
      text: parts.join(""),
      spans,
      nextIndex: startIndex,
      nextOffset: nextReadableOffset(first.text, sourceEnd),
      lastPage: first.page,
      lastWithin: pageWithinIndex(first, list),
    };
  }

  let index = startIndex + 1;

  // A visual page boundary is not a language boundary. If the last row has no
  // sentence-ending punctuation, append the first body row from the next page.
  // This may add one visual span beyond the ordinary local-AI buffer, but it is
  // still one grammatical sentence and avoids a conspicuous page-turn pause.
  while (spans.length && index < list.length) {
    const previous = spans[spans.length - 1].sentence;
    const continuation = list[index];
    if (!TextReflow.continuesAcrossPage(previous, continuation)) break;
    if (continuation.page > options.pageCap) break;

    const continuationEnd = firstSentenceEnd(continuation.text);
    const continuationSpeech = TextReflow.speechText(
      continuation.text,
      continuation.kind,
      0,
      continuationEnd
    );
    if (!continuationSpeech.text.trim()) {
      index++;
      continue;
    }

    const separator = pageContinuationSeparator(parts[parts.length - 1], continuationSpeech.text);
    const projectedLength = charCursor + separator.length + continuationSpeech.text.length;

    appendSpan(continuation, 0, continuationSpeech, separator, spans, parts, charCursor);
    charCursor = projectedLength;

    if (continuationEnd < continuation.text.length) {
      return {
        text: parts.join(""),
        spans,
        nextIndex: index,
        nextOffset: nextReadableOffset(continuation.text, continuationEnd),
        lastPage: continuation.page,
        lastWithin: pageWithinIndex(continuation, list),
      };
    }
    index++;
  }

  if (!spans.length) return null;
  const last = spans[spans.length - 1].sentence;
  return {
    text: parts.join(""),
    spans,
    nextIndex: index,
    nextOffset: 0,
    lastPage: last.page,
    lastWithin: pageWithinIndex(last, list),
  };
}

/** Resume at the beginning of the current grammatical sentence. */
export function resumeSpeechOffset(text: string, approximateOffset: number): number {
  const bounded = Math.max(0, Math.min(text.length, approximateOffset));
  let start = 0;
  for (const end of sentenceEnds(text, 0)) {
    if (end >= bounded) break;
    start = nextReadableOffset(text, end);
  }
  return start;
}

function maxCharsFor(mode: SpeechChunkMode): number {
  if (mode === "local") return LOCAL_AI_BLOCK_MAX_CHARS;
  if (mode === "natural") return CLOUD_AI_BLOCK_MAX_CHARS;
  return DEVICE_BLOCK_MAX_CHARS;
}

function safeBlockEnd(
  text: string,
  sourceStart: number,
  maxChars: number,
  unbrokenMaxChars: number
): number {
  const start = nextReadableOffset(text, sourceStart);
  const softEnd = Math.min(text.length, start + maxChars);
  if (softEnd >= text.length) {
    return text.length - start <= unbrokenMaxChars
      ? text.length
      : emergencyBlockEnd(text, start, unbrokenMaxChars);
  }

  const boundaries = sentenceEnds(text, start);
  let prior = -1;
  for (const end of boundaries) {
    if (end <= softEnd) {
      prior = end;
      continue;
    }
    if (prior > start) {
      return prior - start <= unbrokenMaxChars
        ? prior
        : emergencyBlockEnd(text, start, unbrokenMaxChars);
    }
    return end - start <= unbrokenMaxChars
      ? end
      : emergencyBlockEnd(text, start, unbrokenMaxChars);
  }
  return text.length - start <= unbrokenMaxChars
    ? text.length
    : emergencyBlockEnd(text, start, unbrokenMaxChars);
}

function emergencyBlockEnd(text: string, start: number, maxChars: number): number {
  const target = Math.min(text.length, start + Math.max(1, Math.floor(maxChars)));
  const earliest = Math.min(target, start + Math.floor(maxChars * 0.55));

  // Prefer a clause break, then any word boundary. No characters are discarded:
  // the next chunk resumes from the returned source offset.
  for (let index = target; index >= earliest; index--) {
    if (/[;:,\u2014\u2013]/.test(text[index - 1] || "") && /\s/.test(text[index] || "")) {
      return index;
    }
  }
  for (let index = target; index >= earliest; index--) {
    if (/\s/.test(text[index] || "")) return index;
  }
  return target;
}

function firstSentenceEnd(text: string): number {
  return sentenceEnds(text, 0)[0] ?? text.length;
}

function sentenceEnds(text: string, sourceStart: number): number[] {
  const out: number[] = [];
  const re = /[.!?。！？؟…]["”’')\]]?(?=\s|$)/g;
  re.lastIndex = Math.max(0, sourceStart);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const end = match.index + match[0].length;
    if (text[match.index] === "." && isNonTerminalPeriod(text, match.index, end)) continue;
    out.push(end);
  }
  return out;
}

function isNonTerminalPeriod(text: string, periodIndex: number, matchEnd: number): boolean {
  const prefix = text.slice(Math.max(0, periodIndex - 24), periodIndex + 1);
  const token = prefix.match(/([A-Za-z][A-Za-z.]*)\.$/)?.[1] || "";
  const lower = token.toLowerCase();
  if (NON_TERMINAL_ABBREVIATIONS.has(lower)) return true;
  if (/(?:\b[A-Za-z]\.){2,}$/.test(prefix) || /\b[A-Z]\.$/.test(prefix)) return true;

  const next = text.slice(matchEnd).match(/\S/)?.[0];
  return Boolean(next && /[a-z\u00df-\u024f]/.test(next));
}

function nextReadableOffset(text: string, offset: number): number {
  let next = Math.max(0, Math.min(text.length, offset));
  while (next < text.length && /\s/.test(text[next])) next++;
  return next;
}

function appendSpan(
  sentence: Sentence,
  sourceStart: number,
  prepared: { text: string; sourceOffsets: number[] },
  separator: string,
  spans: SpeechChunkSpan[],
  parts: string[],
  charCursor: number
) {
  const start = charCursor + separator.length;
  spans.push({
    sentence,
    start,
    end: start + prepared.text.length,
    sourceStart,
    sourceOffsets: prepared.sourceOffsets,
  });
  parts.push(`${separator}${prepared.text}`);
}

function pageContinuationSeparator(previous: string, next: string): string {
  // PDF extractors commonly preserve a hyphen when a word crosses a page.
  // Keeping no added space lets the TTS tokenizer hear it as one word.
  if (/-$/.test(previous) && /^[A-Za-z\u00c0-\u024f]/.test(next)) return "";
  return " ";
}

function pageWithinIndex(sentence: Sentence, list: Sentence[]): number {
  if (Number.isFinite(sentence.pageSentenceIndex)) return sentence.pageSentenceIndex;
  return list
    .filter((item) => item.page === sentence.page)
    .findIndex((item) => item.id === sentence.id);
}
