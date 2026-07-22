import {
  LocalTextIntelligenceModel,
  LocalTextInterpretation,
  TextIntelligenceInput,
  TextStructure,
} from "./types";

type FeatureName =
  | "source_heading"
  | "short"
  | "isolated"
  | "no_terminal"
  | "chapter_context"
  | "all_caps"
  | "bullet"
  | "enumerated"
  | "multi_line"
  | "table_separator"
  | "wide_gap"
  | "operator_density"
  | "dialogue_open"
  | "prose_length"
  | "sentence_density"
  | "artifact_density"
  | "mixed_structure";

const WEIGHTS: Record<TextStructure, Partial<Record<FeatureName, number>>> = {
  heading: {
    source_heading: 5,
    short: 1.2,
    isolated: 1.3,
    no_terminal: 0.7,
    chapter_context: 1.8,
    all_caps: 0.8,
  },
  list: { bullet: 7, enumerated: 6.5, multi_line: 0.8 },
  table: { table_separator: 4.2, wide_gap: 2.6, multi_line: 0.8 },
  formula: { operator_density: 4.5, short: 0.4 },
  dialogue: { dialogue_open: 4.5, sentence_density: 0.4 },
  prose: { prose_length: 2.4, sentence_density: 2.2, no_terminal: -0.2 },
  artifact: { artifact_density: 5 },
  unknown: { mixed_structure: 2.6 },
};

/**
 * A tiny weighted contextual classifier. It is script-agnostic, works offline,
 * and is intentionally replaceable by a neural model implementing the same
 * interface. Its features use layout and neighboring text rather than a list
 * of book-specific phrases.
 */
export class CompactMultilingualModel implements LocalTextIntelligenceModel {
  readonly id = "compact-multilingual-structure-v1";

  interpret(input: TextIntelligenceInput): LocalTextInterpretation {
    const features = extractFeatures(input);
    const scores = Object.fromEntries(
      (Object.keys(WEIGHTS) as TextStructure[]).map((kind) => [
        kind,
        scoreFor(kind, features),
      ])
    ) as Record<TextStructure, number>;
    const ranked = (Object.entries(scores) as Array<[TextStructure, number]>).sort(
      (a, b) => b[1] - a[1]
    );
    const [winner, winnerScore] = ranked[0];
    const secondScore = ranked[1]?.[1] ?? 0;
    const margin = winnerScore - secondScore;
    const confidence = clamp(0.46 + sigmoid(margin) * 0.42 + Math.min(0.08, winnerScore / 80));
    const cues = (Object.keys(features) as FeatureName[]).filter(
      (feature) => features[feature] > 0 && (WEIGHTS[winner][feature] || 0) > 0
    );

    let fallbackReason: LocalTextInterpretation["fallbackReason"];
    if (features.artifact_density > 0.48) fallbackReason = "possible_ocr_artifact";
    else if (features.mixed_structure > 0.65) fallbackReason = "mixed_structure";
    else if (confidence < 0.62) fallbackReason = "low_confidence";

    return {
      structure: { kind: winner, confidence, cues },
      confidence,
      fallbackReason,
    };
  }
}

function extractFeatures(input: TextIntelligenceInput): Record<FeatureName, number> {
  const text = input.rawText.trim();
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const chars = Array.from(text);
  const letters = chars.filter((char) => isLetter(char)).length;
  const digits = chars.filter((char) => /\d/.test(char)).length;
  const symbols = chars.filter((char) => !isLetter(char) && !/\d|\s/.test(char)).length;
  const words = text.split(/\s+/).filter(Boolean);
  const terminalCount = (text.match(/[.!?。！？؟…]/g) || []).length;
  const bullets = lines.filter((line) => /^(?:[•▪◦‣⁃*]|[-–—]\s)/u.test(line)).length;
  const enumerated = lines.filter((line) => /^(?:\d{1,4}|[\p{L}])\s*[.)]\s+/u.test(line)).length;
  const tableSeparators = (text.match(/[|¦│]/g) || []).length;
  const wideGaps = lines.filter((line) => /\S\s{2,}\S/.test(line)).length;
  const operators = (text.match(/[=+×÷∑√<>≤≥≈^]/g) || []).length;
  const nonTextRatio = chars.length ? (symbols + Math.max(0, digits - letters)) / chars.length : 0;
  const previous = input.before?.[input.before.length - 1];
  const next = input.after?.[0];
  const neighborBody = [previous, next].filter((item) => item?.kind === "body").length;
  const distinctSignals = [
    bullets > 0 || enumerated > 0,
    tableSeparators > 0 || wideGaps > 0,
    operators >= 2,
    /^["“‘'«]|^[-–—]\s/u.test(text),
  ].filter(Boolean).length;

  return {
    source_heading: input.layout?.kind === "heading" ? 1 : 0,
    short: words.length <= 14 ? 1 : 0,
    isolated: input.layout?.isolated || (words.length <= 14 && neighborBody > 0) ? 1 : 0,
    no_terminal: terminalCount === 0 ? 1 : 0,
    chapter_context: previous?.kind === "heading" || next?.kind === "heading" ? 1 : 0,
    all_caps: letters >= 3 && text === text.toLocaleUpperCase() ? 1 : 0,
    bullet: lines.length ? bullets / lines.length : 0,
    enumerated: lines.length ? enumerated / lines.length : 0,
    multi_line: lines.length > 1 ? Math.min(1, lines.length / 4) : 0,
    table_separator: Math.min(1, tableSeparators / Math.max(1, lines.length * 2)),
    wide_gap: lines.length ? wideGaps / lines.length : 0,
    operator_density:
      operators >= 2 ? 1 : Math.min(1, operators / Math.max(1, words.length)),
    dialogue_open: /^["“‘'«]|^[-–—]\s/u.test(text) ? 1 : 0,
    prose_length: Math.min(1, words.length / 35),
    sentence_density: Math.min(1, terminalCount / Math.max(1, words.length / 18)),
    artifact_density: Math.max(nonTextRatio, letters === 0 && chars.length > 3 ? 1 : 0),
    mixed_structure: Math.min(1, distinctSignals / 3),
  };
}

function scoreFor(kind: TextStructure, features: Record<FeatureName, number>): number {
  const bias = kind === "prose" ? 0.9 : kind === "unknown" ? 0.15 : 0;
  return (Object.entries(WEIGHTS[kind]) as Array<[FeatureName, number]>).reduce(
    (score, [feature, weight]) => score + features[feature] * weight,
    bias
  );
}

function isLetter(value: string): boolean {
  return /\p{L}/u.test(value);
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
