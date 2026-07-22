import { CompactMultilingualModel } from "./CompactMultilingualModel";
import {
  alignOnlineText,
  deterministicSpeechPreparation,
  preservesLexicalContent,
} from "./DeterministicSpeechNormalizer";
import {
  LocalTextIntelligenceModel,
  OnlineTextIntelligenceFallback,
  SpeakableText,
  TextIntelligenceEngine,
  TextIntelligenceInput,
} from "./types";

const CACHE_LIMIT = 96;

export class HybridTextIntelligence implements TextIntelligenceEngine {
  readonly id = "readflow-hybrid-text-intelligence-v1";
  private cache = new Map<string, Promise<SpeakableText>>();

  constructor(
    private readonly localModel: LocalTextIntelligenceModel = new CompactMultilingualModel(),
    private readonly onlineFallback?: OnlineTextIntelligenceFallback
  ) {}

  prepare(input: TextIntelligenceInput): Promise<SpeakableText> {
    const key = cacheKey(input);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const prepared = this.prepareUncached(input).catch(() => identityFallback(input));
    this.cache.set(key, prepared);
    while (this.cache.size > CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    return prepared;
  }

  async prefetch(input: TextIntelligenceInput): Promise<void> {
    await this.prepare(input);
  }

  clear(): void {
    this.cache.clear();
  }

  private async prepareUncached(input: TextIntelligenceInput): Promise<SpeakableText> {
    const local = this.localModel.interpret(input);
    const deterministic = deterministicSpeechPreparation(input, local.structure);
    const needsFallback = Boolean(local.fallbackReason);
    let result: SpeakableText = {
      ...deterministic,
      confidence: local.confidence,
      fallback: {
        required: needsFallback,
        reason: local.fallbackReason,
        attemptedOnline: false,
        usedOnline: false,
      },
      provenance: ["deterministic", "local_context_model"],
    };

    if (!needsFallback || !input.allowOnlineFallback || !this.onlineFallback) return result;

    result = {
      ...result,
      fallback: { ...result.fallback, attemptedOnline: true },
    };
    try {
      const online = await this.onlineFallback.prepare(input, result);
      if (!online || !preservesLexicalContent(result.text, online.text)) return result;
      const aligned = alignOnlineText(
        { text: result.text, sourceOffsets: result.sourceOffsets },
        online.text
      );
      return {
        ...result,
        text: aligned.text,
        sourceOffsets: aligned.sourceOffsets,
        structure: online.structure
          ? { kind: online.structure, confidence: online.confidence, cues: ["online_context"] }
          : result.structure,
        confidence: Math.max(result.confidence, online.confidence),
        fallback: { ...result.fallback, required: false, usedOnline: true },
        provenance: [...result.provenance, "online_fallback"],
      };
    } catch {
      return result;
    }
  }
}

function identityFallback(input: TextIntelligenceInput): SpeakableText {
  const requested = input.language || "und";
  const primary = requested.toLowerCase().split(/[-_]/)[0] || "und";
  return {
    text: input.rawText,
    sourceOffsets: Array.from({ length: input.rawText.length }, (_, index) => index),
    boundaries: input.rawText
      ? [{ start: 0, end: input.rawText.length, kind: "sentence" }]
      : [],
    language: {
      requested,
      primary,
      scripts: [],
      mixed: false,
    },
    pronunciation: [],
    pauses: [],
    emphasis: [],
    structure: {
      kind: "unknown",
      confidence: 0,
      cues: ["identity_fallback"],
    },
    confidence: 0,
    fallback: {
      required: true,
      reason: "unsupported_pattern",
      attemptedOnline: false,
      usedOnline: false,
    },
    provenance: ["deterministic"],
  };
}

function cacheKey(input: TextIntelligenceInput): string {
  const before = (input.before || []).slice(-2).map((item) => `${item.kind}:${item.text}`).join("|");
  const after = (input.after || []).slice(0, 2).map((item) => `${item.kind}:${item.text}`).join("|");
  return [
    input.language || "und",
    input.layout?.source || "unknown",
    input.layout?.kind || "body",
    input.layout?.isolated ? "1" : "0",
    input.allowOnlineFallback ? "1" : "0",
    before,
    input.rawText,
    after,
  ].join("\u241f");
}
