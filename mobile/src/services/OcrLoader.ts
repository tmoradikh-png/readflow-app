import { AppState, AppStateStatus } from "react-native";
import {
  PdfPage,
  PDFParser,
  isExpiredDocError,
  isNetworkError,
  isQuotaError,
} from "./PDFParser";
import { DocCache } from "./DocCache";

/**
 * OcrLoader — a GLOBAL background OCR engine.
 *
 * Unlike the old in-component loop, jobs live here (module scope) keyed by docId,
 * so OCR keeps running when you:
 *   - switch to another book (the previous book's job stays alive), or
 *   - leave the Reader for the Library.
 * When the app is sent to the background the OS suspends JS timers; the loop
 * pauses and automatically resumes the moment the app returns to the foreground.
 *
 * Each completed batch is merged into the job's page list and persisted to
 * DocCache, so progress is never lost and the book becomes fully offline-ready.
 */
export interface OcrProgress {
  docId: string;
  total: number; // pages that needed OCR when the job started
  done: number; // pages OCR'd so far
  pending: number; // pages still to do
  percent: number; // 0..100
  offline: boolean; // paused because the network dropped
  pausedReason?: "offline" | "quota" | "expired" | "error" | "user";
  message?: string;
  complete: boolean; // nothing left to OCR
  stopped?: boolean; // user cancelled this background OCR job
}

type Listener = (pages: PdfPage[], progress: OcrProgress) => void;

interface Job {
  docId: string;
  token: string;
  ocrLang?: string;
  pages: PdfPage[];
  pending: Set<number>;
  total: number;
  priority: number | null;
  running: boolean;
  pausedByUser: boolean;
  stopped: boolean;
  offline: boolean;
  pausedReason?: OcrProgress["pausedReason"];
  message?: string;
  retryTimer: ReturnType<typeof setTimeout> | null;
  listeners: Set<Listener>;
}

const BATCH = 1;
const GAP_MS = 120;

const jobs = new Map<string, Job>();
let appStateBound = false;

function bindAppState() {
  if (appStateBound) return;
  appStateBound = true;
  AppState.addEventListener("change", (s: AppStateStatus) => {
    if (s !== "active") return;
    // Resume anything that paused while we were backgrounded/offline.
    for (const job of jobs.values()) {
      if (job.pending.size > 0 && !job.running && !job.pausedByUser && !job.stopped && !job.pausedReason) {
        job.offline = false;
        void runLoop(job);
      }
    }
  });
}

function progressOf(job: Job): OcrProgress {
  const done = job.total - job.pending.size;
  return {
    docId: job.docId,
    total: job.total,
    done,
    pending: job.pending.size,
    percent: job.total > 0 ? Math.round((done / job.total) * 100) : 100,
    offline: job.offline,
    pausedReason: job.pausedByUser ? "user" : job.pausedReason,
    message: job.stopped
      ? "OCR stopped. Finished pages are saved; start Fix text again when you want to continue."
      : job.pausedByUser
      ? "OCR paused. Resume when you want readFlow to continue loading scanned pages."
      : job.message,
    complete: job.stopped || job.pending.size === 0,
    stopped: job.stopped,
  };
}

function notify(job: Job) {
  const p = progressOf(job);
  for (const l of job.listeners) {
    try {
      l(job.pages, p);
    } catch {
      /* a bad listener must not kill the loop */
    }
  }
}

function totalOcrWork(pages: PdfPage[], pending: number[]): number {
  const done = pages.filter((p) => p.source === "ocr" && p.text.trim().length > 0).length;
  return Math.max(pending.length + done, pending.length);
}

function mergePages(
  job: Job,
  improved: { page: number; text: string; confidence?: number }[]
) {
  const map = new Map(job.pages.map((p) => [p.page, p] as const));
  for (const r of improved) {
    const ex = map.get(r.page);
    if (r.text.trim()) {
      map.set(r.page, { ...ex, page: r.page, text: r.text, source: "ocr", confidence: r.confidence, footnoteStartLine: undefined });
    }
  }
  job.pages = Array.from(map.values()).sort((a, b) => a.page - b.page);
}

