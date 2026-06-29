import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ViewToken,
  ListRenderItemInfo,
  BackHandler,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  useWindowDimensions,
} from "react-native";
import Constants from "expo-constants";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { ParsedPdf, PdfPage } from "../services/PDFParser";
import { OcrLoader, OcrProgress } from "../services/OcrLoader";
import { Sentence, TextReflow } from "../services/TextReflow";
import { Bookmark, Bookmarks } from "../services/Bookmarks";
import { createTTSProvider } from "../services/tts";
import { Controls, ReadingSettings } from "./Controls";
import { AIPanel } from "./AIPanel";
import { BookmarkPanel } from "./BookmarkPanel";
import { UpgradeSheet } from "./UpgradeSheet";
import { EntitlementSnapshot } from "../services/Entitlements";
import { ReadingPreferences, VoiceEngine } from "../services/Preferences";
import { getReadingLanguage } from "../services/ReadingLanguages";
import { theme } from "../theme";

interface Props {
  doc: ParsedPdf;
  entitlement: EntitlementSnapshot;
  preferences: ReadingPreferences;
  onPreferencesChange: (next: ReadingPreferences) => void;
  language?: string; // BCP-47, e.g. "en-US"
  /** Pages readable for free before the subscribe gate. */
  freePageLimit?: number;
  /** Sentence id to resume from (from the Library). */
  startSentenceId?: number;
  /** Reports the latest reading position so the Library can persist it. */
  onProgress?: (page: number, sentenceId: number, totalPages: number) => void;
  onBack: () => void;
}

interface LineRange {
  start: number;
  end: number;
}

interface ActiveLine {
  sentenceId: number | null;
  lineIndex: number;
}

interface LineSegment extends LineRange {
  text: string;
}

interface SpeechChunkSpan {
  sentence: Sentence;
  start: number;
  end: number;
  sourceStart: number;
}

interface SpeechChunk {
  text: string;
  spans: SpeechChunkSpan[];
  nextIndex: number;
  lastPage: number;
  lastWithin: number;
}

const ENFORCE_FREE_LIMIT = false;
const TTS_PREFETCH_AHEAD = 8;
const LOCAL_AI_PREFETCH_AHEAD = 6;
const LOCAL_AI_MAX_CHARS = 420;
const LOCAL_AI_MAX_SENTENCES = 2;
const KEEP_AWAKE_TAG = "readflow-reading";

type RuntimeVoiceMode = "natural" | "device" | "local";

function preferredVoiceMode(
  preferences: ReadingPreferences,
  entitlement: EntitlementSnapshot
): RuntimeVoiceMode {
  const readingLanguage = getReadingLanguage(preferences.bookLanguage);
  if (preferences.voiceEngine === "local_ai" && readingLanguage.edgeAi) {
    return "local";
  }
  if (
    preferences.voiceEngine === "cloud" &&
    readingLanguage.cloudAiVoice &&
    entitlement.features.cloudVoice &&
    entitlement.limits.cloudVoiceCharsPerMonth > 0
  ) {
    return "natural";
  }
  return "device";
}

function providerKindFor(mode: RuntimeVoiceMode): "device" | "cloud" | "local" {
  return mode === "natural" ? "cloud" : mode;
}

function voiceIdFor(mode: RuntimeVoiceMode, preferences: ReadingPreferences): string | undefined {
  if (mode === "natural") return preferences.cloudVoiceId;
  if (mode === "device") return preferences.deviceVoiceId;
  return undefined;
}

function voiceLabelFor(mode: RuntimeVoiceMode): string {
  if (mode === "natural") return "Cloud AI";
  if (mode === "local") return "Edge AI";
  return "Device voice";
}

