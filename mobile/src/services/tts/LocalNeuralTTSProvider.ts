import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { SpeakOptions, TTSProvider } from "./TTSProvider";
import {
  getLocalNeuralModelPath,
  LOCAL_NEURAL_MODEL_ID,
  LOCAL_NEURAL_MODEL_NAME,
  LOCAL_NEURAL_MODEL_TYPE,
  LOCAL_NEURAL_SPEAKER_ID,
  LOCAL_NEURAL_VOICE_ID,
} from "../LocalNeuralVoice";
import type { GeneratedAudio, TtsEngine } from "react-native-sherpa-onnx/tts";
import {
  buildLocalSpeechSegments,
  normalizeLocalSpeechText,
} from "../SpeechNormalization";

let audioModeBackground: boolean | null = null;
const LOCAL_TTS_RENDER_VERSION = "stitched0.2";
// Sentence/clause silence is stitched into PCM below. Disable model-controlled
// sentence gaps so pauses do not vary with punctuation or stack twice.
// Supertonic requires a positive engine-level value while it constructs its
// native OfflineTts instance. Passing zero there can return a null native
// handle and crash when the wrapper immediately reads its sample rate. Speech
// segments contain no terminal punctuation, and their generation-level scale
// stays at zero, so the fixed PCM pauses below remain the only audible gaps.
const LOCAL_TTS_ENGINE_SILENCE_SCALE = 0.2;
const LOCAL_TTS_SEGMENT_SILENCE_SCALE = 0;
const LOCAL_TTS_PARAGRAPH_PAUSE_MS = 360;

async function ensureAudioMode(allowBackgroundPlayback = false) {
  if (audioModeBackground === allowBackgroundPlayback) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: allowBackgroundPlayback,
      interruptionMode: "duckOthers",
    });
    audioModeBackground = allowBackgroundPlayback;
  } catch {
    /* non-fatal */
  }
}

export class LocalNeuralTTSProvider implements TTSProvider {
  readonly kind = "local" as const;

  private player: AudioPlayer | null = null;
  private seq = 0;
  private enginePromise: Promise<TtsEngine> | null = null;
  private generationQueue: Promise<unknown> = Promise.resolve();
  private dir = (FileSystem.cacheDirectory || "") + "local-ai-tts/";
  private dirReady = false;
  private fileCache = new Map<string, string>();
  private inflightCache = new Map<string, Promise<string>>();
  private removeListener: (() => void) | null = null;
  private finishTimer: ReturnType<typeof setTimeout> | null = null;
  private prefetchTimers: ReturnType<typeof setTimeout>[] = [];

  private keyFor(text: string, speed: number) {
    return `${LOCAL_NEURAL_MODEL_ID}|${LOCAL_TTS_RENDER_VERSION}|${speed.toFixed(2)}|${text}`;
  }

  private async getEngine(): Promise<TtsEngine> {
    if (this.enginePromise) return this.enginePromise;
    this.enginePromise = this.createEngine().catch((error) => {
      this.enginePromise = null;
      throw error;
    });
    return this.enginePromise;
  }

  private async createEngine(): Promise<TtsEngine> {
    const modelPath = await getLocalNeuralModelPath();
    const { createTTS } = await import("react-native-sherpa-onnx/tts");
    return createTTS({
      modelPath: { type: "file", path: modelPath },
      modelType: LOCAL_NEURAL_MODEL_TYPE,
      provider: "cpu",
      numThreads: 3,
      maxNumSentences: 1,
      silenceScale: LOCAL_TTS_ENGINE_SILENCE_SCALE,
    });
  }

  private async fetchAudio(text: string, speed: number): Promise<string> {
    const key = this.keyFor(text, speed);
    const cached = this.fileCache.get(key);
    if (cached) return cached;

    const inflight = this.inflightCache.get(key);
    if (inflight) return inflight;

    const pending = this.runGeneration(() => this.generateAudio(key, text, speed)).finally(() => {
      this.inflightCache.delete(key);
    });
    this.inflightCache.set(key, pending);
    return pending;
  }

  private runGeneration<T>(work: () => Promise<T>): Promise<T> {
    const next = this.generationQueue.then(work, work);
    this.generationQueue = next.catch(() => {});
    return next;
  }

