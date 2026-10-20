import { TTSProvider } from "./TTSProvider";
import { DeviceTTSProvider } from "./DeviceTTSProvider";
import { LocalNeuralTTSProvider } from "./LocalNeuralTTSProvider";

/**
 * Single switch for the whole app's voice engine.
 *
 * Safe default is "device" so an omitted argument never spends OpenAI credit.
 * Both providers run on the phone. Cloud synthesis is no longer offered.
 */
export type TTSKind = "device" | "local";

export const ACTIVE_TTS: TTSKind = "device";

export function createTTSProvider(kind: TTSKind = ACTIVE_TTS): TTSProvider {
  switch (kind) {
    case "local":
      return new LocalNeuralTTSProvider();
    case "device":
    default:
      return new DeviceTTSProvider();
  }
}

export type { TTSProvider } from "./TTSProvider";
