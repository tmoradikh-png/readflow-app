import OpenAI from "openai";
import {
  AIProvider,
  AIRequest,
  ExplainResult,
  SpeechPreparationRequest,
  SpeechPreparationResult,
} from "./AIProvider";

const SYSTEM_PROMPT = `You are readFlow, a reading assistant that helps people truly understand documents.
You do NOT just rephrase. You read with understanding: clarify intent, structure, and meaning.
Always respond in the requested language. Always return STRICT JSON matching the requested schema.
Keep language clear and friendly. Never invent facts that are not supported by the provided text.

The text may come from OCR of a scanned PDF, so it can contain noise. Focus ONLY on the
main body content. Ignore and do not summarize: image captions and legends under figures,
page numbers, running headers/footers, watermarks, table-of-contents dot leaders, repeated
boilerplate, and garbled OCR fragments. If a line looks like a caption, label, or scanning
artifact rather than real prose, skip it.`;

function buildUserPrompt(req: AIRequest): string {
  const lang = req.language || "en";
  const base = `Language: ${lang}\nTask: ${req.task}\n`;
  const schema = `Return JSON with keys: summary (string), simple_explanation (string), key_points (string[] up to 6), terms (array of {term, meaning} up to 5), answer (string, only for the "ask" task else empty).`;

  switch (req.task) {
    case "ask":
      return `${base}User question: ${req.question || ""}\n${schema}\n\nTEXT:\n${req.text}`;
    case "simplify":
      return `${base}Rewrite the meaning simply (aim for a 12-year-old) in "simple_explanation". ${schema}\n\nTEXT:\n${req.text}`;
    case "key_points":
      return `${base}Focus on extracting the most important key_points. ${schema}\n\nTEXT:\n${req.text}`;
    case "explain":
      return `${base}Explain what this passage means and why it matters. ${schema}\n\nTEXT:\n${req.text}`;
    case "summary":
    default:
      return `${base}Summarize concisely. ${schema}\n\nTEXT:\n${req.text}`;
  }
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-5.4-nano") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async run(req: AIRequest): Promise<ExplainResult & { answer?: string }> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(req) },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { summary: raw };
    }

    return {
      summary: parsed.summary || "",
      simple_explanation: parsed.simple_explanation || "",
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
      terms: Array.isArray(parsed.terms) ? parsed.terms : [],
      answer: parsed.answer || undefined,
    };
  }

  async prepareSpeech(req: SpeechPreparationRequest): Promise<SpeechPreparationResult> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You prepare extracted document text for text-to-speech. Return strict JSON with keys text, structure, confidence, language. Preserve every meaningful source word in the same order. Never summarize, paraphrase, simplify, translate, omit meaningful content, or invent words. You may only normalize visual separators, whitespace, punctuation, obvious OCR character noise, and pronunciation-oriented number or abbreviation forms. Use nearby text and layout only to interpret the current rawText. structure must be one of prose, heading, dialogue, list, table, formula, artifact, unknown. If uncertain, return rawText unchanged and low confidence.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            language: req.language || "und",
            layout: req.layout || {},
            localStructure: req.localStructure || {},
            before: (req.before || []).slice(-2),
            rawText: req.rawText,
            after: (req.after || []).slice(0, 2),
          }),
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw) as Partial<SpeechPreparationResult>;
    const structures = new Set([
      "prose",
      "heading",
      "dialogue",
      "list",
      "table",
      "formula",
      "artifact",
      "unknown",
    ]);
    return {
      text: typeof parsed.text === "string" ? parsed.text : req.rawText,
      structure: structures.has(parsed.structure || "")
        ? (parsed.structure as SpeechPreparationResult["structure"])
        : "unknown",
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      language: typeof parsed.language === "string" ? parsed.language : req.language,
    };
  }
}