  private async generateAudio(key: string, text: string, speed: number): Promise<string> {
    const cached = this.fileCache.get(key);
    if (cached) return cached;

    const engine = await this.getEngine();
    const { saveAudioToFile } = await import("react-native-sherpa-onnx/tts");

    if (!this.dirReady) {
      await FileSystem.makeDirectoryAsync(this.dir, { intermediates: true }).catch(() => {});
      this.dirReady = true;
    }

    const uri = `${this.dir}${hashKey(key)}.wav`;
    const existing = await FileSystem.getInfoAsync(uri).catch(() => ({ exists: false }));
    if (existing.exists) {
      this.fileCache.set(key, uri);
      return uri;
    }

    const audio = await generateStitchedParagraph(engine, text, speed);
    const saved = await saveAudioToFile(audio, toNativePath(uri));
    const fileUri = toFileUri(saved || uri);
    this.fileCache.set(key, fileUri);
    return fileUri;
  }

  async prefetch(text: string, opts: SpeakOptions): Promise<void> {
    const t = normalizeLocalSpeechText(text);
    if (!t) return;

    const timer = setTimeout(() => {
      this.prefetchTimers = this.prefetchTimers.filter((item) => item !== timer);
      this.fetchAudio(t, clampSpeed(opts.rate)).catch(() => {});
    }, 120);
    this.prefetchTimers.push(timer);
  }

  async speak(text: string, opts: SpeakOptions): Promise<void> {
    const mySeq = ++this.seq;
    const speed = clampSpeed(opts.rate);
    const rawText = (text || "").trim();
    const t = normalizeLocalSpeechText(rawText);
    if (!t) {
      opts.onDone?.();
      return;
    }

    await ensureAudioMode(Boolean(opts.allowBackgroundPlayback));

    let uri: string;
    try {
      uri = await this.fetchAudio(t, speed);
    } catch (e) {
      if (mySeq !== this.seq) return;
      opts.onFallback?.({
        reason: "local_unavailable",
        message: "rF AI is not ready on this phone. Download rF AI before using this voice.",
      });
      opts.onError?.(e);
      return;
    }
    if (mySeq !== this.seq) return;

    try {
      this.clearFinishTimer();
      this.removeListener?.();
      this.removeListener = null;
      const reusablePlayer = this.player && !this.player.playing ? this.player : null;
      if (!reusablePlayer) this.releasePlayer();

      const player =
        reusablePlayer ||
        createAudioPlayer(uri, {
          updateInterval: 40,
          keepAudioSessionActive: true,
        });
      if (reusablePlayer) reusablePlayer.replace(uri);
      this.player = player;

      let started = false;
      let finished = false;

      const finish = () => {
        if (mySeq !== this.seq) return;
        if (!started || finished) return;
        finished = true;
        this.removeListener?.();
        this.removeListener = null;
        this.clearFinishTimer();
        this.finishTimer = setTimeout(() => {
          if (mySeq !== this.seq) return;
          this.finishTimer = null;
          opts.onDone?.();
        }, tailGuardMs(speed));
      };

      const sub = player.addListener("playbackStatusUpdate", (status) => {
        if (mySeq !== this.seq) return;
        if (status.playing) started = true;
        const duration = Number(status.duration || 0);
        const currentTime = Number(status.currentTime || 0);
        if (duration > 0 && currentTime >= 0) {
          opts.onProgress?.({
            currentTime: Math.min(currentTime, duration),
            duration,
          });
        }
        if (status.didJustFinish) finish();
      });
      this.removeListener = () => sub.remove();

      try {
        const metadata = {
          title: opts.lockScreenTitle || "readFlow",
          artist: opts.lockScreenSubtitle || "rF AI",
          albumTitle: opts.lockScreenAlbum || "readFlow",
        };
        player.setActiveForLockScreen(
          true,
          { ...metadata },
          {
            showSeekBackward: false,
            showSeekForward: false,
          }
        );
        player.updateLockScreenMetadata(metadata);
      } catch {
        /* lock-screen controls are best-effort */
      }

      player.play();
      started = true;
      opts.onStart?.();
    } catch (e) {
      if (mySeq !== this.seq) return;
      opts.onFallback?.({
        reason: "local_unavailable",
        message: "rF AI could not play on this phone. Use Phone voice or Cloud AI on an eligible plan for now.",
      });
      opts.onError?.(e);
      return;
    }
  }

