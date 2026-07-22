import { normalizeHeadingForSpeech } from "../SpeechNormalization";
import {
  LanguageInterpretation,
  PronunciationHint,
  SpeakableText,
  SpeechBoundary,
  SpeechEmphasis,
  SpeechPause,
  StructuralInterpretation,
  TextIntelligenceInput,
} from "./types";

interface MappedText {
  text: string;
  sourceOffsets: number[];
}

export function deterministicSpeechPreparation(
  input: TextIntelligenceInput,
  structure: StructuralInterpretation
): Omit<SpeakableText, "confidence" | "fallback" | "provenance"> {
  const language = interpretLanguage(input.rawText, input.language);
  let mapped = normalizeTypography(input.rawText, structure.kind);

  if (structure.kind === "heading") {
    const heading = normalizeHeadingForSpeech(mapped.text);
    if (heading !== mapped.text) mapped = alignReplacement(mapped, heading);
  }

  return {
    text: mapped.text,
    sourceOffsets: mapped.sourceOffsets,
    boundaries: findBoundaries(mapped.text, structure.kind),
    language,
    pronunciation: pronunciationHints(mapped.text, language),
    pauses: pauseInstructions(mapped.text, structure.kind),
    emphasis: emphasisInstructions(mapped.text, structure.kind),
    structure,
  };
}

function normalizeTypography(source: string, structure: StructuralInterpretation["kind"]): MappedText {
  const out: string[] = [];
  const offsets: number[] = [];
  const listMarker = source.match(/^\s*(?:[•▪◦‣⁃*]|[-–—](?=\s)|(?:\d{1,4}|\p{L})[.)](?=\s))\s*/u);
  const ignoredPrefixEnd = structure === "list" ? listMarker?.[0].length || 0 : 0;
  let pendingSpace = false;
  let pendingOffset = 0;

  const append = (value: string, sourceOffset: number) => {
    for (let index = 0; index < value.length; index++) {
      out.push(value[index]);
      offsets.push(sourceOffset);
    }
  };
  const flushSpace = () => {
    if (!pendingSpace || out.length === 0 || out[out.length - 1] === " ") return;
    append(" ", pendingOffset);
    pendingSpace = false;
  };

  for (let index = 0; index < source.length; index++) {
    if (index < ignoredPrefixEnd) continue;
    const char = source[index];
    if (char === "\u00ad") continue;
    if (/\s/u.test(char)) {
      pendingSpace = true;
      pendingOffset = index;
      continue;
    }

    const isTableDivider = structure === "table" && /[|¦│]/u.test(char);
    if (isTableDivider) {
      if (out.length && out[out.length - 1] !== " ") append(",", index);
      pendingSpace = true;
      pendingOffset = index;
      continue;
    }

    flushSpace();
    const normalized = char
      .normalize("NFKC")
      .replace(/[“”„‟]/g, '"')
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[‐‑‒–―]/g, "-")
      .replace(/…/g, "...");
    append(normalized, index);
  }

  while (out[out.length - 1] === " ") {
    out.pop();
    offsets.pop();
  }
  return { text: out.join(""), sourceOffsets: offsets };
}

function alignReplacement(source: MappedText, replacement: string): MappedText {
  const offsets: number[] = [];
  let cursor = 0;
  for (let replacementIndex = 0; replacementIndex < replacement.length; replacementIndex++) {
    const char = replacement[replacementIndex];
    let found = -1;
    const needle = comparable(char);
    for (let index = cursor; index < source.text.length; index++) {
      if (comparable(source.text[index]) === needle) {
        found = index;
        break;
      }
    }
    if (found >= 0) {
      cursor = found + 1;
      offsets.push(source.sourceOffsets[found] ?? 0);
    } else {
      offsets.push(source.sourceOffsets[Math.max(0, Math.min(source.text.length - 1, cursor))] ?? 0);
    }
  }
  return { text: replacement, sourceOffsets: offsets };
}

export function alignOnlineText(source: MappedText, replacement: string): MappedText {
  return alignReplacement(source, replacement.trim());
}

export function preservesLexicalContent(source: string, candidate: string): boolean {
  const sourceTokens = lexicalTokens(source);
  const candidateTokens = lexicalTokens(candidate);
  if (!sourceTokens.length) return candidateTokens.length === 0;
  if (Math.abs(sourceTokens.length - candidateTokens.length) > Math.max(1, sourceTokens.length * 0.02)) {
    return false;
  }
  const matches = sourceTokens.filter((token, index) => candidateTokens[index] === token).length;
  return matches / sourceTokens.length >= 0.98;
}

function lexicalTokens(value: string): string[] {
  return (value.toLocaleLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || []).filter(Boolean);
}