export function Reader({
  doc,
  entitlement,
  preferences,
  onPreferencesChange,
  language = "en-US",
  freePageLimit = 10,
  startSentenceId = 0,
  onProgress,
  onBack,
}: Props) {
  // One continuous, globally-indexed sentence list (id === array index).
  // Pages are mutable so on-demand OCR can fill in scanned pages as you read.
  const [pages, setPages] = useState<PdfPage[]>(doc.pages);
  useEffect(() => {
    setPages(doc.pages);
  }, [doc]);
  const flat = useMemo<Sentence[]>(() => TextReflow.buildSentences(pages), [pages]);
  const totalPages = doc.pageCount || (flat.length ? flat[flat.length - 1].page : 1);
  const initialSentenceIndex = useMemo(() => {
    if (!flat.length) return 0;
    return Math.max(0, Math.min(startSentenceId, flat.length - 1));
  }, [flat.length, startSentenceId]);

  const [settings, setSettings] = useState<ReadingSettings>({
    fontSize: 22,
    lineSpacing: 1.5,
    speed: 1.0,
  });
  const lineHeight = Math.round(settings.fontSize * settings.lineSpacing);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [activeLine, setActiveLine] = useState<ActiveLine>({ sentenceId: null, lineIndex: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [immersive, setImmersive] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [voiceMode, setVoiceMode] = useState<RuntimeVoiceMode>(
    preferredVoiceMode(preferences, entitlement)
  );
  const [paywallTitle, setPaywallTitle] = useState("Paid feature");
  const [paywallBody, setPaywallBody] = useState(
    "This feature is available on paid plans. Free users can continue with local reading and device voice."
  );
  const [controlsOpen, setControlsOpen] = useState(false);
  // Sound master switch. OFF (default) = pure reading: tapping text won't start
  // the voice, and the control bar collapses/hides with the rest of the chrome
  // to maximise the reading area. ON = the Sound/Play/Stop bar stays pinned.
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);
  soundEnabledRef.current = soundEnabled;
  // Header + page-nav + (when sound off) the control bar. Tap the page to toggle.
  const [chromeVisible, setChromeVisible] = useState(true);

  const canUseAI = Boolean(entitlement.features.ai);
  const canUseOcr = Boolean(entitlement.features.ocr);
  const readingLanguage = getReadingLanguage(preferences.bookLanguage);
  const canUseCloudVoice = Boolean(
    readingLanguage.cloudAiVoice &&
      entitlement.features.cloudVoice &&
      entitlement.limits.cloudVoiceCharsPerMonth > 0
  );
  const desiredVoiceMode = preferredVoiceMode(preferences, entitlement);
  const readerVoiceOptions = useMemo(
    () => [
      { engine: "device" as const, label: "Device", detail: "Free" },
      {
        engine: "local_ai" as const,
        label: "Edge AI",
        detail: readingLanguage.edgeAi ? "On phone" : "English",
        locked: !readingLanguage.edgeAi,
      },
      {
        engine: "cloud" as const,
        label: "Cloud AI",
        detail: readingLanguage.cloudAiVoice ? (canUseCloudVoice ? "Premium" : "Locked") : "QA",
        locked: !canUseCloudVoice,
      },
    ],
    [canUseCloudVoice, readingLanguage.cloudAiVoice, readingLanguage.edgeAi]
  );

  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const ttsRef = useRef(createTTSProvider(providerKindFor(voiceMode)));
  const playingRef = useRef(false);
  const indexRef = useRef(0); // global sentence index being read
  const epochRef = useRef(0); // invalidates stale TTS onDone callbacks
  const pendingOffsetRef = useRef(0); // mid-sentence start offset for tap-to-read
  const currentIdRef = useRef<number | null>(null);
  const activeLineRef = useRef<ActiveLine>({ sentenceId: null, lineIndex: 0 });
  const activeCharRef = useRef<{ sentenceId: number; charOffset: number } | null>(null);
  const lineRangesRef = useRef<Map<number, LineRange[]>>(new Map());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const cloudVoiceLimitWarnedRef = useRef(false);
  const cloudVoiceLanguageWarnedRef = useRef(false);
  const localVoiceWarnedRef = useRef(false);
  const saveLastReadRef = useRef<() => void>(() => {});
  const followRef = useRef(true); // auto-scroll to follow the voice (optional)
  const listRef = useRef<FlatList<Sentence>>(null);
  const initialJumpRef = useRef(false);
  const layoutSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollFailureCountRef = useRef(0);
  const layoutScrollQuietRef = useRef(false);
  const settingsRef = useRef(settings);
  // Stable tap handler so memoized rows never re-render on scroll/highlight.
  const onTapWordRef = useRef<(id: number, offset: number) => void>(() => {});
  const tapHandler = useRef((id: number, offset: number) => onTapWordRef.current(id, offset))
    .current;

  // ----- background OCR (global engine: keeps loading across book/app switches) -----
  const currentPageRef = useRef(1); // page currently in view (drives OCR priority)
  const pendingJumpRef = useRef<number | null>(null); // page to jump to once loaded
  const ocrOfflineRef = useRef(false); // background OCR paused because we're offline
  const anchorRef = useRef<{ page: number; within: number } | null>(null);
  // Always-current view of the sentence list so TTS callbacks never read stale data.
  const flatRef = useRef<Sentence[]>([]);
  const docRef = useRef(doc); // current doc for stable callbacks
  docRef.current = doc;
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [loadingPageMsg, setLoadingPageMsg] = useState<string | null>(null);
  useEffect(() => {
    ocrOfflineRef.current = false;
    pendingJumpRef.current = null;
    anchorRef.current = null;
    activeCharRef.current = null;
    activeLineRef.current = { sentenceId: null, lineIndex: 0 };
    lineRangesRef.current.clear();
    setActiveLine({ sentenceId: null, lineIndex: 0 });
    setOcrProgress(null);
    setLoadingPageMsg(null);
  }, [doc]);

  const langCode = language.split("-")[0];

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    if (!isPlaying) {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      return;
    }

    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [isPlaying]);

  useEffect(() => {
    if (voiceMode === desiredVoiceMode) return;
    epochRef.current++;
    ttsRef.current.stop();
    playingRef.current = false;
    setIsPlaying(false);
    ttsRef.current = createTTSProvider(providerKindFor(desiredVoiceMode));
    setVoiceMode(desiredVoiceMode);
  }, [desiredVoiceMode, voiceMode]);
  useEffect(() => {
    if (canUseCloudVoice || voiceMode !== "natural") return;
    epochRef.current++;
    ttsRef.current.stop();
    ttsRef.current = createTTSProvider("device");
    setVoiceMode("device");
  }, [canUseCloudVoice, voiceMode]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;
      if (previous !== "active" || nextState === "active") return;
      if (!playingRef.current) return;

      // Reading is foreground-only for now. The app keeps the screen awake while
      // reading, and any Home/app-switch/background transition hard-stops audio.
      epochRef.current++;
      playingRef.current = false;
      setIsPlaying(false);
      saveLastReadRef.current();
      ttsRef.current.stop();
    });
    return () => sub.remove();
  }, []);

  function openFeatureLock(title: string, body: string) {
    setPaywallTitle(title);
    setPaywallBody(body);
    setShowPaywall(true);
  }

  function selectVoiceEngine(engine: VoiceEngine) {
    if (engine === "local_ai" && !readingLanguage.edgeAi) {
      openFeatureLock(
        "Edge AI language pack",
        `Edge AI is available for English right now. Use Phone voice for ${readingLanguage.label} until we add this language pack.`
      );
      return;
    }
    if (engine === "cloud" && !readingLanguage.cloudAiVoice) {
      openFeatureLock(
        "Cloud AI voice QA",
        `Cloud AI voice is not release-ready for ${readingLanguage.label} yet. Use Phone voice now; we will add this language after voice quality passes testing.`
      );
      return;
    }
    if (engine === "cloud" && !canUseCloudVoice) {
      openFeatureLock(
        "Cloud AI voice",
        "Cloud AI is our highest-quality voice and is included in AI Pro and Power. Device voice and Edge AI stay available without OpenAI cost."
      );
      return;
    }
    if (engine === preferences.voiceEngine) return;
    epochRef.current++;
    playingRef.current = false;
    setIsPlaying(false);
    ttsRef.current.stop();
    onPreferencesChange({ ...preferences, voiceEngine: engine });
  }

  function ocrProgressLabel(): string {
    if (!ocrProgress) return "";
    if (ocrProgress.message) return ocrProgress.message;
    if (ocrProgress.offline) {
      return "Paused - you're offline. Pages will finish loading when you reconnect.";
    }
    return `Loading pages... ${ocrProgress.percent}%  (${ocrProgress.done}/${ocrProgress.total})`;
  }

  function openOcrLimitOffer() {
    const body =
      entitlement.tier === "ai_pro"
          ? "AI Pro includes 1,000 OCR pages each month. The remaining scanned pages are saved and can continue after your monthly limit resets. Power raises OCR to 3,000 pages/month."
          : "Scanned pages use OCR. AI Pro includes 1,000 OCR pages/month, and Power includes 3,000.";
    openFeatureLock("More OCR pages", body);
  }

  function toggleOcrPause() {
    const next = OcrLoader.togglePause(doc.docId);
    if (next) setOcrProgress(next);
  }

  function stopOcr() {
    OcrLoader.stop(doc.docId);
    setOcrProgress(null);
  }

  useEffect(() => {
    return () => {
      // Hard-stop on unmount so the voice never keeps reading after you leave.
      epochRef.current++;
      playingRef.current = false;
      if (layoutSettleTimerRef.current) clearTimeout(layoutSettleTimerRef.current);
      if (scrollRetryTimerRef.current) clearTimeout(scrollRetryTimerRef.current);
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      ttsRef.current.stop();
    };
  }, []);

  // Hardware back: close panels / exit fullscreen first; only leave on a clean exit.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showPaywall) {
        setShowPaywall(false);
        return true;
      }
      if (showAI) {
        setShowAI(false);
        return true;
      }
      if (showBookmarks) {
        setShowBookmarks(false);
        return true;
      }
      if (immersive) {
        setImmersive(false);
        return true;
      }
      handleBack();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immersive, showAI, showBookmarks, showPaywall]);

  // Resume at the saved position from the Library.
  useEffect(() => {
    const f = flatRef.current;
    const start = Math.max(0, Math.min(startSentenceId, Math.max(0, f.length - 1)));
    initialJumpRef.current = start > 0;
    if (start <= 0) return;
    indexRef.current = start;
    setCurrent(f[start]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.docId, startSentenceId]);

  // ----- helpers -----
  // Keep a live, render-independent copy of the sentence list. TTS onDone/onError
  // callbacks fire asynchronously and would otherwise close over a STALE `flat`
  // (the OCR engine rebuilds it as pages fill in), which is what made the voice
  // and the highlight drift a few lines apart. Reading from flatRef fixes that.
  flatRef.current = flat;

  const handleLineRanges = useRef((sentenceId: number, ranges: LineRange[]) => {
    lineRangesRef.current.set(sentenceId, ranges);
    const active = activeCharRef.current;
    if (active?.sentenceId === sentenceId) {
      setActiveLineByChar(sentenceId, active.charOffset);
    }
  }).current;

  function setCurrent(id: number | null) {
    currentIdRef.current = id;
    setCurrentId(id);
    const f = flatRef.current;
    if (id != null && f[id]) {
      const pg = f[id].page;
      setCurrentPage(pg);
      currentPageRef.current = pg;
      // Remember WHICH sentence (page + position within page) is active so the
      // highlight can re-anchor if OCR later inserts pages and shifts indices.
      const within = f.filter((s) => s.page === pg).findIndex((s) => s.id === id);
      anchorRef.current = { page: pg, within: Math.max(0, within) };
    }
  }
  function setActiveLineIndex(sentenceId: number | null, lineIndex: number) {
    const next = { sentenceId, lineIndex };
    const prev = activeLineRef.current;
    if (prev.sentenceId === next.sentenceId && prev.lineIndex === next.lineIndex) return;
    activeLineRef.current = next;
    setActiveLine(next);
  }
  function setActiveLineByChar(sentenceId: number, charOffset: number) {
    activeCharRef.current = { sentenceId, charOffset };
    const ranges = lineRangesRef.current.get(sentenceId);
    if (!ranges || ranges.length === 0) {
      setActiveLineIndex(sentenceId, 0);
      return;
    }
    const boundedOffset = Math.max(0, charOffset);
    const idx = ranges.findIndex((r) => boundedOffset >= r.start && boundedOffset <= r.end);
    setActiveLineIndex(sentenceId, Math.max(0, idx >= 0 ? idx : ranges.length - 1));
  }
  function currentSentence(): Sentence | undefined {
    const f = flatRef.current;
    const id = currentIdRef.current ?? indexRef.current;
    return f[id];
  }
  // Resolve the index of the currently-anchored sentence in the LATEST flat list.
  // Used to advance playback so an OCR-driven index shift can never skip/repeat.
  function resolveAnchorIndex(): number {
    const a = anchorRef.current;
    const f = flatRef.current;
    if (!a) return indexRef.current;
    const onPage = f.filter((s) => s.page === a.page);
    if (onPage.length === 0) return indexRef.current;
    const target = onPage[Math.min(a.within, onPage.length - 1)];
    return target ? target.id : indexRef.current;
  }
  function freeCap(): number {
    if (doc.truncated && doc.pageCap) return Math.min(totalPages, doc.pageCap);
    if (!ENFORCE_FREE_LIMIT) return totalPages;
    return Math.min(totalPages, freePageLimit);
  }
  function isBeyondReturnedPageCap(page: number): boolean {
    return Boolean(doc.truncated && doc.pageCap && page > doc.pageCap);
  }
  function openPageLimitOffer() {
    openFeatureLock(
      "Page limit reached",
      `This plan includes the first ${doc.pageCap || freePageLimit} pages of this document. Upgrade to Reader Plus for full native-text books.`
    );
  }

  function pageWithinIndex(sentence: Sentence, list = flatRef.current): number {
    let within = 0;
    for (const item of list) {
      if (item.id === sentence.id) return within;
      if (item.page === sentence.page) within++;
    }
    return 0;
  }

  function resolvePageWithinIndex(page: number, within: number): number {
    const onPage = flatRef.current.filter((s) => s.page === page);
    if (onPage.length === 0) return indexRef.current;
    return onPage[Math.min(Math.max(0, within), onPage.length - 1)]?.id ?? indexRef.current;
  }

  function buildSpeechChunk(
    startIndex: number,
    list: Sentence[],
    mode: RuntimeVoiceMode,
    firstOffset = 0
  ): SpeechChunk | null {
    const first = list[startIndex];
    if (!first) return null;

    const maxSentences = mode === "local" ? LOCAL_AI_MAX_SENTENCES : 1;
    const maxChars = mode === "local" ? LOCAL_AI_MAX_CHARS : Number.POSITIVE_INFINITY;
    const spans: SpeechChunkSpan[] = [];
    const parts: string[] = [];
    let charCursor = 0;
    let index = startIndex;

    while (index < list.length && spans.length < maxSentences) {
      const sentence = list[index];
      if (!sentence || sentence.page > freeCap()) break;
      if (sentence.page !== first.page) break;

      const sourceStart =
        index === startIndex
          ? Math.min(Math.max(0, firstOffset), sentence.text.length)
          : 0;
      const sourceText = sentence.text.slice(sourceStart);
      if (!sourceText.trim()) {
        index++;
        continue;
      }

      const separator = parts.length > 0 ? " " : "";
      const projectedLength = charCursor + separator.length + sourceText.length;
      if (parts.length > 0 && projectedLength > maxChars) break;

      if (separator) charCursor += separator.length;
      spans.push({
        sentence,
        start: charCursor,
        end: charCursor + sourceText.length,
        sourceStart,
      });
      parts.push(sourceText);
      charCursor += sourceText.length;
      index++;
    }

    if (!spans.length) return null;
    const last = spans[spans.length - 1].sentence;
    return {
      text: parts.join(" "),
      spans,
      nextIndex: index,
      lastPage: last.page,
      lastWithin: pageWithinIndex(last, list),
    };
  }

  function locateChunkPosition(chunk: SpeechChunk, charOffset: number) {
    const bounded = Math.max(0, Math.min(Math.max(0, chunk.text.length - 1), charOffset));
    const span =
      chunk.spans.find((candidate) => bounded <= candidate.end) ||
      chunk.spans[chunk.spans.length - 1];
    if (!span) return null;
    return {
      sentence: span.sentence,
      charOffset: Math.max(0, span.sourceStart + bounded - span.start),
    };
  }

  // Subscribe to the GLOBAL background OCR engine. Starting it here registers the
  // job once; it then keeps loading even if we leave for another book or the
  // Library, and resumes automatically when the app returns to the foreground.
  useEffect(() => {
    if (!canUseOcr || !doc.docToken || (doc.pendingOcr?.length ?? 0) === 0) return;
    OcrLoader.start({
      docId: doc.docId,
      token: doc.docToken,
      ocrLang: readingLanguage.ocrLang,
      pages: doc.pages,
      pending: doc.pendingOcr ?? [],
    });
    const unsub = OcrLoader.subscribe(doc.docId, (nextPages, progress) => {
      setPages(nextPages);
      setOcrProgress(progress);
      ocrOfflineRef.current = progress.offline;
    });
    return unsub; // unsubscribe on unmount; the job keeps running in the background
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, canUseOcr, readingLanguage.ocrLang]);

  // Re-anchor the highlight + reading index after OCR inserts pages so they stay
  // glued to the SAME sentence even though array indices shifted. Runs during
  // playback too (the spoken page is already OCR'd, so its sentences are stable).
  useEffect(() => {
    const a = anchorRef.current;
    if (!a) return;
    const onPage = flat.filter((s) => s.page === a.page);
    if (onPage.length === 0) return;
    const target = onPage[Math.min(a.within, onPage.length - 1)];
    if (target) {
      indexRef.current = target.id;
      if (target.id !== currentIdRef.current) {
        currentIdRef.current = target.id;
        setCurrentId(target.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat]);

  useEffect(() => {
    lineRangesRef.current.clear();
    const activeChar = activeCharRef.current;
    if (activeChar) setActiveLineIndex(activeChar.sentenceId, 0);
    if (currentIdRef.current == null) return;

    const target = resolveAnchorIndex();
    indexRef.current = target;
    currentIdRef.current = target;
    setCurrentId(target);
    layoutScrollQuietRef.current = true;

    if (layoutSettleTimerRef.current) clearTimeout(layoutSettleTimerRef.current);
    layoutSettleTimerRef.current = setTimeout(() => {
      layoutSettleTimerRef.current = null;
      if (followRef.current) scrollToIndexSafe(resolveAnchorIndex(), false);
      layoutScrollQuietRef.current = false;
    }, 180);

    return () => {
      if (layoutSettleTimerRef.current) {
        clearTimeout(layoutSettleTimerRef.current);
        layoutSettleTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowWidth, windowHeight, lineHeight]);

  // Perform a queued "go to page" once that page's text has finished loading.
  useEffect(() => {
    const target = pendingJumpRef.current;
    if (target == null) return;
    const idx = TextReflow.firstIndexOfPage(flat, target);
    if (idx >= 0) {
      pendingJumpRef.current = null;
      setLoadingPageMsg(null);
      jumpToSentence(idx, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat]);


  // ----- scrolling / follow (FlatList) -----
  function scrollToIndexSafe(index: number, animated: boolean, resetFailures = true) {
    if (index < 0 || index >= flatRef.current.length) return;
    if (resetFailures) scrollFailureCountRef.current = 0;
    try {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.25, animated });
    } catch {
      /* not measured yet; onScrollToIndexFailed handles it */
    }
  }

  function toggleFollow() {
    const next = !followRef.current;
    followRef.current = next;
    setAutoFollow(next);
    if (next && currentIdRef.current != null) scrollToIndexSafe(currentIdRef.current, false);
  }

  // onViewableItemsChanged / viewabilityConfig must be stable across renders.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current;
  const onViewableItemsChanged = useRef((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems.find((v) => v.isViewable);
    if (first && first.item) {
      const p = (first.item as Sentence).page;
      setCurrentPage(p);
      currentPageRef.current = p;
      // Bias the background OCR engine toward what's on screen so scrolling keeps
      // loading the pages just ahead of you.
      OcrLoader.setPriority(docRef.current.docId, p);
    }
  }).current;

  function onScrollToIndexFailed(info: { index: number; averageItemLength: number }) {
    const index = Math.max(0, Math.min(info.index, Math.max(0, flatRef.current.length - 1)));
    const quiet = initialJumpRef.current || layoutScrollQuietRef.current;
    const attempts = scrollFailureCountRef.current;
    listRef.current?.scrollToOffset({
      offset: Math.max(0, info.averageItemLength * index),
      animated: false,
    });
    if (attempts >= 2) {
      initialJumpRef.current = false;
      layoutScrollQuietRef.current = false;
      scrollFailureCountRef.current = 0;
      return;
    }
    scrollFailureCountRef.current = attempts + 1;
    if (scrollRetryTimerRef.current) clearTimeout(scrollRetryTimerRef.current);
    scrollRetryTimerRef.current = setTimeout(() => {
      scrollRetryTimerRef.current = null;
      scrollToIndexSafe(index, false, false);
      initialJumpRef.current = false;
    }, quiet ? 160 : 80);
  }

  // ----- playback -----
  function speakAt(i: number) {
    const myEpoch = ++epochRef.current; // any earlier utterance's callback is now stale
    const f = flatRef.current;
    if (i < 0 || i >= f.length) {
      reachedEnd();
      return;
    }
    const s = f[i];
    if (s.page > freeCap()) {
      saveLastRead();
      playingRef.current = false;
      setIsPlaying(false);
      ttsRef.current.stop();
      openPageLimitOffer();
      return;
    }

    const offset = pendingOffsetRef.current;
    pendingOffsetRef.current = 0;
    const baseOffset = Math.max(0, offset);
    const chunk = buildSpeechChunk(i, f, voiceMode, baseOffset);
    if (!chunk) {
      reachedEnd();
      return;
    }
    const firstPosition = locateChunkPosition(chunk, 0);
    const text = chunk.text;
    const spokenLength = Math.max(1, text.length);

    indexRef.current = i;

    // Warm upcoming clips through the provider's in-flight cache so natural
    // voice can hand off smoothly without charging/fetching duplicates.
    let nextIndex = chunk.nextIndex;
    const prefetchAhead = voiceMode === "local" ? LOCAL_AI_PREFETCH_AHEAD : TTS_PREFETCH_AHEAD;
    for (let ahead = 1; ahead <= prefetchAhead; ahead++) {
      const nextChunk = buildSpeechChunk(nextIndex, f, voiceMode);
      if (!nextChunk) break;
      ttsRef.current
        .prefetch?.(nextChunk.text, {
          language,
          rate: settingsRef.current.speed,
          voiceId: voiceIdFor(voiceMode, preferences),
          fallbackVoiceId: preferences.deviceVoiceId,
        })
        .catch(() => {});
      nextIndex = nextChunk.nextIndex;
    }

    // Advance from the ANCHORED position (re-resolved against the latest list) so
    // an OCR-driven index shift can never desync the voice from the highlight.
    const advance = () => {
      if (!playingRef.current || myEpoch !== epochRef.current) return;
      speakAt(resolvePageWithinIndex(chunk.lastPage, chunk.lastWithin) + 1);
    };

    ttsRef.current.speak(text, {
      language,
      rate: settingsRef.current.speed,
      voiceId: voiceIdFor(voiceMode, preferences),
      fallbackVoiceId: preferences.deviceVoiceId,
      lockScreenTitle: docRef.current.fileName || "readFlow",
      lockScreenSubtitle: `Page ${s.page} - ${voiceLabelFor(voiceMode)}`,
      lockScreenAlbum: "readFlow",
      onFallback: (info) => {
        if (info.reason === "quota" && !cloudVoiceLimitWarnedRef.current) {
          cloudVoiceLimitWarnedRef.current = true;
            openFeatureLock(
              "AI voice allowance used",
            "Your Cloud AI allowance is used for this month. Device voice will keep reading for free. You can renew next month, upgrade to Power, or buy an AI voice pack when purchases are live."
          );
        } else if (info.reason === "local_unavailable" && !localVoiceWarnedRef.current) {
          localVoiceWarnedRef.current = true;
          openFeatureLock(
            "Edge AI not ready",
            info.message ||
              "Download Edge AI from the Voice panel, or keep reading with device voice."
          );
        } else if (info.reason === "language_unsupported" && !cloudVoiceLanguageWarnedRef.current) {
          cloudVoiceLanguageWarnedRef.current = true;
          openFeatureLock(
            "Cloud AI voice QA",
            info.message ||
              "Cloud AI voice is not release-ready for this language yet. Device voice will keep reading."
          );
        }
      },
      onStart: () => {
        if (myEpoch !== epochRef.current) return;
        const start = firstPosition?.sentence ?? s;
        setCurrent(start.id);
        setActiveLineByChar(start.id, firstPosition?.charOffset ?? baseOffset);
        if (followRef.current) scrollToIndexSafe(start.id, false);
      },
      onProgress: ({ currentTime, duration }) => {
        if (myEpoch !== epochRef.current || duration <= 0) return;
        const ratio = Math.max(0, Math.min(0.999, currentTime / duration));
        const position = locateChunkPosition(chunk, Math.floor(spokenLength * ratio));
        if (!position) return;
        indexRef.current = position.sentence.id;
        if (currentIdRef.current !== position.sentence.id) {
          setCurrent(position.sentence.id);
          if (followRef.current) scrollToIndexSafe(position.sentence.id, false);
        }
        setActiveLineByChar(position.sentence.id, position.charOffset);
      },
      onDone: advance,
      onError: advance,
    });
  }

  function reachedEnd() {
    saveLastRead();
    playingRef.current = false;
    setIsPlaying(false);
    ttsRef.current.stop();
  }

  function play() {
    playingRef.current = true;
    setIsPlaying(true);
    speakAt(indexRef.current);
  }

  function pause() {
    epochRef.current++; // drop any in-flight onDone so it can't auto-advance
    playingRef.current = false;
    setIsPlaying(false);
    ttsRef.current.stop(); // resume re-speaks current sentence (cross-platform safe)
  }

  function stop() {
    epochRef.current++;
    playingRef.current = false;
    setIsPlaying(false);
    ttsRef.current.stop();
    saveLastRead(); // requirement: stopping saves the current position
  }

  function onPlayPause() {
    isPlaying ? pause() : play();
  }

  // ----- tap-to-read -----
  function onTapWord(globalId: number, charOffset: number) {
    // Sound off = reading mode: a tap toggles the menus instead of reading,
    // so the page can fill the whole screen.
    if (!soundEnabledRef.current) {
      setChromeVisible((v) => !v);
      return;
    }
    epochRef.current++; // invalidate the sentence we're interrupting (prevents double-read)
    ttsRef.current.stop();
    indexRef.current = globalId;
    pendingOffsetRef.current = charOffset;
    playingRef.current = true;
    setIsPlaying(true);
    speakAt(globalId);
  }
  onTapWordRef.current = onTapWord;

  function toggleSound() {
    setSoundEnabled((on) => {
      const next = !on;
      if (!next) {
        // Leaving listening mode: hard-stop the voice.
        epochRef.current++;
        playingRef.current = false;
        setIsPlaying(false);
        ttsRef.current.stop();
        setControlsOpen(false);
      } else {
        // Entering listening mode: make sure the chrome is visible.
        setChromeVisible(true);
      }
      return next;
    });
  }

  // ----- navigation -----
  function goToPage(page: number) {
    const p = Math.max(1, Math.min(totalPages, page));
    if (isBeyondReturnedPageCap(p)) {
      openPageLimitOffer();
      return;
    }
    const idx = TextReflow.firstIndexOfPage(flat, p);
    if (idx >= 0) {
      jumpToSentence(idx, false);
      return;
    }
    // The page has no text yet (scanned page not OCR'd). Never silently fail —
    // explain why, or load it on demand when we can.
    if (!canUseOcr) {
      openFeatureLock(
        "Scanned page",
        `Page ${p} is a scanned page. Reading it needs OCR, available in AI Pro and Power with an internet connection.`
      );
      return;
    }
    if (!doc.docToken || ocrOfflineRef.current) {
      openFeatureLock(
        "Not saved for offline yet",
        `Page ${p} hasn't been saved for offline reading. Reconnect to the internet to load it — then it'll be available in airplane mode.`
      );
      return;
    }
    // Online + paid: prioritise OCR for this page and jump as soon as it loads.
    OcrLoader.setPriority(doc.docId, p);
    pendingJumpRef.current = p;
    setLoadingPageMsg(`Loading page ${p}…`);
  }

  function onJumpBookmark(b: Bookmark) {
    jumpToSentence(b.sentenceId, false);
    setShowBookmarks(false);
  }

  function jumpToSentence(globalId: number, autoplay: boolean) {
    const s = flat[globalId];
    if (!s) return;
    if (s.page > freeCap()) {
      openPageLimitOffer();
      return;
    }
    epochRef.current++;
    ttsRef.current.stop();
    indexRef.current = globalId;
    pendingOffsetRef.current = 0;
    setCurrent(globalId);
    scrollToIndexSafe(globalId, false);
    if (autoplay) {
      playingRef.current = true;
      setIsPlaying(true);
      setTimeout(() => speakAt(globalId), 150);
    } else {
      playingRef.current = false;
      setIsPlaying(false);
    }
  }

  // ----- bookmarks -----
  function saveLastRead() {
    const s = currentSentence();
    if (!s) return;
    onProgress?.(s.page, s.id, totalPages);
    Bookmarks.upsert({
      tag: "Last read",
      docId: doc.docId,
      fileName: doc.fileName,
      page: s.page,
      chunkIndex: 0,
      sentenceId: s.id,
      preview: s.text.slice(0, 60),
    }).catch(() => {});
  }
  saveLastReadRef.current = saveLastRead;

  function handleBack() {
    // Fully halt playback so the voice never keeps reading back on the Library.
    epochRef.current++;
    playingRef.current = false;
    setIsPlaying(false);
    saveLastRead();
    ttsRef.current.stop();
    onBack();
  }

  if (flat.length === 0) {
    const loadingScan = canUseOcr && Boolean(doc.docToken) && !ocrOfflineRef.current;
    return (
      <View style={styles.center}>
        {loadingScan ? (
          <>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.dim}>Loading scanned pages…</Text>
          </>
        ) : (
          <>
            <Text style={styles.dim}>No readable text found.</Text>
            {doc.needsPaidOcr ? (
              <Text style={styles.dim}>
                This document needs OCR, available on paid plans with an internet connection.
              </Text>
            ) : doc.scanned && ocrOfflineRef.current ? (
              <Text style={styles.dim}>
                You're offline. Reconnect to the internet to load this scanned document.
              </Text>
            ) : doc.scanned ? (
              <Text style={styles.dim}>
                This looks like a scanned PDF. OCR requires a paid plan and an internet connection.
              </Text>
            ) : null}
          </>
        )}
        <Pressable style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const cs = currentSentence();
  const currentPos = {
    page: cs?.page ?? currentPage,
    chunkIndex: 0,
    sentenceId: cs?.id ?? flat[0]?.id ?? 0,
    preview: (cs?.text ?? flat[0]?.text ?? "").slice(0, 60),
  };
  // Live status-bar inset (works with Android edge-to-edge + rotation). When the
  // status bar is hidden (immersive) the inset collapses to 0, which is correct.
  const topInset = immersive ? 0 : Math.max(insets.top, Constants.statusBarHeight);
  const topPad = topInset + theme.spacing(immersive ? 0.5 : 1);
  // The control bar shows when listening (pinned) or when the chrome is revealed.
  const controlsShown = soundEnabled || chromeVisible;
  // Float the AI button just above the controls; the bar height varies by state.
  const fabBottom = (controlsOpen ? 330 : controlsShown ? 150 : 24) + insets.bottom;
  const readerBottomPad = (controlsOpen ? 300 : controlsShown ? 132 : 56) + insets.bottom;

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" hidden={immersive} />

      {/* In fullscreen we hide the top bar entirely (the Exit button used to sit
          under the camera cutout). Use the Android back button to leave fullscreen. */}
      {immersive || !chromeVisible ? (
        <View style={{ height: immersive ? insets.top : topInset }} />
      ) : (
        <>
          {/* header */}
          <View style={[styles.header, { paddingTop: topPad }]}>
            <Pressable onPress={handleBack} hitSlop={10} style={styles.headerIconBtn}>
              <Text style={styles.headerBtn}>‹</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName} numberOfLines={1}>
                {doc.fileName}
              </Text>
              <Text style={styles.pageRange}>
                Page {currentPage} of {totalPages}
                {doc.forceOcr
                  ? "  ·  OCR rebuild"
                  : doc.ocrPages > 0
                    ? `  ·  OCR ${doc.ocrPages}p`
                    : ""}
              </Text>
            </View>
            <Pressable
              onPress={toggleFollow}
              hitSlop={8}
              style={[styles.chip, autoFollow && styles.chipOn]}
            >
              <Text style={[styles.chipText, autoFollow && styles.chipTextOn]}>Follow</Text>
            </Pressable>
            <Pressable
              onPress={() => setImmersive(true)}
              hitSlop={8}
              style={styles.chip}
            >
              <Text style={styles.chipText}>Focus</Text>
            </Pressable>
            <Pressable onPress={() => setShowBookmarks(true)} hitSlop={8} style={styles.headerIconBtn}>
              <Text style={styles.headerIcon}>BM</Text>
            </Pressable>
          </View>

          {/* page nav strip */}
          <View style={styles.pageNav}>
            <Pressable onPress={() => goToPage(currentPage - 1)} hitSlop={8} disabled={currentPage <= 1}>
              <Text style={[styles.pageNavBtn, currentPage <= 1 && styles.disabled]}>Prev</Text>
            </Pressable>
            <Pressable
              onPress={() => goToPage(currentPage + 1)}
              hitSlop={8}
              disabled={currentPage >= totalPages}
            >
              <Text style={[styles.pageNavBtn, currentPage >= totalPages && styles.disabled]}>
                Next
              </Text>
            </Pressable>
          </View>
          {doc.needsPaidOcr && !canUseOcr ? (
            <View style={styles.lockBanner}>
              <Text style={styles.lockBannerText}>
                This scanned PDF needs OCR. Upgrade to AI Pro or Power to read it.
              </Text>
            </View>
          ) : null}
          {loadingPageMsg ? (
            <View style={styles.loadingBanner}>
              <ActivityIndicator color={theme.colors.accent} size="small" />
              <Text style={styles.loadingBannerText}>{loadingPageMsg}</Text>
            </View>
          ) : ocrProgress && !ocrProgress.complete ? (
            <View style={styles.progressWrap}>
              <Text style={styles.progressLabel}>{ocrProgressLabel()}</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(2, ocrProgress.percent)}%` },
                    (ocrProgress.offline || ocrProgress.pausedReason) && styles.progressFillOffline,
                  ]}
                />
              </View>
              {ocrProgress.pausedReason === "quota" ? (
                <View style={styles.progressActions}>
                  <Text style={styles.progressHint}>
                    {ocrProgress.pending} scanned pages remain. Continue after reset, or upgrade for a
                    higher monthly OCR limit.
                  </Text>
                  <Pressable style={styles.progressButton} onPress={openOcrLimitOffer}>
                    <Text style={styles.progressButtonText}>See options</Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.progressActionRow}>
                {ocrProgress.pausedReason === "user" || !ocrProgress.pausedReason ? (
                  <Pressable
                    style={[
                      styles.progressButton,
                      ocrProgress.pausedReason === "user" && styles.progressButtonSecondary,
                    ]}
                    onPress={toggleOcrPause}
                  >
                    <Text
                      style={[
                        styles.progressButtonText,
                        ocrProgress.pausedReason === "user" && styles.progressButtonSecondaryText,
                      ]}
                    >
                      {ocrProgress.pausedReason === "user" ? "Resume OCR" : "Pause OCR"}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.progressButton, styles.progressButtonDanger]}
                  onPress={stopOcr}
                >
                  <Text style={styles.progressButtonText}>Stop OCR</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      )}

      {/* reading surface — virtualized for smooth, uninterrupted scrolling */}
      <FlatList
        key={doc.docId}
        ref={listRef}
        data={flat}
        keyExtractor={(s) => String(s.id)}
        extraData={`${currentId ?? "n"}:${activeLine.sentenceId ?? "n"}:${activeLine.lineIndex}:${settings.fontSize}:${lineHeight}`}
        renderItem={({ item, index }: ListRenderItemInfo<Sentence>) => (
          <SentenceRow
            sentence={item}
            active={item.id === currentId}
            activeLineIndex={item.id === activeLine.sentenceId ? activeLine.lineIndex : null}
            fontSize={settings.fontSize}
            lineHeight={lineHeight}
            layoutKey={`${Math.round(windowWidth)}:${Math.round(windowHeight)}:${lineHeight}`}
            rtl={Boolean(readingLanguage.rtl)}
            onTapWord={tapHandler}
            onLineRanges={handleLineRanges}
            showPageDivider={index > 0 && flat[index - 1].page !== item.page}
          />
        )}
        style={styles.reader}
        contentContainerStyle={[styles.readerContent, { paddingBottom: readerBottomPad }]}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={onScrollToIndexFailed}
        initialScrollIndex={initialSentenceIndex > 0 ? initialSentenceIndex : undefined}
        initialNumToRender={14}
        maxToRenderPerBatch={12}
        windowSize={11}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
      />

      {/* AI launcher (compact) */}
      {canUseAI ? (
        <Pressable style={[styles.aiFab, { bottom: fabBottom }]} onPress={() => setShowAI(true)}>
          <Text style={styles.aiFabText}>AI</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.aiFab, styles.aiFabLocked, { bottom: fabBottom }]}
          onPress={() =>
            openFeatureLock(
              "Unlock AI",
              "Summaries, explanations, Q&A, and capped Cloud AI are part of AI Pro. Device voice stays unlimited."
            )
          }
        >
          <Text style={[styles.aiFabText, styles.aiFabTextLocked]}>AI Pro</Text>
        </Pressable>
      )}

      {/* controls — pinned while listening; otherwise reveal/hide with the chrome */}
      {controlsShown && (
        <Controls
          settings={settings}
          onChange={setSettings}
          isPlaying={isPlaying}
          onPlayPause={onPlayPause}
          onStop={stop}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          expanded={controlsOpen}
          onToggleExpand={() => setControlsOpen((v) => !v)}
          voiceEngine={preferences.voiceEngine}
          voiceOptions={readerVoiceOptions}
          onVoiceEngineChange={selectVoiceEngine}
          bottomInset={insets.bottom}
        />
      )}

      {/* AI panel */}
      {showAI && (
        <AIPanel
          contextText={flat
            .filter((s) => Math.abs(s.page - currentPage) <= 2)
            .map((s) => s.text)
            .join(" ")}
          language={readingLanguage.aiLanguage || langCode}
          onClose={() => setShowAI(false)}
        />
      )}

      {/* bookmarks & go-to-page panel */}
      {showBookmarks && (
        <BookmarkPanel
          docId={doc.docId}
          fileName={doc.fileName}
          pageCount={totalPages}
          current={currentPos}
          onJump={onJumpBookmark}
          onGoToPage={goToPage}
          onClose={() => setShowBookmarks(false)}
        />
      )}

      {/* upgrade notice / paywall */}
      <UpgradeSheet
        visible={showPaywall}
        reasonTitle={paywallTitle}
        reasonBody={paywallBody}
        onClose={() => setShowPaywall(false)}
      />
    </View>
  );
}

/**
 * One sentence rendered as a tappable, wrapping block. Memoized so only the rows
 * whose `active` flag changes re-render — keeping the highlight in step with the
 * voice and the FlatList scroll buttery smooth.
 */
interface SentenceRowProps {
  sentence: Sentence;
  active: boolean;
  activeLineIndex: number | null;
  fontSize: number;
  lineHeight: number;
  layoutKey: string;
  rtl: boolean;
  onTapWord: (globalId: number, charOffset: number) => void;
  onLineRanges: (sentenceId: number, ranges: LineRange[]) => void;
  showPageDivider?: boolean;
}
const SentenceRow = React.memo(function SentenceRow({
  sentence,
  active,
  activeLineIndex,
  fontSize,
  lineHeight,
  layoutKey,
  rtl,
  onTapWord,
  onLineRanges,
  showPageDivider,
}: SentenceRowProps) {
  const tokens = useMemo(() => TextReflow.tokenizeWords(sentence.text), [sentence.text]);
  const [lines, setLines] = useState<LineSegment[] | null>(null);

  useEffect(() => {
    setLines(null);
  }, [sentence.text, fontSize, lineHeight, layoutKey]);

  function handleTextLayout(e: any) {
    if (!active) return;
    const next = buildLineSegments(sentence.text, e?.nativeEvent?.lines || []);
    if (next.length === 0) return;
    setLines((prev) => (sameLineSegments(prev, next) ? prev : next));
    onLineRanges(
      sentence.id,
      next.map((line) => ({ start: line.start, end: line.end }))
    );
  }

  function renderTokenText(tokenSource: { word: string; offset: number }[], baseOffset = 0) {
    return tokenSource.map((t, wi) => (
      <Text key={`${baseOffset}-${wi}`} onPress={() => onTapWord(sentence.id, baseOffset + t.offset)}>
        {t.word}
        {wi < tokenSource.length - 1 ? " " : ""}
      </Text>
    ));
  }

  const textStyle = {
    fontSize,
    lineHeight,
    textAlign: rtl ? "right" : "left",
    writingDirection: rtl ? "rtl" : "ltr",
  } as const;
  return (
    <View style={rtl ? styles.rtlRowWrap : undefined}>
      {showPageDivider ? (
        <View style={styles.pageDivider}>
          <View style={styles.pageDividerLine} />
          <Text style={styles.pageDividerLabel}>Page {sentence.page}</Text>
          <View style={styles.pageDividerLine} />
        </View>
      ) : null}
      {active && lines?.length ? (
        <View style={styles.activeLineBlock}>
          {lines.map((line, lineIndex) => {
            const lineTokens = TextReflow.tokenizeWords(line.text);
            return (
              <Text
                key={`${line.start}-${lineIndex}`}
                style={[
                  styles.rowLine,
                  rtl && styles.rowLineRtl,
                  textStyle,
                  activeLineIndex === lineIndex && styles.activeLine,
                ]}
              >
                {renderTokenText(lineTokens, line.start)}
              </Text>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.row, textStyle]} onTextLayout={active ? handleTextLayout : undefined}>
          {renderTokenText(tokens)}
        </Text>
      )}
    </View>
  );
});

function buildLineSegments(text: string, nativeLines: any[]): LineSegment[] {
  const out: LineSegment[] = [];
  let searchFrom = 0;

  for (const nativeLine of nativeLines) {
    const rawText = String(nativeLine?.text || "").replace(/\s+$/g, "");
    const trimmedText = rawText.trim();
    if (!trimmedText) continue;

    let lineText = rawText;
    let start = text.indexOf(lineText, searchFrom);
    if (start < 0) {
      lineText = trimmedText;
      start = text.indexOf(lineText, searchFrom);
    }
    if (start < 0) {
      lineText = trimmedText;
      start = searchFrom;
    }

    const end = Math.min(text.length, start + lineText.length);
    out.push({ text: lineText, start, end });
    searchFrom = end;
    while (searchFrom < text.length && /\s/.test(text[searchFrom])) searchFrom++;
  }

  return out.length ? out : [{ text, start: 0, end: text.length }];
}

function sameLineSegments(prev: LineSegment[] | null, next: LineSegment[]): boolean {
  if (!prev || prev.length !== next.length) return false;
  return prev.every(
    (line, index) =>
      line.start === next[index].start &&
      line.end === next[index].end &&
      line.text === next[index].text
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  dim: { color: theme.colors.textDim, textAlign: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceAlt,
  },
  headerBtn: { color: theme.colors.text, fontSize: 26, lineHeight: 28 },
  headerIcon: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipOn: { backgroundColor: theme.colors.teal, borderColor: theme.colors.teal },
  chipText: { color: theme.colors.textDim, fontSize: 12, fontFamily: theme.fonts.sansSemiBold },
  chipTextOn: { color: theme.colors.onAccent },
  disabled: { color: theme.colors.border },
  fileName: { color: theme.colors.text, fontFamily: theme.fonts.sansSemiBold, fontSize: 15 },
  pageRange: { color: theme.colors.textDim, fontSize: 12, fontFamily: theme.fonts.sans },
  pageNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  lockBanner: {
    marginHorizontal: theme.spacing(3),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: theme.spacing(1.2),
    paddingVertical: theme.spacing(0.9),
  },
  lockBannerText: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontFamily: theme.fonts.sans,
  },
  loadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: theme.spacing(3),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: theme.spacing(1.2),
    paddingVertical: theme.spacing(0.9),
  },
  loadingBannerText: {
    color: theme.colors.text,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
  },
  noteBanner: {
    marginHorizontal: theme.spacing(3),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: theme.spacing(1.2),
    paddingVertical: theme.spacing(0.9),
  },
  noteBannerText: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontFamily: theme.fonts.sans,
  },
  progressWrap: {
    marginHorizontal: theme.spacing(3),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(1.2),
    paddingVertical: theme.spacing(0.9),
    gap: 6,
  },
  progressLabel: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
  },
  progressActions: {
    gap: 8,
  },
  progressActionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  progressHint: {
    color: theme.colors.textDim,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: theme.fonts.sans,
  },
  progressButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progressButtonText: {
    color: theme.colors.onAccent,
    fontSize: 12,
    fontFamily: theme.fonts.sansSemiBold,
  },
  progressButtonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  progressButtonSecondaryText: {
    color: theme.colors.text,
  },
  progressButtonDanger: {
    backgroundColor: theme.colors.danger,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: theme.colors.accent,
  },
  progressFillOffline: {
    backgroundColor: theme.colors.textMute,
  },
  pageNavBtn: { color: theme.colors.accent, fontSize: 14, fontFamily: theme.fonts.sansSemiBold },
  reader: { flex: 1 },
  readerContent: { padding: theme.spacing(3) },
  row: { color: theme.colors.body, fontFamily: theme.fonts.serif, paddingVertical: 3 },
  rtlRowWrap: { alignItems: "stretch" },
  activeLineBlock: { paddingVertical: 3 },
  rowLine: {
    alignSelf: "flex-start",
    color: theme.colors.body,
    fontFamily: theme.fonts.serif,
    borderRadius: 6,
    paddingHorizontal: 2,
  },
  rowLineRtl: {
    alignSelf: "flex-end",
  },
  pageDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: theme.spacing(1.5),
    opacity: 0.58,
  },
  pageDividerLine: { flex: 1, height: 1, backgroundColor: "#D8D0C0" },
  pageDividerLabel: {
    color: "#9D9382",
    fontSize: 10.5,
    fontFamily: theme.fonts.mono,
    letterSpacing: 0,
  },
  activeSentence: {
    backgroundColor: theme.colors.highlight,
    color: theme.colors.text,
    borderRadius: 6,
  },
  activeLine: {
    backgroundColor: theme.colors.highlight,
    color: theme.colors.text,
  },
  aiFab: {
    position: "absolute",
    right: theme.spacing(2),
    bottom: 190,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  aiFabText: { color: theme.colors.onAccent, fontFamily: theme.fonts.sansSemiBold },
  aiFabLocked: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  aiFabTextLocked: {
    color: theme.colors.text,
  },
  backBtn: {
    marginTop: 12,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backText: { color: theme.colors.text, fontWeight: "600" },
  paywall: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  paywallCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 24,
    gap: 14,
    width: "100%",
    maxWidth: 380,
  },
  paywallTitle: { color: theme.colors.text, fontSize: 20, fontFamily: theme.fonts.serifSemiBold },
  paywallBody: { color: theme.colors.textMute, fontSize: 15, lineHeight: 21, fontFamily: theme.fonts.sans },
  paywallBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  paywallBtnText: { color: theme.colors.onAccent, fontFamily: theme.fonts.sansSemiBold, fontSize: 16 },
  paywallDismiss: { color: theme.colors.textDim, textAlign: "center", paddingVertical: 6 },
});
