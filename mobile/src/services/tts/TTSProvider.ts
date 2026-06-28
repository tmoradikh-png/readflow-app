/**
 * TTSProvider — the ONLY place the app knows about a voice engine.
 *
 * Today: DeviceTTSProvider (free, on-device, expo-speech).
 * Later: CloudTTSProvider (OpenAI/ElevenLabs/Azure) — switching is a single
 * line in ./index.ts, no Reader/UI changes required.
 */

export interface SpeakOptions {
  language?: string; // BCP-47, e.g. "en-US"
  rate?: number; // 1.0 = normal
  pitch?: number;
  onStart?: () => void;
  onProgress?: (progress: { currentTime: number; duration: number }) => void;
  onDone?: () => void;
  onError?: (e?: unknown) => void;
}

export interface TTSProvider {
  readonly kind: "device" | "cloud";
  /** Speak one piece of text. Resolves when speaking starts (not when done). */
  speak(text: string, opts: SpeakOptions): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  /** Optional: warm the cache for upcoming text so playback has no gap. */
  prefetch?(text: string, opts: SpeakOptions): Promise<void>;
  /** List available voices (may be empty on some platforms). */
  getVoices?(): Promise<{ id: string; name: string; language: string }[]>;
}
