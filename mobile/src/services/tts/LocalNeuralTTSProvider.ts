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
const LOCAL_TTS_RENDER_VERSION = "segments0.6";
// Sentence/clause silence is stitched into PCM below. Disable model-controlled
// sentence gaps so pauses do not vary with punctuation or stack twice.
// Supertonic requires a positive engine-level value while it constructs its
// native OfflineTts instance. Passing zero there can return a null native
// handle and crash when the wrapper immediately reads its sample rate. Speech
// segments contain no terminal punctuation, and their generation-level scale
// stays at zero, so the fixed PCM pauses below remain the only audible gaps.
const LOCAL_TTS_ENGINE_SILENCE_SCALE = 0.2;
const LOCAL_TTS_SEGMENT_SILENCE_SCALE = 0;
const LOCAL_TTS_DEFAULT_FINAL_PAUSE_MS = 240;
// Every generated non-final segment already ends with at least 85 ms of
// silence. Start the next ready player inside the final part of that silence
// instead of waiting for Expo's delayed didJustFinish callback.
const LOCAL_TTS_HANDOFF_LEAD_SECONDS = 0.05;

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
  private generationEpoch = 0;
  private disposePromise: Promise<void> | null = null;
  private dir = (FileSystem.cacheDirectory || "") + "local-ai-tts/";
  private dirReady = false;
  private fileCache = new Map<string, string>();
  private inflightCache = new Map<string, { epoch: number; promise: Promise<string> }>();
  private removeListener: (() => void) | null = null;
  private standbyPlayer: {
    index: number;
    uri: string;
    seq: number;
    player: AudioPlayer;
  } | null = null;
  private finishTimer: ReturnType<typeof setTimeout> | null = null;
  private playbackWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private prefetchTimers: ReturnType<typeof setTimeout>[] = [];

  private keyFor(text: string, speed: number, pauseAfterMs: number) {
    return `${LOCAL_NEURAL_MODEL_ID}|${LOCAL_TTS_RENDER_VERSION}|${speed.toFixed(2)}|${pauseAfterMs}|${text}`;
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

  private async fetchAudio(
    text: string,
    speed: number,
    pauseAfterMs: number,
    epoch = this.generationEpoch
  ): Promise<string> {
    this.assertGenerationCurrent(epoch);
    const key = this.keyFor(text, speed, pauseAfterMs);
    const cached = this.fileCache.get(key);
    if (cached) return cached;

    const inflight = this.inflightCache.get(key);
    if (inflight?.epoch === epoch) return inflight.promise;

    let pending!: Promise<string>;
    pending = this.runGeneration(
      () => this.generateAudio(key, text, speed, pauseAfterMs, epoch),
      epoch
    ).finally(() => {
      if (this.inflightCache.get(key)?.promise === pending) this.inflightCache.delete(key);
    });
    this.inflightCache.set(key, { epoch, promise: pending });
    return pending;
  }

  private runGeneration<T>(work: () => Promise<T>, epoch: number): Promise<T> {
    const guardedWork = () => {
      this.assertGenerationCurrent(epoch);
      return work();
    };
    const next = this.generationQueue.then(guardedWork, guardedWork);
    this.generationQueue = next.catch(() => {});
    return next;
  }

  private async generateAudio(
    key: string,
    text: string,
    speed: number,
    pauseAfterMs: number,
    epoch: number
  ): Promise<string> {
    this.assertGenerationCurrent(epoch);
    const cached = this.fileCache.get(key);
    if (cached) return cached;

    const engine = await this.getEngine();
    this.assertGenerationCurrent(epoch);
    const { saveAudioToFile } = await import("react-native-sherpa-onnx/tts");

    if (!this.dirReady) {
      await FileSystem.makeDirectoryAsync(this.dir, { intermediates: true }).catch(() => {});
      this.dirReady = true;
    }

    const uri = `${this.dir}${hashKey(key)}.wav`;
    const existing = await FileSystem.getInfoAsync(uri).catch(() => ({ exists: false }));
    if (existing.exists) {
      this.assertGenerationCurrent(epoch);
      this.fileCache.set(key, uri);
      return uri;
    }

    const audio = await generateSpeechSegment(
      engine,
      text,
      speed,
      pauseAfterMs,
      () => epoch === this.generationEpoch
    );
    this.assertGenerationCurrent(epoch);
    const saved = await saveAudioToFile(audio, toNativePath(uri));
    this.assertGenerationCurrent(epoch);
    const fileUri = toFileUri(saved || uri);
    this.fileCache.set(key, fileUri);
    return fileUri;
  }

  async prefetch(text: string, opts: SpeakOptions): Promise<void> {
    const t = normalizeLocalSpeechText(text);
    if (!t) return;
    const epoch = this.generationEpoch;
    const segments = playbackSegments(t, opts.finalPauseMs);

    const timer = setTimeout(() => {
      this.prefetchTimers = this.prefetchTimers.filter((item) => item !== timer);
      for (const segment of segments) {
        void this.fetchAudio(
          segment.text,
          clampSpeed(opts.rate),
          segment.pauseAfterMs,
          epoch
        ).catch(() => {});
      }
    }, 120);
    this.prefetchTimers.push(timer);
  }

  async speak(text: string, opts: SpeakOptions): Promise<void> {
    const mySeq = ++this.seq;
    const generationEpoch = this.generationEpoch;
    const speed = clampSpeed(opts.rate);
    const rawText = (text || "").trim();
    const t = normalizeLocalSpeechText(rawText);
    if (!t) {
      opts.onDone?.();
      return;
    }
    const segments = playbackSegments(t, opts.finalPauseMs);
    if (!segments.length) {
      opts.onDone?.();
      return;
    }

    await ensureAudioMode(Boolean(opts.allowBackgroundPlayback));
    this.clearFinishTimer();
    this.clearPlaybackWatchdog();
    this.removeListener?.();
    this.removeListener = null;
    this.releaseStandbyPlayer();

    // Queue every sentence in this reading unit before future prefetch work can
    // enter the native engine. Playback starts as soon as sentence one is ready;
    // the remaining sentences render while it is being heard.
    const audioResults = segments.map(async (segment) => {
      try {
        return {
          uri: await this.fetchAudio(
            segment.text,
            speed,
            segment.pauseAfterMs,
            generationEpoch
          ),
        } as const;
      } catch (error) {
        return { error } as const;
      }
    });
    const totalWeight = Math.max(
      1,
      segments.reduce((total, segment) => total + segment.text.length, 0)
    );
    let completedWeight = 0;
    let completedSeconds = 0;
    let notifiedStart = false;
    let standbyIndex = -1;
    let standbyPromise: Promise<void> | null = null;

    const fail = (error: unknown) => {
      if (mySeq !== this.seq || error instanceof GenerationCancelledError) return;
      opts.onFallback?.({
        reason: "local_unavailable",
        message: "rF AI could not play on this phone. Use Phone voice or Cloud AI on an eligible plan for now.",
      });
      opts.onError?.(error);
    };

    const prepareStandby = (index: number) => {
      if (index < 0 || index >= segments.length || mySeq !== this.seq) return;
      standbyIndex = index;
      standbyPromise = (async () => {
        const result = await audioResults[index];
        if (mySeq !== this.seq || "error" in result) return;
        if (
          this.standbyPlayer?.seq === mySeq &&
          this.standbyPlayer.index === index &&
          this.standbyPlayer.uri === result.uri
        ) {
          return;
        }

        this.releaseStandbyPlayer();
        const player = createAudioPlayer(result.uri, {
          updateInterval: 40,
          keepAudioSessionActive: true,
        });
        if (mySeq !== this.seq) {
          this.releasePlayer(player);
          return;
        }
        this.standbyPlayer = { index, uri: result.uri, seq: mySeq, player };
      })();
    };

    const playSegment = async (index: number): Promise<void> => {
      const result = await audioResults[index];
      if (mySeq !== this.seq) return;
      if ("error" in result) {
        fail(result.error);
        return;
      }

      if (standbyIndex === index && standbyPromise) await standbyPromise;
      if (mySeq !== this.seq) return;

      try {
        this.clearFinishTimer();
        this.removeListener?.();
        this.removeListener = null;
        const outgoingPlayer = this.player;
        const standbyPlayer = this.takeStandbyPlayer(index, result.uri, mySeq);
        const reusablePlayer =
          !standbyPlayer && outgoingPlayer && !outgoingPlayer.playing
            ? outgoingPlayer
            : null;
        let outgoingReleased = false;
        if (!standbyPlayer && !reusablePlayer) {
          this.releasePlayer(outgoingPlayer);
          outgoingReleased = true;
        }

        const player =
          standbyPlayer ||
          reusablePlayer ||
          createAudioPlayer(result.uri, {
            updateInterval: 40,
            keepAudioSessionActive: true,
          });
        if (reusablePlayer) reusablePlayer.replace(result.uri);
        this.player = player;

        let started = false;
        let finished = false;
        let segmentDuration = 0;
        let lastProgressAt = Date.now();
        let lastCurrentTime = -1;
        const segmentWeight = Math.max(1, segments[index].text.length);
        const finish = () => {
          if (mySeq !== this.seq || !started || finished) return;
          finished = true;
          this.clearPlaybackWatchdog();
          this.removeListener?.();
          this.removeListener = null;
          completedSeconds += segmentDuration;
          completedWeight += segmentWeight;

          if (index + 1 < segments.length) {
            void playSegment(index + 1);
            return;
          }
          this.clearFinishTimer();
          this.finishTimer = setTimeout(() => {
            if (mySeq !== this.seq) return;
            this.finishTimer = null;
            opts.onDone?.();
          }, tailGuardMs(speed));
        };

        const armPlaybackWatchdog = () => {
          this.clearPlaybackWatchdog();
          this.playbackWatchdogTimer = setTimeout(() => {
            this.playbackWatchdogTimer = null;
            if (mySeq !== this.seq || finished) return;
            const nativeCurrent = Number(player.currentTime || 0);
            const nativeDuration = Number(player.duration || segmentDuration || 0);
            if (nativeCurrent > lastCurrentTime + 0.01) {
              lastCurrentTime = nativeCurrent;
              lastProgressAt = Date.now();
            }
            if (nativeDuration > 0 && nativeCurrent >= nativeDuration - 0.05) {
              finish();
              return;
            }
            if (Date.now() - lastProgressAt >= 6500) {
              fail(new Error("rF AI audio stopped responding."));
              return;
            }
            armPlaybackWatchdog();
          }, 7000);
        };

        const sub = player.addListener("playbackStatusUpdate", (status) => {
          if (mySeq !== this.seq) return;
          if (status.playing) started = true;
          const duration = Number(status.duration || 0);
          const currentTime = Number(status.currentTime || 0);
          if (currentTime > lastCurrentTime + 0.01) {
            lastCurrentTime = currentTime;
            lastProgressAt = Date.now();
          }
          if (duration > 0 && currentTime >= 0) {
            segmentDuration = duration;
            const segmentRatio = Math.max(0, Math.min(1, currentTime / duration));
            opts.onProgress?.({
              currentTime: completedSeconds + Math.min(currentTime, duration),
              duration: completedSeconds + duration,
              textRatio: Math.min(
                0.999,
                (completedWeight + segmentWeight * segmentRatio) / totalWeight
              ),
            });
          }
          if (
            index + 1 < segments.length &&
            duration > 0 &&
            currentTime >= Math.max(0, duration - LOCAL_TTS_HANDOFF_LEAD_SECONDS)
          ) {
            finish();
          } else if (status.didJustFinish) {
            finish();
          }
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
        armPlaybackWatchdog();
        if (outgoingPlayer && outgoingPlayer !== player && !outgoingReleased) {
          this.releasePlayer(outgoingPlayer);
        }
        prepareStandby(index + 1);
        if (!notifiedStart) {
          notifiedStart = true;
          opts.onStart?.();
        }
      } catch (error) {
        fail(error);
      }
    };

    await playSegment(0);
  }

  async stop(): Promise<void> {
    this.seq++;
    this.generationEpoch++;
    this.clearPrefetchTimers();
    this.clearFinishTimer();
    this.clearPlaybackWatchdog();
    this.removeListener?.();
    this.removeListener = null;
    this.releaseStandbyPlayer();
    try {
      this.player?.clearLockScreenControls();
    } catch {}
    this.releasePlayer();
  }

  async pause(): Promise<void> {
    this.seq++;
    this.generationEpoch++;
    this.clearPrefetchTimers();
    this.clearFinishTimer();
    this.clearPlaybackWatchdog();
    this.removeListener?.();
    this.removeListener = null;
    this.releaseStandbyPlayer();
    try {
      this.player?.pause();
    } catch {}
  }

  async resume(): Promise<void> {
    try {
      this.player?.play();
    } catch {}
  }

  async dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;

    this.disposePromise = (async () => {
      await this.stop();
      const enginePromise = this.enginePromise;
      this.enginePromise = null;

      // Native generation cannot be interrupted mid-call. Wait for the stale
      // job to return, then release the model before abandoning this provider.
      await this.generationQueue.catch(() => {});
      const engine = await enginePromise?.catch(() => null);
      await engine?.destroy().catch(() => {});
      this.inflightCache.clear();
      this.fileCache.clear();
    })();

    return this.disposePromise;
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

  private clearPlaybackWatchdog() {
    if (!this.playbackWatchdogTimer) return;
    clearTimeout(this.playbackWatchdogTimer);
    this.playbackWatchdogTimer = null;
  }

  private takeStandbyPlayer(index: number, uri: string, seq: number): AudioPlayer | null {
    const standby = this.standbyPlayer;
    if (!standby || standby.index !== index || standby.uri !== uri || standby.seq !== seq) {
      return null;
    }
    this.standbyPlayer = null;
    return standby.player;
  }

  private releaseStandbyPlayer() {
    const standby = this.standbyPlayer;
    this.standbyPlayer = null;
    if (standby) this.releasePlayer(standby.player);
  }

  private assertGenerationCurrent(epoch: number) {
    if (epoch !== this.generationEpoch) throw new GenerationCancelledError();
  }
}

class GenerationCancelledError extends Error {
  constructor() {
    super("rF AI generation cancelled");
    this.name = "GenerationCancelledError";
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

interface PlaybackSegment {
  text: string;
  pauseAfterMs: number;
}

function playbackSegments(text: string, finalPauseMs?: number): PlaybackSegment[] {
  const segments = buildLocalSpeechSegments(text);
  if (!segments.length) return [];

  const requestedFinalPause = Number(finalPauseMs);
  const finalPause = Number.isFinite(requestedFinalPause)
    ? Math.max(0, Math.round(requestedFinalPause))
    : LOCAL_TTS_DEFAULT_FINAL_PAUSE_MS;

  return segments.map((segment, index) => ({
    text: segment.text,
    pauseAfterMs:
      index === segments.length - 1
        ? Math.max(segment.pauseAfterMs, finalPause)
        : segment.pauseAfterMs,
  }));
}

async function generateSpeechSegment(
  engine: TtsEngine,
  text: string,
  speed: number,
  pauseAfterMs: number,
  shouldContinue: () => boolean
): Promise<GeneratedAudio> {
  if (!shouldContinue()) throw new GenerationCancelledError();
  const audio = await engine.generateSpeech(text, {
    sid: LOCAL_NEURAL_SPEAKER_ID,
    speed,
    silenceScale: LOCAL_TTS_SEGMENT_SILENCE_SCALE,
    extra: { lang: "en" },
  });
  if (!shouldContinue()) throw new GenerationCancelledError();
  if (!audio.sampleRate) throw new Error("rF AI returned invalid audio.");

  const samples = trimGeneratedSilence(audio.samples, audio.sampleRate);
  appendSilence(samples, audio.sampleRate, pauseAfterMs);
  return { samples, sampleRate: audio.sampleRate };
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

function appendSilence(target: number[], sampleRate: number, milliseconds: number) {
  const count = Math.max(0, Math.round((sampleRate * milliseconds) / 1000));
  for (let index = 0; index < count; index++) target.push(0);
}
