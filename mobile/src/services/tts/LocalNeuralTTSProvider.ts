import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { DeviceTTSProvider } from "./DeviceTTSProvider";
import { SpeakOptions, TTSProvider } from "./TTSProvider";
import {
  getLocalNeuralModelPath,
  LOCAL_NEURAL_MODEL_ID,
  LOCAL_NEURAL_MODEL_NAME,
  LOCAL_NEURAL_MODEL_TYPE,
  LOCAL_NEURAL_SPEAKER_ID,
  LOCAL_NEURAL_VOICE_ID,
} from "../LocalNeuralVoice";
import type { TtsEngine } from "react-native-sherpa-onnx/tts";

let audioModeReady = false;
async function ensureAudioMode() {
  if (audioModeReady) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "duckOthers",
    });
  } catch {
    /* non-fatal */
  }
  audioModeReady = true;
}

export class LocalNeuralTTSProvider implements TTSProvider {
  readonly kind = "local" as const;

  private player: AudioPlayer | null = null;
  private device = new DeviceTTSProvider();
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
    return `${LOCAL_NEURAL_MODEL_ID}|${speed.toFixed(2)}|${text}`;
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
      maxNumSentences: 2,
      silenceScale: 0.1,
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

    const audio = await engine.generateSpeech(text, {
      sid: LOCAL_NEURAL_SPEAKER_ID,
      speed,
      silenceScale: 0.08,
    });
    const saved = await saveAudioToFile(audio, toNativePath(uri));
    const fileUri = toFileUri(saved || uri);
    this.fileCache.set(key, fileUri);
    return fileUri;
  }

  async prefetch(text: string, opts: SpeakOptions): Promise<void> {
    const t = (text || "").trim();
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
    const t = (text || "").trim();
    if (!t) {
      opts.onDone?.();
      return;
    }

    await ensureAudioMode();

    let uri: string;
    try {
      uri = await this.fetchAudio(t, speed);
    } catch (e) {
      if (mySeq !== this.seq) return;
      opts.onFallback?.({
        reason: "local_unavailable",
        message: "Local AI voice is not ready. Continuing with device voice.",
      });
      return this.device.speak(t, { ...opts, voiceId: opts.fallbackVoiceId });
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
          title: opts.lockScreenTitle || "ReadFlow",
          artist: opts.lockScreenSubtitle || "Local AI voice",
          albumTitle: opts.lockScreenAlbum || "ReadFlow",
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
        message: "Local AI voice could not play. Continuing with device voice.",
      });
      return this.device.speak(t, { ...opts, voiceId: opts.fallbackVoiceId });
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
    await this.device.stop();
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
    await this.device.pause();
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
        name: `Local AI - ${LOCAL_NEURAL_MODEL_NAME}`,
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
