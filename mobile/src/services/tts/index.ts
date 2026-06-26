import { TTSProvider } from "./TTSProvider";
import { DeviceTTSProvider } from "./DeviceTTSProvider";
import { CloudTTSProvider } from "./CloudTTSProvider";

/**
 * Single switch for the whole app's voice engine.
 *
 * MVP: "device" (free).
 * Launch: change to "cloud" once CloudTTSProvider is implemented.
 */
export type TTSKind = "device" | "cloud";

export const ACTIVE_TTS: TTSKind = "cloud";

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
