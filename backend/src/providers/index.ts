import { AIProvider } from "./AIProvider";
import { OpenAIProvider } from "./OpenAIProvider";

/**
 * Factory: choosing a provider is a single decision here.
 * To switch to Claude/Ollama later, add a case and a new implementation file.
 */
export function createAIProvider(): AIProvider {
  const which = (process.env.AI_PROVIDER || "openai").toLowerCase();

  switch (which) {
    case "openai":
    default: {
      const key = process.env.OPENAI_API_KEY;
      if (!key) {
        throw new Error("OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.");
      }
      return new OpenAIProvider(key, process.env.OPENAI_MODEL || "gpt-5.4-nano");
    }
    // case "claude": return new ClaudeProvider(...);
    // case "ollama": return new LocalOllamaProvider(...);
  }
}
