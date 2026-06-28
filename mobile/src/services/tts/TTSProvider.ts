/**
 * TTSProvider — the ONLY place the app knows about a voice engine.
 *
 * Today: DeviceTTSProvider (free), CloudTTSProvider (capped paid), and
 * LocalNeuralTTSProvider (downloaded on-device model).
 */

export interface SpeakOptions {
  language?: string; // BCP-47, e.g. "en-US"
  rate?: number; // 1.0 = normal
  pitch?: number;
  onStart?: () => void;
  onProgress?: (progress: { currentTime: number; duration: number }) => void;
  onDone?: () => void;
  onError?: (e?: unknown) => void;
  /** Metadata shown by providers that support lock-screen controls. */
  lockScreenTitle?: string;
  lockScreenSubtitle?: string;
  lockScreenAlbum?: string;
  /** Provider-specific voice identifier. Device uses OS voice ids; cloud uses OpenAI voice ids. */
  voiceId?: string;
  /** Device voice to use if a paid/cloud provider falls back locally. */
  fallbackVoiceId?: string;
  /** Called when a provider keeps reading by falling back to a cheaper/local voice. */
  onFallback?: (info: {
    reason: "quota" | "network" | "error" | "local_unavailable";
    message?: string;
  }) => void;
}

export interface TTSProvider {
  readonly kind: "device" | "cloud" | "local";
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