async function runLoop(job: Job) {
  if (job.running) return;
  job.running = true;
  bindAppState();
  try {
    while (job.pending.size > 0) {
      if (job.stopped || AppState.currentState !== "active") break;
      if (job.pausedByUser) {
        job.pausedReason = "user";
        job.message = "OCR paused. Resume when you want readFlow to continue loading scanned pages.";
        notify(job);
        break;
      }
      const focus = job.priority ?? 1;
      const want = [...job.pending]
        .sort((a, b) => Math.abs(a - focus) - Math.abs(b - focus) || a - b)
        .slice(0, BATCH);

      let results: { page: number; text: string; confidence?: number }[];
      try {
        results = await PDFParser.ocrPages(job.token, want, job.ocrLang);
      } catch (e) {
        job.pausedReason = "error";
        job.message = e instanceof Error ? e.message : "OCR could not process this page. Your completed pages are saved.";
        job.offline = false;
        notify(job);
        break;
      }
      if (job.stopped) break;

      for (const p of want) job.pending.delete(p);
      const improved = (results || []).filter((r) => r.text && r.text.trim().length > 0);
      if (improved.length > 0) mergePages(job, improved);
      if (job.priority != null && !job.pending.has(job.priority)) job.priority = null;
      job.offline = false;
      if (!job.pausedByUser) {
        job.pausedReason = undefined;
        job.message = undefined;
      }
      await DocCache.update(job.docId, job.pages, [...job.pending]);
      notify(job);
      await new Promise((r) => setTimeout(r, GAP_MS));
    }
  } finally {
    job.running = false;
    if (!job.stopped && job.pending.size === 0) notify(job);
  }
}

export const OcrLoader = {
  /** Register (or refresh) a document's OCR job and make sure it's running. */
  start(opts: {
    docId: string;
    token: string;
    ocrLang?: string;
    pages: PdfPage[];
    pending: number[];
  }): OcrProgress {
    let job = jobs.get(opts.docId);
    if (job?.running && job.ocrLang === opts.ocrLang && job.token === opts.token) return progressOf(job);
    if (job?.running) { job.stopped = true; jobs.delete(opts.docId); job = undefined; }
    if (!job) {
      job = {
        docId: opts.docId,
        token: opts.token,
        ocrLang: opts.ocrLang,
        pages: [...opts.pages],
        pending: new Set(opts.pending),
        total: totalOcrWork(opts.pages, opts.pending),
        priority: null,
        running: false,
        pausedByUser: false,
        stopped: false,
        offline: false,
        pausedReason: undefined,
        message: undefined,
        retryTimer: null,
        listeners: new Set(),
      };
      jobs.set(opts.docId, job);
    } else {
      // The token is the private source URI, not a server session.
      job.token = opts.token;
      job.stopped = false;
      if (opts.ocrLang) job.ocrLang = opts.ocrLang;
      job.pages = [...opts.pages];
      job.pending = new Set(opts.pending);
      job.total = Math.max(job.total, totalOcrWork(opts.pages, opts.pending));
      if (job.retryTimer) {
        clearTimeout(job.retryTimer);
        job.retryTimer = null;
      }
      if (!job.pausedByUser) {
        job.offline = false;
        job.pausedReason = undefined;
        job.message = undefined;
      }
    }
    if (job.pending.size > 0 && !job.pausedByUser) void runLoop(job);
    return progressOf(job);
  },

  stop(docId: string): OcrProgress | null {
    const job = jobs.get(docId);
    if (!job) return null;
    if (job.retryTimer) {
      clearTimeout(job.retryTimer);
      job.retryTimer = null;
    }
    job.stopped = true;
    job.pausedByUser = false;
    job.offline = false;
    job.pausedReason = undefined;
    job.message =
      "OCR stopped. Finished pages are saved; start Fix text again when you want to continue.";
    const progress = progressOf(job);
    notify(job);
    jobs.delete(docId);
    return progress;
  },

  pause(docId: string): OcrProgress | null {
    const job = jobs.get(docId);
    if (!job || job.pending.size === 0) return job ? progressOf(job) : null;
    if (job.retryTimer) {
      clearTimeout(job.retryTimer);
      job.retryTimer = null;
    }
    job.pausedByUser = true;
    job.offline = false;
    job.pausedReason = "user";
    job.message = "OCR paused. Resume when you want readFlow to continue loading scanned pages.";
    notify(job);
    return progressOf(job);
  },

  resume(docId: string): OcrProgress | null {
    const job = jobs.get(docId);
    if (!job) return null;
    job.pausedByUser = false;
    job.offline = false;
    job.pausedReason = undefined;
    job.message = undefined;
    notify(job);
    if (job.pending.size > 0 && !job.running) void runLoop(job);
    return progressOf(job);
  },

  togglePause(docId: string): OcrProgress | null {
    const job = jobs.get(docId);
    if (!job) return null;
    return job.pausedByUser ? this.resume(docId) : this.pause(docId);
  },

  /** Bias the next OCR batch toward a page (current view / go-to-page target). */
  setPriority(docId: string, page: number) {
    const job = jobs.get(docId);
    if (job) job.priority = page;
  },

  /**
   * Subscribe to a job's page + progress updates. Immediately pushes the current
   * snapshot. Returns an unsubscribe fn (the job keeps running after unsubscribe).
   */
  subscribe(docId: string, listener: Listener): () => void {
    const job = jobs.get(docId);
    if (!job) return () => {};
    job.listeners.add(listener);
    listener(job.pages, progressOf(job));
    return () => {
      job.listeners.delete(listener);
    };
  },

  progress(docId: string): OcrProgress | null {
    const job = jobs.get(docId);
    return job ? progressOf(job) : null;
  },
};
