/**
 * AIProvider — modular interface so we are NOT locked into one vendor.
 * MVP implements OpenAIProvider. Later: ClaudeProvider, LocalOllamaProvider.
 *
 * Rules followed here:
 *  - Only the needed chunk of text is sent, never the whole PDF.
 *  - Structured JSON output for consistency.
 *  - The interface is provider-agnostic.
 */

export interface ExplainResult {
  summary: string;
  simple_explanation: string;
  key_points: string[];
  terms: { term: string; meaning: string }[];
}

export type AITask =
  | "summary"
  | "explain"
  | "simplify"
  | "key_points"
  | "ask";

export interface AIRequest {
  task: AITask;
  /** The extracted text chunk (page/section/selection) to operate on. */
  text: string;
  /** Optional user question for the "ask" task. */
  question?: string;
  /** BCP-47 language hint, e.g. "en", "no". Output should match. */
  language?: string;
}

export interface AIProvider {
  readonly name: string;
  /** Returns structured fields. Implementations should return JSON-shaped data. */
  run(req: AIRequest): Promise<ExplainResult & { answer?: string }>;
}