  async stop(): Promise<void> {
    this.seq++;
    this.clearPrefetchTimers();
    this.clearFinishTimer();
    this.removeListener?.();
    this.removeListener = null;
    try {
      this.player?.clearLockScreenControls();
    } catch {}
    this.releasePlayer();
  }

  async pause(): Promise<void> {
    this.seq++;
    this.clearPrefetchTimers();
    this.clearFinishTimer();
    this.removeListener?.();
    this.removeListener = null;
    try {
      this.player?.pause();
    } catch {}
  }

  async resume(): Promise<void> {
    try {
      this.player?.play();
    } catch {}
  }

  async getVoices() {
    return [
      {
        id: LOCAL_NEURAL_VOICE_ID,
        name: `rF AI - ${LOCAL_NEURAL_MODEL_NAME}`,
        language: "en-US",
      },
    ];
  }

  private clearPrefetchTimers() {
    this.prefetchTimers.forEach((timer) => clearTimeout(timer));
    this.prefetchTimers = [];
  }

  private clearFinishTimer() {
    if (!this.finishTimer) return;
    clearTimeout(this.finishTimer);
    this.finishTimer = null;
  }

  private releasePlayer(player = this.player) {
    try {
      player?.pause();
    } catch {}
    try {
      player?.remove();
    } catch {}
    if (player === this.player) this.player = null;
  }
}

function clampSpeed(rate?: number): number {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return 1;
  return Math.min(2, Math.max(0.6, r));
}

function tailGuardMs(speed: number): number {
  return Math.round(Math.max(80, Math.min(180, 140 / speed)));
}

function toNativePath(uri: string): string {
  return uri.startsWith("file://") ? uri.slice(7) : uri;
}

function toFileUri(path: string): string {
  return path.startsWith("file://") ? path : `file://${path}`;
}

function hashKey(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

async function generateStitchedParagraph(
  engine: TtsEngine,
  text: string,
  speed: number
): Promise<GeneratedAudio> {
  const segments = buildLocalSpeechSegments(text);
  if (!segments.length) return { samples: [], sampleRate: 0 };

  const samples: number[] = [];
  let sampleRate = 0;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    const audio = await engine.generateSpeech(segment.text, {
      sid: LOCAL_NEURAL_SPEAKER_ID,
      speed,
      silenceScale: LOCAL_TTS_SEGMENT_SILENCE_SCALE,
    });
    if (!sampleRate) sampleRate = audio.sampleRate;
    if (!audio.sampleRate || audio.sampleRate !== sampleRate) {
      throw new Error("rF AI returned inconsistent audio sample rates.");
    }

    appendSamples(samples, trimGeneratedSilence(audio.samples, sampleRate));
    const pauseMs =
      index === segments.length - 1
        ? Math.max(segment.pauseAfterMs, LOCAL_TTS_PARAGRAPH_PAUSE_MS)
        : segment.pauseAfterMs;
    appendSilence(samples, sampleRate, pauseMs);
  }
  return { samples, sampleRate };
}

function trimGeneratedSilence(source: number[], sampleRate: number): number[] {
  if (!source.length || sampleRate <= 0) return source;
  const threshold = 0.00015;
  let first = 0;
  let last = source.length - 1;
  while (first < source.length && Math.abs(source[first]) <= threshold) first++;
  while (last > first && Math.abs(source[last]) <= threshold) last--;
  if (first >= source.length) return [];

  const edge = Math.max(1, Math.round(sampleRate * 0.025));
  return source.slice(Math.max(0, first - edge), Math.min(source.length, last + edge + 1));
}

function appendSamples(target: number[], source: number[]) {
  // Avoid spreading large PCM arrays, which can exceed the JavaScript call
  // stack on long paragraphs.
  for (let index = 0; index < source.length; index++) target.push(source[index]);
}

function appendSilence(target: number[], sampleRate: number, milliseconds: number) {
  const count = Math.max(0, Math.round((sampleRate * milliseconds) / 1000));
  for (let index = 0; index < count; index++) target.push(0);
}
