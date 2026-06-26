import { API_BASE, apiHeaders } from "../config";

export type AITask = "summary" | "explain" | "simplify" | "key_points" | "ask";

export interface AIResult {
  summary: string;
  simple_explanation: string;
  key_points: string[];
  terms: { term: string; meaning: string }[];
  answer?: string;
  cached?: boolean;
}

/**
 * AIProvider (client) — talks to OUR backend, never to OpenAI directly.
 * Caches results per request so repeated taps are instant and free.
 */
const memoryCache = new Map<string, AIResult>();

export const AIProvider = {
  async run(params: {
    task: AITask;
    text: string;
    question?: string;
    language?: string;
  }): Promise<AIResult> {
    const key = `${params.task}|${params.language || ""}|${params.question || ""}|${params.text.slice(0, 200)}|${params.text.length}`;
    const cached = memoryCache.get(key);
    if (cached) return cached;

    const res = await fetch(`${API_BASE}/api/ai`, {
      method: "POST",
      headers: apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      let msg = `AI request failed (${res.status})`;
      try {
        const j = await res.json();
        msg = j.error || msg;
      } catch {}
      throw new Error(msg);
    }

    const data = (await res.json()) as AIResult;
    memoryCache.set(key, data);
    return data;
  },
};
