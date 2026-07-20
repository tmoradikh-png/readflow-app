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
  lastPage: number;
  lastWithin: number;
}

interface BuildSpeechChunkOptions {
  mode: SpeechChunkMode;
  pageCap: number;
  firstOffset?: number;
}

const LOCAL_AI_MAX_CHARS = 420;
const LOCAL_AI_MAX_SENTENCES = 2;
const PAGE_CONTINUATION_MAX_CHARS = 760;

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

  const firstOffset = Math.max(0, options.firstOffset || 0);
  const maxSentences =
    first.kind === "heading" ? 1 : options.mode === "local" ? LOCAL_AI_MAX_SENTENCES : 1;
  const maxChars =
    options.mode === "local" ? LOCAL_AI_MAX_CHARS : Number.POSITIVE_INFINITY;
  const spans: SpeechChunkSpan[] = [];
  const parts: string[] = [];
  let charCursor = 0;
  let index = startIndex;

  while (index < list.length && spans.length < maxSentences) {
    const sentence = list[index];
    if (!sentence || sentence.page > options.pageCap) break;
    if (sentence.page !== first.page) break;
    if (sentence.kind !== first.kind) break;

    const sourceStart =
      index === startIndex
        ? Math.min(firstOffset, sentence.text.length)
        : 0;
    const prepared = TextReflow.speechText(sentence.text, sentence.kind, sourceStart);
    if (!prepared.text.trim()) {
      index++;
      continue;
    }

    const separator = parts.length > 0 ? " " : "";
    const projectedLength = charCursor + separator.length + prepared.text.length;
    if (parts.length > 0 && projectedLength > maxChars) break;

    appendSpan(sentence, sourceStart, prepared, separator, spans, parts, charCursor);
    charCursor = projectedLength;
    index++;
  }

  // A visual page boundary is not a language boundary. If the last row has no
  // sentence-ending punctuation, append the first body row from the next page.
  // This may add one visual span beyond the ordinary local-AI buffer, but it is
  // still one grammatical sentence and avoids a conspicuous page-turn pause.
  while (spans.length && index < list.length) {
    const previous = spans[spans.length - 1].sentence;
    const continuation = list[index];
    if (!TextReflow.continuesAcrossPage(previous, continuation)) break;
    if (continuation.page > options.pageCap) break;

    const prepared = TextReflow.speechText(continuation.text, continuation.kind, 0);
    if (!prepared.text.trim()) {
      index++;
      continue;
    }

    const separator = pageContinuationSeparator(parts[parts.length - 1], prepared.text);
    const projectedLength = charCursor + separator.length + prepared.text.length;
    if (projectedLength > PAGE_CONTINUATION_MAX_CHARS) break;

    appendSpan(continuation, 0, prepared, separator, spans, parts, charCursor);
    charCursor = projectedLength;
    index++;
  }

  if (!spans.length) return null;
  const last = spans[spans.length - 1].sentence;
  return {
    text: parts.join(""),
    spans,
    nextIndex: index,
    lastPage: last.page,
    lastWithin: pageWithinIndex(last, list),
  };
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
