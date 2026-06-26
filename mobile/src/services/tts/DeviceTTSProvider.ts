import * as Speech from "expo-speech";
import { SpeakOptions, TTSProvider } from "./TTSProvider";

/**
 * Free, on-device voice using the OS speech engine.
 * Works offline, no API cost — perfect for MVP and the free tier.
 * Quality varies by device/language; cloud TTS is the upgrade path.
 */
export class DeviceTTSProvider implements TTSProvider {
  readonly kind = "device" as const;

  async speak(text: string, opts: SpeakOptions): Promise<void> {
    Speech.speak(text, {
      language: opts.language || "en-US",
      rate: opts.rate ?? 1.0,
      pitch: opts.pitch ?? 1.0,
      onStart: opts.onStart,
      onDone: opts.onDone,
      onStopped: opts.onDone, // treat manual stop as "done" for sequencing
      onError: opts.onError,
    });
  }

  async stop(): Promise<void> {
    await Speech.stop();
  }

  async pause(): Promise<void> {
    // iOS supports pause/resume; Android falls back to stop.
    try {
      await Speech.pause();
    } catch {
      await Speech.stop();
    }
  }

  async resume(): Promise<void> {
    try {
      await Speech.resume();
    } catch {
      /* caller will re-speak current sentence on Android */
    }
  }

  async getVoices() {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.map((v) => ({ id: v.identifier, name: v.name, language: v.language }));
  }
}
