import { API_BASE, apiHeaders } from "../../config";
import {
  OnlineTextIntelligenceFallback,
  SpeakableText,
  TextIntelligenceInput,
  TextStructure,
} from "./types";

/** Optional paid fallback. The default reader engine does not enable it. */
export class BackendTextIntelligenceFallback implements OnlineTextIntelligenceFallback {
  readonly id = "readflow-backend-text-intelligence-v1";

  async prepare(input: TextIntelligenceInput, local: SpeakableText) {
    const response = await fetch(`${API_BASE}/api/text-intelligence`, {
      method: "POST",
      headers: apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        rawText: input.rawText,
        before: (input.before || []).slice(-2),
        after: (input.after || []).slice(0, 2),
        layout: input.layout,
        language: input.language,
        localStructure: local.structure,
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      text?: string;
      structure?: TextStructure;
      confidence?: number;
      language?: string;
    };
    if (!data.text || typeof data.text !== "string") return null;
    return {
      text: data.text,
      structure: data.structure,
      confidence: Math.max(0, Math.min(1, Number(data.confidence) || 0)),
      language: data.language,
    };
  }
}
