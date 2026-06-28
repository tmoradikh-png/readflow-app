import * as Speech from "expo-speech";
import { SpeakOptions, TTSProvider } from "./TTSProvider";

/**
 * Free, on-device voice using the OS speech engine.
 * Works offline, no API cost — perfect for MVP and the free tier.
 * Quality varies by device/language; cloud TTS is the upgrade path.
 */
export class DeviceTTSProvider implements TTSProvider {
  readonly kind = "device" as const;
  private progressTimer: ReturnType<typeof setInterval> | null = null;

  private clearProgressTimer() {
    if (!this.progressTimer) return;
    clearInterval(this.progressTimer);
    this.progressTimer = null;
  }

  async speak(text: string, opts: SpeakOptions): Promise<void> {
    this.clearProgressTimer();
    const duration = estimateDurationSeconds(text, opts.rate);
    const startedAt = Date.now();
    const emitProgress = () => {
      opts.onProgress?.({
        currentTime: Math.min((Date.now() - startedAt) / 1000, duration),
        duration,
      });
    };
    const finish = () => {
      this.clearProgressTimer();
      opts.onProgress?.({ currentTime: duration, duration });
      opts.onDone?.();
    };

    Speech.speak(text, {
      language: opts.language || "en-US",
      rate: opts.rate ?? 1.0,
      pitch: opts.pitch ?? 1.0,
      onStart: () => {
        opts.onStart?.();
        emitProgress();
        this.progressTimer = setInterval(emitProgress, 180);
      },
      onDone: finish,
      onStopped: finish, // treat manual stop as "done" for sequencing
      onError: (e) => {
        this.clearProgressTimer();
        opts.onError?.(e);
      },
    });
  }

  async stop(): Promise<void> {
    this.clearProgressTimer();
    await Speech.stop();
  }

  async pause(): Promise<void> {
    this.clearProgressTimer();
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

function estimateDurationSeconds(text: string, rate?: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length || 1;
  const r = Math.min(4, Math.max(0.25, Number(rate) || 1));
  const wordsPerMinute = 165 * r;
  return Math.max(0.75, (words / wordsPerMinute) * 60);
}