function comparable(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function findBoundaries(
  text: string,
  structure: StructuralInterpretation["kind"]
): SpeechBoundary[] {
  if (!text) return [];
  if (structure === "list" || structure === "table") {
    return [{ start: 0, end: text.length, kind: "item" }];
  }
  const boundaries: SpeechBoundary[] = [];
  const re = /[.!?。！？؟…]+["')\]”’»]?(?=\s|$)/gu;
  let start = 0;
  for (const match of text.matchAll(re)) {
    const end = (match.index || 0) + match[0].length;
    boundaries.push({ start, end, kind: "sentence" });
    start = skipSpaces(text, end);
  }
  if (start < text.length) boundaries.push({ start, end: text.length, kind: "sentence" });
  return boundaries;
}

function pauseInstructions(
  text: string,
  structure: StructuralInterpretation["kind"]
): SpeechPause[] {
  const pauses: SpeechPause[] = [];
  for (const match of text.matchAll(/[.!?。！？؟…]+/gu)) {
    pauses.push({
      offset: (match.index || 0) + match[0].length,
      durationMs: 180,
      reason: "sentence",
    });
  }
  if (structure === "heading") {
    pauses.push({ offset: text.length, durationMs: 260, reason: "heading" });
  } else if (structure === "list") {
    pauses.push({ offset: text.length, durationMs: 150, reason: "list_item" });
  } else if (structure === "table") {
    for (const match of text.matchAll(/,/g)) {
      pauses.push({ offset: (match.index || 0) + 1, durationMs: 110, reason: "table_cell" });
    }
  } else if (structure === "dialogue") {
    pauses.push({ offset: text.length, durationMs: 120, reason: "dialogue" });
  }
  return pauses;
}

function emphasisInstructions(
  text: string,
  structure: StructuralInterpretation["kind"]
): SpeechEmphasis[] {
  if (!text) return [];
  if (structure === "heading") {
    return [{ start: 0, end: text.length, level: "strong", reason: "heading" }];
  }
  if (structure === "dialogue") {
    return [{ start: 0, end: text.length, level: "moderate", reason: "dialogue" }];
  }
  return [];
}

function interpretLanguage(text: string, requested = "und"): LanguageInterpretation {
  const counts = new Map<string, number>();
  for (const char of Array.from(text)) {
    const script = scriptFor(char);
    if (!script) continue;
    counts.set(script, (counts.get(script) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((sum, [, count]) => sum + count, 0);
  const scripts = ranked.filter(([, count]) => count / Math.max(1, total) >= 0.08).map(([script]) => script);
  const requestedPrimary = requested.toLowerCase().split(/[-_]/)[0];
  const primary = requestedPrimary && !["auto", "und"].includes(requestedPrimary)
    ? requestedPrimary
    : defaultLanguageForScript(scripts[0]);
  return {
    requested: requested || "und",
    primary,
    scripts,
    mixed: scripts.length > 1,
  };
}

function pronunciationHints(text: string, language: LanguageInterpretation): PronunciationHint[] {
  const hints: PronunciationHint[] = [];
  for (const match of text.matchAll(/[+-]?\d+(?:[.,:/-]\d+)*%?/gu)) {
    const start = match.index || 0;
    const previous = text[start - 1];
    if (previous && /[\p{L}\p{M}\p{N}]/u.test(previous)) continue;
    hints.push({
      start,
      end: start + match[0].length,
      language: language.primary,
      mode: "number",
    });
  }
  for (const match of text.matchAll(/(?:\p{L}\.){2,}/gu)) {
    hints.push({
      start: match.index || 0,
      end: (match.index || 0) + match[0].length,
      language: language.primary,
      mode: "letters",
    });
  }
  if (!language.mixed) return hints;
  let start = 0;
  let activeScript = scriptFor(text[0]) || "Common";
  for (let index = 1; index <= text.length; index++) {
    const nextScript = index < text.length ? scriptFor(text[index]) || activeScript : "END";
    if (nextScript === activeScript) continue;
    if (activeScript !== "Common") {
      hints.push({
        start,
        end: index,
        language: defaultLanguageForScript(activeScript),
        mode: "word",
      });
    }
    start = index;
    activeScript = nextScript;
  }
  return hints;
}

function scriptFor(char: string | undefined): string | null {
  if (!char || !/[\p{L}\p{M}]/u.test(char)) return null;
  if (/\p{Script=Latin}/u.test(char)) return "Latin";
  if (/\p{Script=Cyrillic}/u.test(char)) return "Cyrillic";
  if (/\p{Script=Arabic}/u.test(char)) return "Arabic";
  if (/\p{Script=Hebrew}/u.test(char)) return "Hebrew";
  if (/\p{Script=Han}/u.test(char)) return "Han";
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(char)) return "Japanese";
  if (/\p{Script=Hangul}/u.test(char)) return "Hangul";
  if (/\p{Script=Devanagari}/u.test(char)) return "Devanagari";
  return "Other";
}

function defaultLanguageForScript(script = "Other"): string {
  if (script === "Cyrillic") return "ru";
  if (script === "Arabic") return "ar";
  if (script === "Hebrew") return "he";
  if (script === "Han") return "zh";
  if (script === "Japanese") return "ja";
  if (script === "Hangul") return "ko";
  if (script === "Devanagari") return "hi";
  if (script === "Latin") return "en";
  return "und";
}

function skipSpaces(text: string, offset: number): number {
  let next = offset;
  while (next < text.length && /\s/u.test(text[next])) next++;
  return next;
}
