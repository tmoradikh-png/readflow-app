import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { SpeakOptions, TTSProvider } from "./TTSProvider";
import { DeviceTTSProvider } from "./DeviceTTSProvider";
import { API_BASE, apiHeaders } from "../../config";

/**
 * CloudTTSProvider — natural voice via OUR backend (POST /api/tts -> OpenAI).
 *
 * The OpenAI key never leaves the server. We fetch one short MP3 per sentence,
 * cache it on disk (so replays/taps are instant and free), and play it back
 * with expo-audio. If the network or backend fails we fall back to the free
 * on-device voice so reading never goes silent.
 */

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

export class CloudTTSProvider implements TTSProvider {
  readonly kind = "cloud" as const;

  private player: AudioPlayer | null = null;
  private device = new DeviceTTSProvider();
  private seq = 0; // invalidates stale playback callbacks
  private voice = "nova";
  private dir = (FileSystem.cacheDirectory || "") + "tts/";
  private dirReady = false;
  private fileCache = new Map<string, string>(); // key -> file uri
  private inflightCache = new Map<string, Promise<string>>(); // key -> pending file uri
  private fileId = 0;
  private removeListener: (() => void) | null = null;
  private finishTimer: ReturnType<typeof setTimeout> | null = null;

  private keyFor(text: string, speed: number) {
    return `${this.voice}|${speed.toFixed(2)}|${text}`;
  }

  /** Download (and cache) the audio for one piece of text. Returns a file uri. */
  private async fetchAudio(text: string, speed: number): Promise<string> {
    const key = this.keyFor(text, speed);
    const cached = this.fileCache.get(key);
    if (cached) return cached;

    const inflight = this.inflightCache.get(key);
    if (inflight) return inflight;

    const pending = this.downloadAudio(key, text, speed).finally(() => {
      this.inflightCache.delete(key);
    });
    this.inflightCache.set(key, pending);
    return pending;
  }

  private async downloadAudio(key: string, text: string, speed: number): Promise<string> {
    const res = await fetch(`${API_BASE}/api/tts`, {
      method: "POST",
      headers: apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ text, voice: this.voice, speed }),
    });
    if (!res.ok) {
      let msg = `TTS failed (${res.status})`;
      try {
        const j = await res.json();
        msg = j.error || msg;
      } catch {}
      throw new Error(msg);
    }

    const blob = await res.blob();
    const base64 = await blobToBase64(blob);
    if (!this.dirReady) {
      await FileSystem.makeDirectoryAsync(this.dir, { intermediates: true }).catch(() => {});
      this.dirReady = true;
    }
    const uri = `${this.dir}s_${this.fileId++}.mp3`;
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    this.fileCache.set(key, uri);
    return uri;
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

  /** Optional: warm the cache for the next sentence so playback has no gap. */
  async prefetch(text: string, opts: SpeakOptions): Promise<void> {
    const t = (text || "").trim();
    if (!t) return;
    try {
      await this.fetchAudio(t, clampSpeed(opts.rate));
    } catch {
      /* ignore prefetch errors */
    }
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
      // Cloud unavailable → keep reading with the on-device voice.
      if (mySeq !== this.seq) return;
      return this.device.speak(t, opts);
    }
    if (mySeq !== this.seq) return; // a newer speak()/stop() superseded us

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
        // Give the native audio output a small drain window before replacing
        // the clip. Without this, some devices drop the final word or two.
        this.clearFinishTimer();
        this.finishTimer = setTimeout(() => {
          if (mySeq !== this.seq) return;
          // Keep the finished player around so the next sentence can replace
          // its source instead of tearing down and creating a native player.
          // That trims paragraph gaps while the tail guard still protects the
          // final words from being cut off.
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
          artist: opts.lockScreenSubtitle || "Natural voice",
          albumTitle: opts.lockScreenAlbum || "ReadFlow",
        };
        player.setActiveForLockScreen(true, {
          ...metadata,
        }, {
          // Generated clips are short paragraph chunks. Play/pause is useful;
          // seek buttons add clutter and behave poorly across chunk handoffs.
          showSeekBackward: false,
          showSeekForward: false,
        });
        player.updateLockScreenMetadata(metadata);
      } catch {
        /* lock-screen controls are best-effort */
      }
      player.play();
      started = true;
      opts.onStart?.();
    } catch (e) {
      if (mySeq !== this.seq) return;
      return this.device.speak(t, opts);
    }
  }

  async stop(): Promise<void> {
    this.seq++;
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
}

function clampSpeed(rate?: number): number {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return 1;
  return Math.min(4, Math.max(0.25, r));
}

function tailGuardMs(speed: number): number {
  return Math.round(Math.max(180, Math.min(420, 360 / speed)));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read audio data."));
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}
