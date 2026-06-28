import { TTSProvider } from "./TTSProvider";
import { DeviceTTSProvider } from "./DeviceTTSProvider";
import { CloudTTSProvider } from "./CloudTTSProvider";

/**
 * Single switch for the whole app's voice engine.
 *
 * Safe default is "device" so an omitted argument never spends OpenAI credit.
 * Reader passes "cloud" explicitly only when the paid cloudVoice entitlement and
 * allowance are active.
 */
export type TTSKind = "device" | "cloud";

export const ACTIVE_TTS: TTSKind = "device";

export function createTTSProvider(kind: TTSKind = ACTIVE_TTS): TTSProvider {
  switch (kind) {
    case "cloud":
      return new CloudTTSProvider();
    case "device":
    default:
      return new DeviceTTSProvider();
  }
}

export type { TTSProvider } from "./TTSProvider";
