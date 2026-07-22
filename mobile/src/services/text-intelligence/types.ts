export type TextStructure =
  | "prose"
  | "heading"
  | "dialogue"
  | "list"
  | "table"
  | "formula"
  | "artifact"
  | "unknown";

export interface TextContextSegment {
  text: string;
  kind?: "body" | "heading";
  page?: number;
  paragraphIndex?: number;
}

export interface TextLayoutMetadata {
  source?: "native" | "ocr" | "docx" | "unknown";
  kind?: "body" | "heading";
  page?: number;
  paragraphIndex?: number;
  isolated?: boolean;
  columnCount?: number;
  fontScale?: number;
  isBold?: boolean;
}

export interface TextReadingPosition {
  page?: number;
  segmentIndex?: number;
  sourceOffset?: number;
}

export interface TextIntelligenceInput {
  /** Source-derived text. This value is never mutated or used for display. */
  rawText: string;
  before?: TextContextSegment[];
  after?: TextContextSegment[];
  layout?: TextLayoutMetadata;
  language?: string;
  position?: TextReadingPosition;
  /** Online fallback is opt-in because it can consume a paid AI allowance. */
  allowOnlineFallback?: boolean;
}

export interface SpeechBoundary {
  start: number;
  end: number;
  kind: "sentence" | "clause" | "item";
}

export interface SpeechPause {
  offset: number;
  durationMs: number;
  reason: "sentence" | "paragraph" | "heading" | "list_item" | "table_cell" | "dialogue";
}

export interface SpeechEmphasis {
  start: number;
  end: number;
  level: "reduced" | "moderate" | "strong";
  reason: "heading" | "dialogue" | "label";
}

export interface PronunciationHint {
  start: number;
  end: number;
  language: string;
  mode?: "word" | "letters" | "number" | "verbatim";
}

export interface LanguageInterpretation {
  requested: string;
  primary: string;
  scripts: string[];
  mixed: boolean;
}

export interface StructuralInterpretation {
  kind: TextStructure;
  confidence: number;
  cues: string[];
}

export interface FallbackDecision {
  required: boolean;
  reason?: "low_confidence" | "possible_ocr_artifact" | "mixed_structure" | "unsupported_pattern";
  attemptedOnline: boolean;
  usedOnline: boolean;
}

export interface SpeakableText {
  text: string;
  /** Source character offset for every character in `text`. */
  sourceOffsets: number[];
  boundaries: SpeechBoundary[];
  language: LanguageInterpretation;
  pronunciation: PronunciationHint[];
  pauses: SpeechPause[];
  emphasis: SpeechEmphasis[];
  structure: StructuralInterpretation;
  confidence: number;
  fallback: FallbackDecision;
  provenance: Array<"deterministic" | "local_context_model" | "online_fallback">;
}

export interface LocalTextInterpretation {
  structure: StructuralInterpretation;
  confidence: number;
  fallbackReason?: FallbackDecision["reason"];
}

export interface LocalTextIntelligenceModel {
  readonly id: string;
  interpret(input: TextIntelligenceInput): LocalTextInterpretation;
}

export interface OnlineTextIntelligenceFallback {
  readonly id: string;
  prepare(input: TextIntelligenceInput, local: SpeakableText): Promise<{
    text: string;
    structure?: TextStructure;
    confidence: number;
    language?: string;
  } | null>;
}

export interface TextIntelligenceEngine {
  readonly id: string;
  prepare(input: TextIntelligenceInput): Promise<SpeakableText>;
  prefetch?(input: TextIntelligenceInput): Promise<void>;
  clear?(): void;
}
