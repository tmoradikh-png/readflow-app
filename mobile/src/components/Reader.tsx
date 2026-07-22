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
import { ThemedNotice, type ThemedNoticeAction } from "./ThemedNotice";
import { UpgradeSheet, type UpgradeBilling, type UpgradePlanKey } from "./UpgradeSheet";
import { EntitlementSnapshot } from "../services/Entitlements";
import { ReadingPreferences, VoiceEngine } from "../services/Preferences";
import { getReadingLanguage } from "../services/ReadingLanguages";
import {
  positionForSentence,
  ReadingPosition,
  resolveReadingPosition,
} from "../services/ReadingPosition";
import {
  buildSpeechChunk as createSpeechChunk,
  resumeSpeechOffset,
  SpeechChunk,
} from "../services/SpeechChunk";
import {
  addLocalVoiceSeconds,
  formatLocalVoiceRemaining,
  getLocalVoiceSecondsToday,
} from "../services/LocalVoiceUsage";
import { normalizeHeadingForSpeech } from "../services/SpeechNormalization";
import {
  getLocalNeuralVoiceStatus,
  loadLocalNeuralVoiceStatus,
  LocalNeuralVoiceStatus,
} from "../services/LocalNeuralVoice";
import { theme } from "../theme";

interface Props {
  doc: ParsedPdf;
  entitlement: EntitlementSnapshot;
  preferences: ReadingPreferences;
  onPreferencesChange: (next: ReadingPreferences) => void;
  language?: string; // BCP-47, e.g. "en-US"
  /** Pages readable for free before the subscribe gate. */
  freePageLimit?: number;
  /** Stable page-relative position to resume from (from the Library). */
  startPosition?: Partial<ReadingPosition>;
  /** Reports the latest reading position so the Library can persist it. */
  onProgress?: (position: ReadingPosition, totalPages: number) => void | Promise<void>;
  purchasingAvailable?: boolean;
  purchaseSetupLoading?: boolean;
  purchasing?: boolean;
  purchaseError?: string | null;
  onPurchasePlan?: (planKey: UpgradePlanKey, billing: UpgradeBilling) => void;
  onRestorePurchases?: () => void;
  onBack: () => void;
}

interface LineRange {
  start: number;
  end: number;
  /** Position inside the rendered paragraph, retained for line-aware Follow. */
  y: number;
  height: number;
}

interface ActiveLine {
  sentenceId: number | null;
  lineIndex: number;
}

interface LineSegment extends LineRange {
  text: string;
}

const TTS_PREFETCH_AHEAD = 8;
// One local render ahead is enough for a smooth handoff. Queuing several native
// Supertonic jobs makes Stop/Back appear frozen on long or malformed paragraphs.
const LOCAL_AI_PREFETCH_AHEAD = 1;
const KEEP_AWAKE_TAG = "readflow-reading";
const READER_WINDOW_BEFORE = 12;
const READER_WINDOW_AFTER = 180;
const READER_WINDOW_BACKWARD_EXPAND = 12;
const READER_WINDOW_FORWARD_EXPAND = 120;
const TITLE_PAUSE_MS = 220;
const PAGE_DIVIDER_ESTIMATED_HEIGHT = 38;

type RuntimeVoiceMode = "natural" | "device" | "local";

function preferredVoiceMode(
  preferences: ReadingPreferences,
  entitlement: EntitlementSnapshot,
  localVoiceReady?: boolean
): RuntimeVoiceMode {
  const readingLanguage = getReadingLanguage(preferences.bookLanguage);
  if (
    entitlement.tier === "free" &&
    entitlement.features.localVoice &&
    readingLanguage.rfAi &&
    localVoiceReady === true
  ) {
    return "local";
  }
  if (
    preferences.voiceEngine === "local_ai" &&
    entitlement.features.localVoice &&
    readingLanguage.rfAi &&
    localVoiceReady !== false
  ) {
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
  if (mode === "local") return "rF AI";
  return "Device voice";
}

function speechForChunk(chunk: SpeechChunk, _language: string, rate: number) {
  const isHeading = chunk.spans.some((span) => span.sentence.kind === "heading");
  return {
    // Speech must be derived only from displayed source prose. Headings keep a
    // slower rate and short trailing pause, but no invisible "Title" cue.
    text: isHeading ? normalizeHeadingForSpeech(chunk.text) : chunk.text,
    prefixLength: 0,
    rate: isHeading ? Math.max(0.5, rate * 0.88) : rate,
    isHeading,
  };
}

function voiceEngineForMode(mode: RuntimeVoiceMode): VoiceEngine {
  if (mode === "natural") return "cloud";
  if (mode === "local") return "local_ai";
  return "device";
}

export function Reader({
  doc,
  entitlement,
  preferences,
  onPreferencesChange,
  language = "en-US",
  freePageLimit = 100,
  startPosition,
  onProgress,
  purchasingAvailable,
  purchaseSetupLoading,
  purchasing,
  purchaseError,
  onPurchasePlan,
  onRestorePurchases,
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
  const initialSentenceIndex = useMemo(
    () => resolveReadingPosition(flat, startPosition),
    [flat, startPosition?.page, startPosition?.pageSentenceIndex, startPosition?.sentenceId, startPosition?.preview]
  );
  // Start an explicit resume anchor at local row zero. FlatList cannot reliably
  // estimate a distant row when paragraph heights vary, so an initial index in
  // the middle of the window can land several pages early.
  const initialWindowStart = initialSentenceIndex;
  const [windowStart, setWindowStart] = useState(initialWindowStart);
  const [windowEnd, setWindowEnd] = useState(
    Math.min(
      flat.length,
      initialSentenceIndex + READER_WINDOW_BEFORE + READER_WINDOW_AFTER
    )
  );
  const [windowFocusIndex, setWindowFocusIndex] = useState(initialSentenceIndex);
  const [listGeneration, setListGeneration] = useState(0);
  const renderedFlat = useMemo(
    () => flat.slice(windowStart, Math.max(windowStart + 1, windowEnd)),
    [flat, windowEnd, windowStart]
  );

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
  const [readerNotice, setReaderNotice] = useState<{
    title: string;
    body: string;
    primary?: ThemedNoticeAction;
    secondary?: ThemedNoticeAction;
  } | null>(null);
  const [localVoiceStatus, setLocalVoiceStatus] = useState<LocalNeuralVoiceStatus | null>(null);
  const [localVoiceSecondsToday, setLocalVoiceSecondsToday] = useState(0);
  const [voiceMode, setVoiceMode] = useState<RuntimeVoiceMode>(
    preferredVoiceMode(preferences, entitlement)
  );
  const [paywallTitle, setPaywallTitle] = useState("Paid feature");
  const [paywallBody, setPaywallBody] = useState(
    "This feature is available on paid plans. Free users can continue with the limited manual reading preview."
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
  const canUseDeviceReadAloud =
    entitlement.tier !== "free" &&
    (entitlement.features.unlimitedLibrary ||
      entitlement.features.ai ||
      entitlement.features.ocr ||
      entitlement.features.cloudVoice);
  const readingLanguage = getReadingLanguage(preferences.bookLanguage);
  const canUseCloudVoice = Boolean(
    readingLanguage.cloudAiVoice &&
      entitlement.features.cloudVoice &&
      entitlement.limits.cloudVoiceCharsPerMonth > 0
  );
  const localVoiceReady = localVoiceStatus?.engineInstalled;
  const canUseRfVoicePlan = Boolean(entitlement.features.localVoice && readingLanguage.rfAi);
  const canUseRfVoice = Boolean(canUseRfVoicePlan && localVoiceReady);
  const localVoiceDailyLimit = Number(entitlement.limits.localVoiceSecondsPerDay || 0);
  const localVoiceRemainingLabel = formatLocalVoiceRemaining(
    localVoiceDailyLimit,
    localVoiceSecondsToday
  );
  const desiredVoiceMode = preferredVoiceMode(preferences, entitlement, localVoiceReady);
  const readerVoiceOptions = useMemo(
    () => [
      {
        engine: "device" as const,
        label: "Device",
        detail: canUseDeviceReadAloud ? "Included" : "Reader+",
        locked: !canUseDeviceReadAloud,
      },
      {
        engine: "local_ai" as const,
        label: "rF AI",
        detail: !canUseRfVoicePlan
          ? "AI Pro"
          : !readingLanguage.rfAi
          ? "English"
          : localVoiceStatus == null
            ? "Checking"
            : localVoiceReady
              ? localVoiceRemainingLabel
              : "Download",
        locked: !canUseRfVoice,
      },
      {
        engine: "cloud" as const,
        label: "Cloud AI",
        detail: readingLanguage.cloudAiVoice ? (canUseCloudVoice ? "Premium" : "Locked") : "QA",
        locked: !canUseCloudVoice,
      },
    ],
    [
      canUseCloudVoice,
      canUseRfVoice,
      canUseDeviceReadAloud,
      canUseRfVoicePlan,
      localVoiceRemainingLabel,
      localVoiceReady,
      localVoiceStatus,
      readingLanguage.cloudAiVoice,
      readingLanguage.rfAi,
    ]
  );

  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const ttsRef = useRef(createTTSProvider(providerKindFor(voiceMode)));
  const playingRef = useRef(false);
  const indexRef = useRef(0); // global sentence index being read
  const epochRef = useRef(0); // invalidates stale TTS onDone callbacks
  const pendingOffsetRef = useRef(0); // mid-sentence start offset for tap-to-read
  const currentIdRef = useRef<number | null>(null);
  const activeLineRef = useRef<ActiveLine>({ sentenceId: null, lineIndex: 0 });
  const activeCharRef = useRef<{ sentenceId: number; charOffset: number } | null>(null);
  const visiblePositionRef = useRef<ReadingPosition | null>(
    flat[initialSentenceIndex] ? positionForSentence(flat[initialSentenceIndex]) : null
  );
  const windowStartRef = useRef(windowStart);
  const windowEndRef = useRef(windowEnd);
  const suppressBackwardExpansionRef = useRef(initialSentenceIndex > 0);
  const pendingBackwardSeedRef = useRef(initialSentenceIndex > 0);
  const backwardSeedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineRangesRef = useRef<Map<number, LineRange[]>>(new Map());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundPlaybackAllowedRef = useRef(false);
  const cloudVoiceLimitWarnedRef = useRef(false);
  const cloudVoiceLanguageWarnedRef = useRef(false);
  const localVoiceWarnedRef = useRef(false);
  const saveLastReadRef = useRef<(updateBookmark?: boolean) => Promise<void>>(
    async () => {}
  );
  const leavingRef = useRef(false);
  const progressSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localVoiceSecondsRef = useRef(0);
  const localVoicePendingSecondsRef = useRef(0);
  const localVoiceProgressRef = useRef(0);
  const localVoiceWriteRef = useRef<Promise<number>>(Promise.resolve(0));
  const followRef = useRef(true); // auto-scroll to follow the voice (optional)
  const listRef = useRef<FlatList<Sentence>>(null);
  const readerViewportHeightRef = useRef(0);
  const followPlacementRef = useRef<{
    sentenceId: number;
    lineY: number;
    targetY: number;
  } | null>(null);
  const initialJumpRef = useRef(false);
  const layoutSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollInteractionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollFailureCountRef = useRef(0);
  const layoutScrollQuietRef = useRef(false);
  const layoutSignatureRef = useRef(`${Math.round(windowWidth)}:${lineHeight}`);
  const layoutRestorePendingRef = useRef(false);
  const isUserScrollingRef = useRef(false);
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
  const backgroundPlaybackAllowed =
    (entitlement.tier === "reviewer" ||
      entitlement.tier === "ai_pro" ||
      entitlement.tier === "power") &&
    (voiceMode === "local" || voiceMode === "natural");
  backgroundPlaybackAllowedRef.current = backgroundPlaybackAllowed;
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [loadingPageMsg, setLoadingPageMsg] = useState<string | null>(null);
  useEffect(() => {
    if (backwardSeedTimerRef.current) {
      clearTimeout(backwardSeedTimerRef.current);
      backwardSeedTimerRef.current = null;
    }
    ocrOfflineRef.current = false;
    pendingJumpRef.current = null;
    anchorRef.current = null;
    activeCharRef.current = null;
    activeLineRef.current = { sentenceId: null, lineIndex: 0 };
    followPlacementRef.current = null;
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
    windowStartRef.current = windowStart;
  }, [windowStart]);
  useEffect(() => {
    windowEndRef.current = windowEnd;
  }, [windowEnd]);
  useEffect(() => {
    if (!flat.length) return;
    setWindowEnd((end) => {
      const next = Math.min(
        flat.length,
        Math.max(end, Math.min(flat.length, windowFocusIndex + READER_WINDOW_AFTER))
      );
      windowEndRef.current = next;
      return next;
    });
  }, [flat.length, windowFocusIndex]);
  useEffect(() => {
    let alive = true;
    loadLocalNeuralVoiceStatus()
      .then((status) => {
        if (alive) setLocalVoiceStatus(status);
      })
      .catch(() => {
        if (alive) setLocalVoiceStatus((current) => current ?? getLocalNeuralVoiceStatus());
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    getLocalVoiceSecondsToday()
      .then((seconds) => {
        if (!alive) return;
        localVoiceSecondsRef.current = seconds;
        setLocalVoiceSecondsToday(seconds);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
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
    const previousProvider = ttsRef.current;
    if (previousProvider.dispose) void previousProvider.dispose();
    else void previousProvider.stop();
    playingRef.current = false;
    setIsPlaying(false);
    ttsRef.current = createTTSProvider(providerKindFor(desiredVoiceMode));
    setVoiceMode(desiredVoiceMode);
  }, [desiredVoiceMode, voiceMode]);
  useEffect(() => {
    if (canUseCloudVoice || voiceMode !== "natural") return;
    epochRef.current++;
    const previousProvider = ttsRef.current;
    if (previousProvider.dispose) void previousProvider.dispose();
    else void previousProvider.stop();
    ttsRef.current = createTTSProvider("device");
    setVoiceMode("device");
  }, [canUseCloudVoice, voiceMode]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState === "active") {
        if (previous !== "active" && layoutRestorePendingRef.current) {
          scheduleLayoutRestore(240);
        }
        return;
      }
      if (previous !== "active") return;

      if (layoutSettleTimerRef.current) {
        clearTimeout(layoutSettleTimerRef.current);
        layoutSettleTimerRef.current = null;
        layoutRestorePendingRef.current = true;
        layoutScrollQuietRef.current = false;
      }

      // Save the visible reading position even when audio is off. Android can
      // terminate the app after this transition, so waiting for Back/Stop loses it.
      saveLastReadRef.current();
      flushLocalVoiceUsage();
      if (!playingRef.current) return;

      // AI Pro and Power can continue generated audio with lock-screen controls.
      // Free and Reader Plus remain foreground-only, as does Android device TTS.
      if (backgroundPlaybackAllowedRef.current) return;
      epochRef.current++;
      playingRef.current = false;
      setIsPlaying(false);
      ttsRef.current.stop();
    });
    return () => sub.remove();
  }, []);

  function openFeatureLock(title: string, body: string) {
    setPaywallTitle(title);
    setPaywallBody(body);
    setShowPaywall(true);
  }

  function openReadAloudOffer() {
    if (entitlement.features.localVoice && readingLanguage.rfAi) {
      openFeatureLock(
        "Try rF AI free",
        "Free includes 5 minutes of rF AI reading each day. Return to the shelf, open Voice, choose rF AI, and download the optional offline voice pack."
      );
      return;
    }
    openFeatureLock(
      "Unlock read-aloud",
      "Listen mode starts with Reader Plus. Free keeps the reading preview manual, while Reader Plus unlocks device voice for full native-text books."
    );
  }

  function openLocalVoiceSetupNotice(body?: string) {
    setReaderNotice({
      title: "Download rF AI",
      body:
        body ||
        "Open Voice on the shelf and tap Download rF AI. The voice pack itself does not require registration or a subscription purchase.",
      secondary: { label: "Not now", tone: "secondary" },
      primary: { label: "Back to shelf", onPress: () => void handleBack() },
    });
  }

  function readAloudBlocked(): boolean {
    if (voiceMode !== "device" || canUseDeviceReadAloud) return false;
    openReadAloudOffer();
    return true;
  }

  function localVoiceQuotaExhausted(): boolean {
    return (
      localVoiceDailyLimit > 0 &&
      localVoiceSecondsRef.current + localVoicePendingSecondsRef.current >= localVoiceDailyLimit
    );
  }

  function openLocalVoiceLimitOffer() {
    openFeatureLock(
      "Daily rF AI preview finished",
      "Free includes 5 minutes of rF AI each day. Reader Plus includes unlimited downloaded rF AI during beta; AI Pro adds OCR, AI questions, and a Cloud AI allowance."
    );
  }

  function flushLocalVoiceUsage() {
    const seconds = Math.floor(localVoicePendingSecondsRef.current);
    if (seconds <= 0) return;
    localVoicePendingSecondsRef.current -= seconds;
    localVoiceSecondsRef.current += seconds;
    setLocalVoiceSecondsToday(localVoiceSecondsRef.current);
    localVoiceWriteRef.current = localVoiceWriteRef.current
      .then(() => addLocalVoiceSeconds(seconds))
      .catch(() => localVoiceSecondsRef.current);
  }

  function trackLocalVoiceProgress(currentTime: number) {
    if (voiceMode !== "local") return;
    const current = Math.max(0, Number(currentTime) || 0);
    const delta = Math.max(0, current - localVoiceProgressRef.current);
    localVoiceProgressRef.current = current;
    localVoicePendingSecondsRef.current += delta;
    if (localVoicePendingSecondsRef.current >= 5) flushLocalVoiceUsage();
    if (!localVoiceQuotaExhausted()) return;

    flushLocalVoiceUsage();
    epochRef.current++;
    playingRef.current = false;
    setIsPlaying(false);
    ttsRef.current.stop();
    saveLastReadRef.current();
    openLocalVoiceLimitOffer();
  }

  function selectVoiceEngine(engine: VoiceEngine) {
    if (engine === "device" && !canUseDeviceReadAloud) {
      openReadAloudOffer();
      return;
    }
    if (engine === "local_ai" && !entitlement.features.localVoice) {
      openFeatureLock(
        "Unlock rF AI voice",
        "rF AI voice is included in Reader Plus, AI Pro, and Power. Free includes a 5-minute daily preview when rF AI is available for the book language."
      );
      return;
    }
    if (engine === "local_ai" && !readingLanguage.rfAi) {
      openFeatureLock(
        "rF AI language pack",
        `rF AI is available for English right now. Use Phone voice for ${readingLanguage.label} until we add this language pack.`
      );
      return;
    }
    if (engine === "local_ai" && localVoiceReady === false) {
      openLocalVoiceSetupNotice(
        "rF AI is not ready on this phone. Return to the shelf, open Voice, and download the one-time voice pack. This does not require registration or a subscription purchase."
      );
      return;
    }
    if (engine === "local_ai" && localVoiceQuotaExhausted()) {
      openLocalVoiceLimitOffer();
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
        "Cloud AI is our highest-quality voice and is included in AI Pro and Power. Phone voice and rF AI stay available on eligible plans without OpenAI cost."
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

  function voiceAccessBlocked(): boolean {
    if (preferences.voiceEngine === "cloud" && !canUseCloudVoice) {
      openFeatureLock(
        "Unlock Cloud AI voice",
        readingLanguage.cloudAiVoice
          ? "Cloud AI voice is included in AI Pro and Power with a monthly allowance. Upgrade to use our highest-quality AI voice."
          : `Cloud AI voice is not release-ready for ${readingLanguage.label} yet. Use Phone voice on eligible plans while we add this language after quality testing.`
      );
      return true;
    }
    if (preferences.voiceEngine !== "local_ai") return false;
    if (!entitlement.features.localVoice) {
      openFeatureLock(
        "Unlock rF AI voice",
        "rF AI voice is included in Reader Plus, AI Pro, and Power. Free includes a 5-minute daily preview when rF AI is available for the book language."
      );
      return true;
    }
    if (!readingLanguage.rfAi) {
      openFeatureLock(
        "rF AI language pack",
        `rF AI is available for English right now. Use Phone voice for ${readingLanguage.label} on eligible plans until we add this language pack.`
      );
      return true;
    }
    if (localVoiceReady === false) {
      openLocalVoiceSetupNotice(
        "Return to the shelf, open Voice, and download the one-time rF AI voice pack. This does not require registration or a subscription purchase."
      );
      return true;
    }
    if (localVoiceQuotaExhausted()) {
      openLocalVoiceLimitOffer();
      return true;
    }
    return false;
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
          ? "AI Pro includes 750 OCR pages each month. The remaining scanned pages are saved and can continue after your monthly limit resets. Power raises OCR to 2,500 pages/month."
          : "Scanned pages use OCR. AI Pro includes 750 OCR pages/month, and Power includes 2,500.";
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
      if (scrollInteractionTimerRef.current) clearTimeout(scrollInteractionTimerRef.current);
      if (progressSaveTimerRef.current) clearTimeout(progressSaveTimerRef.current);
      if (backwardSeedTimerRef.current) clearTimeout(backwardSeedTimerRef.current);
      flushLocalVoiceUsage();
      saveLastReadRef.current();
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      const provider = ttsRef.current;
      if (provider.dispose) void provider.dispose();
      else void provider.stop();
    };
  }, []);

  // Hardware back: close panels / exit fullscreen first; only leave on a clean exit.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showPaywall) {
        setShowPaywall(false);
        return true;
      }
      if (readerNotice) {
        setReaderNotice(null);
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
      void handleBack();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immersive, readerNotice, showAI, showBookmarks, showPaywall]);

  // Resume at the stable page-relative position from the Library.
  useEffect(() => {
    const f = flatRef.current;
    const start = resolveReadingPosition(f, startPosition);
    initialJumpRef.current = start > 0;
    const sentence = f[start];
    if (!sentence) return;
    indexRef.current = start;
    visiblePositionRef.current = positionForSentence(sentence);
    setCurrent(sentence.id);
    const nextStart = start;
    const nextEnd = Math.min(
      f.length,
      start + READER_WINDOW_BEFORE + READER_WINDOW_AFTER
    );
    windowStartRef.current = nextStart;
    windowEndRef.current = nextEnd;
    suppressBackwardExpansionRef.current = start > 0;
    pendingBackwardSeedRef.current = start > 0;
    setWindowStart(nextStart);
    setWindowEnd(nextEnd);
    setWindowFocusIndex(start);
    setListGeneration((generation) => generation + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.docId]);

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
      anchorRef.current = {
        page: pg,
        within: Math.max(0, f[id].pageSentenceIndex),
      };
    }
  }
  function setActiveLineIndex(sentenceId: number | null, lineIndex: number) {
    const next = { sentenceId, lineIndex };
    const prev = activeLineRef.current;
    if (prev.sentenceId === next.sentenceId && prev.lineIndex === next.lineIndex) {
      if (sentenceId != null) keepActiveLineVisible(sentenceId, lineIndex);
      return;
    }
    activeLineRef.current = next;
    setActiveLine(next);
    if (sentenceId != null) keepActiveLineVisible(sentenceId, lineIndex);
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
  function visibleSentence(): Sentence | undefined {
    const position = visiblePositionRef.current;
    if (!position) return currentSentence();
    return flatRef.current[resolveReadingPosition(flatRef.current, position)];
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
  function planPageCap(): number {
    const cap = Number(entitlement.limits.perDocPageCap ?? freePageLimit);
    return Number.isFinite(cap) && cap > 0 ? cap : 0;
  }
  function freeCap(): number {
    if (doc.truncated && doc.pageCap) return Math.min(totalPages, doc.pageCap);
    const cap = planPageCap();
    return cap > 0 ? Math.min(totalPages, cap) : totalPages;
  }
  function isBeyondReturnedPageCap(page: number): boolean {
    return Boolean(doc.truncated && doc.pageCap && page > doc.pageCap);
  }
  function openPageLimitOffer() {
    openFeatureLock(
      "Page limit reached",
      `This plan includes the first ${doc.pageCap || planPageCap() || freePageLimit} pages of this document. Upgrade to Reader Plus for full native-text books.`
    );
  }

  function pageWithinIndex(sentence: Sentence, list = flatRef.current): number {
    if (Number.isFinite(sentence.pageSentenceIndex)) return sentence.pageSentenceIndex;
    return list.filter((item) => item.page === sentence.page).findIndex((item) => item.id === sentence.id);
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
    return createSpeechChunk(startIndex, list, {
      mode,
      firstOffset,
      pageCap: freeCap(),
    });
  }

  function locateChunkPosition(chunk: SpeechChunk, charOffset: number) {
    const bounded = Math.max(0, Math.min(Math.max(0, chunk.text.length - 1), charOffset));
    const span =
      chunk.spans.find((candidate) => bounded <= candidate.end) ||
      chunk.spans[chunk.spans.length - 1];
    if (!span) return null;
    const localOffset = Math.max(0, Math.min(span.sourceOffsets.length - 1, bounded - span.start));
    return {
      sentence: span.sentence,
      charOffset: span.sourceOffsets[localOffset] ?? span.sourceStart,
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

  function scheduleLayoutRestore(delay = 180) {
    if (layoutSettleTimerRef.current) clearTimeout(layoutSettleTimerRef.current);
    layoutRestorePendingRef.current = true;
    layoutScrollQuietRef.current = true;
    layoutSettleTimerRef.current = setTimeout(() => {
      layoutSettleTimerRef.current = null;
      if (appStateRef.current !== "active") {
        layoutScrollQuietRef.current = false;
        return;
      }

      const target = playingRef.current && followRef.current
        ? resolveAnchorIndex()
        : resolveReadingPosition(flatRef.current, visiblePositionRef.current);
      if (flatRef.current[target]) {
        indexRef.current = target;
        if (playingRef.current && followRef.current) {
          currentIdRef.current = target;
          setCurrentId(target);
          followPlacementRef.current = null;
          keepActiveLineVisible(
            target,
            activeLineRef.current.sentenceId === target ? activeLineRef.current.lineIndex : 0,
            true
          );
        } else {
          scrollToIndexSafe(target, false);
        }
      }
      layoutRestorePendingRef.current = false;
      layoutScrollQuietRef.current = false;
    }, delay);
  }

  useEffect(() => {
    const signature = `${Math.round(windowWidth)}:${lineHeight}`;
    if (layoutSignatureRef.current === signature) return;
    layoutSignatureRef.current = signature;
    lineRangesRef.current.clear();
    const activeChar = activeCharRef.current;
    if (activeChar) setActiveLineIndex(activeChar.sentenceId, 0);
    scheduleLayoutRestore(180);

    return () => {
      if (layoutSettleTimerRef.current) {
        clearTimeout(layoutSettleTimerRef.current);
        layoutSettleTimerRef.current = null;
        layoutRestorePendingRef.current = true;
        layoutScrollQuietRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowWidth, lineHeight]);

  // Perform a queued "go to page" once that page's text has finished loading.
  useEffect(() => {
    const target = pendingJumpRef.current;
    if (target == null) return;
    const idx = TextReflow.firstIndexOfPage(flat, target);
    if (idx >= 0) {
      pendingJumpRef.current = null;
      setLoadingPageMsg(null);
      jumpToSentence(idx, false, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat]);


  // ----- scrolling / follow (FlatList) -----
  function resetWindowAround(globalIndex: number) {
    const f = flatRef.current;
    const target = Math.max(0, Math.min(globalIndex, Math.max(0, f.length - 1)));
    // Put the requested anchor at local index zero. This avoids FlatList's
    // approximate scroll-to-index fallback for unmeasured variable-height rows.
    // Scrolling upward still prepends earlier rows through the expansion logic.
    const nextStart = target;
    const nextEnd = Math.min(
      f.length,
      target + READER_WINDOW_BEFORE + READER_WINDOW_AFTER
    );
    windowStartRef.current = nextStart;
    windowEndRef.current = nextEnd;
    suppressBackwardExpansionRef.current = target > 0;
    pendingBackwardSeedRef.current = target > 0;
    setWindowStart(nextStart);
    setWindowEnd(nextEnd);
    setWindowFocusIndex(target);
    setListGeneration((generation) => generation + 1);
  }

  function scrollToIndexSafe(index: number, animated: boolean, resetFailures = true) {
    if (index < 0 || index >= flatRef.current.length) return;
    const currentWindowStart = windowStartRef.current;
    const currentWindowEnd = windowEndRef.current;
    if (index < currentWindowStart || index >= currentWindowEnd) {
      resetWindowAround(index);
      return;
    }
    if (resetFailures) scrollFailureCountRef.current = 0;
    try {
      listRef.current?.scrollToIndex({
        index: index - currentWindowStart,
        viewPosition: 0.22,
        animated,
      });
    } catch {
      /* not measured yet; onScrollToIndexFailed handles it */
    }
  }

  /**
   * Paragraphs intentionally remain whole visual rows. Follow therefore has to
   * track the active wrapped line inside a row; scrolling only to the paragraph
   * allowed later lines to disappear beneath the bottom controls. Re-anchor in
   * small batches only when the projected line reaches the safe viewport edge.
   */
  function keepActiveLineVisible(sentenceId: number, lineIndex: number, force = false) {
    if (!playingRef.current || !followRef.current || isUserScrollingRef.current) return;
    if (sentenceId < 0 || sentenceId >= flatRef.current.length) return;

    const currentWindowStart = windowStartRef.current;
    const currentWindowEnd = windowEndRef.current;
    if (sentenceId < currentWindowStart || sentenceId >= currentWindowEnd) {
      resetWindowAround(sentenceId);
      followPlacementRef.current = null;
      return;
    }

    const viewportHeight = readerViewportHeightRef.current;
    if (viewportHeight <= 0) {
      scrollToIndexSafe(sentenceId, false);
      return;
    }

    const ranges = lineRangesRef.current.get(sentenceId);
    const range = ranges?.[lineIndex];
    const sentence = flatRef.current[sentenceId];
    const localIndex = sentenceId - currentWindowStart;
    const previous = localIndex > 0 ? flatRef.current[sentenceId - 1] : undefined;
    const dividerOffset = previous && previous.page !== sentence.page
      ? PAGE_DIVIDER_ESTIMATED_HEIGHT
      : 0;
    const lineY = dividerOffset + (range?.y ?? lineIndex * lineHeight);
    const targetY = Math.max(lineHeight * 1.4, viewportHeight * 0.3);
    const safeTop = Math.max(8, lineHeight * 0.45);
    const safeBottom = viewportHeight - Math.max(18, lineHeight * 1.65);
    const placed = followPlacementRef.current;
    const projectedY =
      placed && placed.sentenceId === sentenceId
        ? placed.targetY + (lineY - placed.lineY)
        : Number.POSITIVE_INFINITY;

    if (!force && projectedY >= safeTop && projectedY <= safeBottom) return;

    try {
      listRef.current?.scrollToIndex({
        index: localIndex,
        viewPosition: 0,
        viewOffset: targetY - lineY,
        animated: false,
      });
      followPlacementRef.current = { sentenceId, lineY, targetY };
    } catch {
      // The row will be measured by the existing bounded failure recovery.
      scrollToIndexSafe(sentenceId, false);
    }
  }

  function toggleFollow() {
    const next = !followRef.current;
    followRef.current = next;
    setAutoFollow(next);
    followPlacementRef.current = null;
    if (next && currentIdRef.current != null) {
      keepActiveLineVisible(
        currentIdRef.current,
        activeLineRef.current.sentenceId === currentIdRef.current
          ? activeLineRef.current.lineIndex
          : 0,
        true
      );
    }
  }

  // onViewableItemsChanged / viewabilityConfig must be stable across renders.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 35 }).current;
  const onViewableItemsChanged = useRef((info: { viewableItems: ViewToken[] }) => {
    const visible = info.viewableItems
      .filter((token) => token.isViewable && token.item)
      .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
    const first = visible[0];
    if (first && first.item) {
      const sentence = first.item as Sentence;
      const p = sentence.page;
      const position = positionForSentence(sentence);
      visiblePositionRef.current = position;
      setCurrentPage(p);
      currentPageRef.current = p;
      if (!playingRef.current || !followRef.current) indexRef.current = sentence.id;
      // Bias the background OCR engine toward what's on screen so scrolling keeps
      // loading the pages just ahead of you.
      OcrLoader.setPriority(docRef.current.docId, p);

      if (progressSaveTimerRef.current) clearTimeout(progressSaveTimerRef.current);
      progressSaveTimerRef.current = setTimeout(() => {
        progressSaveTimerRef.current = null;
        // Persist the visible location after scrolling settles. The named
        // "Last read" bookmark is updated on stop/back/background to avoid a
        // second storage write while the user is actively reading.
        saveLastReadRef.current(false);
      }, 700);

      const last = visible[visible.length - 1]?.item as Sentence | undefined;
      const currentWindowStart = windowStartRef.current;
      const currentWindowEnd = windowEndRef.current;
      if (
        pendingBackwardSeedRef.current &&
        sentence.id === currentWindowStart &&
        currentWindowStart > 0
      ) {
        pendingBackwardSeedRef.current = false;
        if (backwardSeedTimerRef.current) clearTimeout(backwardSeedTimerRef.current);
        backwardSeedTimerRef.current = setTimeout(() => {
          backwardSeedTimerRef.current = null;
          setWindowStart((start) => {
            const next = Math.max(0, start - READER_WINDOW_BACKWARD_EXPAND);
            windowStartRef.current = next;
            return next;
          });
          suppressBackwardExpansionRef.current = false;
        }, 0);
      }
      if (
        suppressBackwardExpansionRef.current &&
        sentence.id > currentWindowStart + 8
      ) {
        suppressBackwardExpansionRef.current = false;
      }
      if (
        !suppressBackwardExpansionRef.current &&
        sentence.id <= currentWindowStart + 8 &&
        currentWindowStart > 0
      ) {
        setWindowStart((start) => {
          const next = Math.max(0, start - READER_WINDOW_BACKWARD_EXPAND);
          windowStartRef.current = next;
          return next;
        });
      }
      if (
        last &&
        last.id >= currentWindowEnd - 20 &&
        currentWindowEnd < flatRef.current.length
      ) {
        setWindowEnd((end) => {
          const next = Math.min(flatRef.current.length, end + READER_WINDOW_FORWARD_EXPAND);
          windowEndRef.current = next;
          return next;
        });
      }
    }
  }).current;

  function onScrollToIndexFailed(info: { index: number; averageItemLength: number }) {
    const localIndex = Math.max(0, Math.min(info.index, Math.max(0, renderedFlat.length - 1)));
    listRef.current?.scrollToOffset({
      offset: Math.max(0, info.averageItemLength * localIndex),
      animated: false,
    });
    initialJumpRef.current = false;
    layoutScrollQuietRef.current = false;
    scrollFailureCountRef.current = 0;
  }

  function markUserScrollActive() {
    isUserScrollingRef.current = true;
    if (scrollInteractionTimerRef.current) {
      clearTimeout(scrollInteractionTimerRef.current);
      scrollInteractionTimerRef.current = null;
    }
  }

  function markUserScrollSettling(delay = 180) {
    if (scrollInteractionTimerRef.current) clearTimeout(scrollInteractionTimerRef.current);
    scrollInteractionTimerRef.current = setTimeout(() => {
      scrollInteractionTimerRef.current = null;
      isUserScrollingRef.current = false;
    }, delay);
  }

  function onReaderScrollBeginDrag() {
    markUserScrollActive();
    if (!followRef.current) return;
    followRef.current = false;
    setAutoFollow(false);
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
    if (voiceMode === "local" && localVoiceQuotaExhausted()) {
      flushLocalVoiceUsage();
      reachedEnd();
      openLocalVoiceLimitOffer();
      return;
    }
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
    const speech = speechForChunk(chunk, language, settingsRef.current.speed);
    const text = speech.text;
    const spokenLength = Math.max(1, text.length);
    localVoiceProgressRef.current = 0;

    indexRef.current = i;

    // Warm upcoming clips through the provider's in-flight cache so natural
    // voice can hand off smoothly without charging/fetching duplicates.
    let nextIndex = chunk.nextIndex;
    let nextOffset = chunk.nextOffset;
    const prefetchAhead = voiceMode === "local" ? LOCAL_AI_PREFETCH_AHEAD : TTS_PREFETCH_AHEAD;
    for (let ahead = 1; ahead <= prefetchAhead; ahead++) {
      const nextChunk = buildSpeechChunk(nextIndex, f, voiceMode, nextOffset);
      if (!nextChunk) break;
      const nextSpeech = speechForChunk(nextChunk, language, settingsRef.current.speed);
      ttsRef.current
        .prefetch?.(nextSpeech.text, {
          language,
          rate: nextSpeech.rate,
          voiceId: voiceIdFor(voiceMode, preferences),
          fallbackVoiceId: preferences.deviceVoiceId,
        })
        .catch(() => {});
      nextIndex = nextChunk.nextIndex;
      nextOffset = nextChunk.nextOffset;
    }

    // Advance from the ANCHORED position (re-resolved against the latest list) so
    // an OCR-driven index shift can never desync the voice from the highlight.
    const advance = () => {
      flushLocalVoiceUsage();
      if (!playingRef.current || myEpoch !== epochRef.current) return;
      const continueReading = () => {
        if (!playingRef.current || myEpoch !== epochRef.current) return;
        const anchored = resolvePageWithinIndex(chunk.lastPage, chunk.lastWithin);
        if (chunk.nextOffset > 0) {
          pendingOffsetRef.current = chunk.nextOffset;
          speakAt(anchored);
        } else {
          speakAt(anchored + 1);
        }
      };
      if (speech.isHeading) setTimeout(continueReading, TITLE_PAUSE_MS);
      else continueReading();
    };

    ttsRef.current.speak(text, {
      language,
      rate: speech.rate,
      voiceId: voiceIdFor(voiceMode, preferences),
      fallbackVoiceId: preferences.deviceVoiceId,
      lockScreenTitle: docRef.current.fileName || "readFlow",
      lockScreenSubtitle: `Page ${s.page} - ${voiceLabelFor(voiceMode)}`,
      lockScreenAlbum: "readFlow",
      allowBackgroundPlayback: backgroundPlaybackAllowedRef.current,
      onFallback: (info) => {
        if (info.reason === "quota" && !cloudVoiceLimitWarnedRef.current) {
          cloudVoiceLimitWarnedRef.current = true;
            openFeatureLock(
              "AI voice allowance used",
            "Your Cloud AI allowance is used for this month. Phone voice can keep reading on Reader Plus and higher without cloud AI cost. You can renew next month, upgrade to Power, or buy an AI voice pack when purchases are live."
          );
      } else if (info.reason === "local_unavailable" && !localVoiceWarnedRef.current) {
          localVoiceWarnedRef.current = true;
          epochRef.current++;
          playingRef.current = false;
          setIsPlaying(false);
          setLocalVoiceStatus((current) =>
            current
              ? { ...current, modelDownloaded: false, engineInstalled: false }
              : getLocalNeuralVoiceStatus()
          );
          ttsRef.current.stop();
          ttsRef.current = createTTSProvider("device");
          setVoiceMode("device");
          openLocalVoiceSetupNotice(
            info.message ||
              "Return to the shelf, open Voice, and download the one-time rF AI voice pack."
          );
        } else if (info.reason === "language_unsupported" && !cloudVoiceLanguageWarnedRef.current) {
          cloudVoiceLanguageWarnedRef.current = true;
          openFeatureLock(
            "Cloud AI voice QA",
            info.message ||
              "Cloud AI voice is not release-ready for this language yet. Phone voice can keep reading on eligible plans."
          );
        }
      },
      onStart: () => {
        if (myEpoch !== epochRef.current) return;
        const start = firstPosition?.sentence ?? s;
        setCurrent(start.id);
        followPlacementRef.current = null;
        setActiveLineByChar(start.id, firstPosition?.charOffset ?? baseOffset);
      },
      onProgress: ({ currentTime, duration }) => {
        if (myEpoch !== epochRef.current || duration <= 0) return;
        trackLocalVoiceProgress(currentTime);
        if (!playingRef.current || myEpoch !== epochRef.current) return;
        const ratio = Math.max(0, Math.min(0.999, currentTime / duration));
        const spokenOffset = Math.floor(spokenLength * ratio);
        const position = locateChunkPosition(
          chunk,
          Math.max(0, spokenOffset - speech.prefixLength)
        );
        if (!position) return;
        indexRef.current = position.sentence.id;
        if (currentIdRef.current !== position.sentence.id) {
          setCurrent(position.sentence.id);
          followPlacementRef.current = null;
        }
        setActiveLineByChar(position.sentence.id, position.charOffset);
      },
      onDone: advance,
      onError: advance,
    });
  }

  function reachedEnd() {
    flushLocalVoiceUsage();
    saveLastRead();
    playingRef.current = false;
    setIsPlaying(false);
    ttsRef.current.stop();
  }

  function play() {
    if (readAloudBlocked()) return;
    if (voiceAccessBlocked()) return;
    playingRef.current = true;
    setIsPlaying(true);
    speakAt(indexRef.current);
  }

  function pause() {
    rememberSpeechResumePoint();
    epochRef.current++; // drop any in-flight onDone so it can't auto-advance
    playingRef.current = false;
    setIsPlaying(false);
    ttsRef.current.stop(); // resume re-speaks only the current grammatical sentence
    flushLocalVoiceUsage();
  }

  function stop() {
    rememberSpeechResumePoint();
    epochRef.current++;
    playingRef.current = false;
    setIsPlaying(false);
    ttsRef.current.stop();
    flushLocalVoiceUsage();
    saveLastRead(); // requirement: stopping saves the current position
  }

  function rememberSpeechResumePoint() {
    const active = activeCharRef.current;
    const sentence = active ? flatRef.current[active.sentenceId] : undefined;
    if (!active || !sentence || sentence.id !== indexRef.current) return;
    pendingOffsetRef.current = resumeSpeechOffset(sentence.text, active.charOffset);
  }

  function onPlayPause() {
    isPlaying ? pause() : play();
  }

  // ----- tap-to-read -----
  function onTapWord(globalId: number, charOffset: number) {
    if (isUserScrollingRef.current) return;
    // Sound off = reading mode: a tap toggles the menus instead of reading,
    // so the page can fill the whole screen.
    if (!soundEnabledRef.current) {
      setChromeVisible((v) => !v);
      return;
    }
    if (readAloudBlocked()) return;
    if (voiceAccessBlocked()) return;
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
    if (!soundEnabledRef.current && readAloudBlocked()) return;
    setSoundEnabled((on) => {
      const next = !on;
      if (!next) {
        // Leaving listening mode: hard-stop the voice.
        epochRef.current++;
        playingRef.current = false;
        setIsPlaying(false);
        ttsRef.current.stop();
        flushLocalVoiceUsage();
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
      jumpToSentence(idx, false, true);
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
    const target = resolveReadingPosition(flatRef.current, {
      page: b.page,
      pageSentenceIndex: b.pageSentenceIndex,
      sentenceId: b.sentenceId,
      preview: b.preview,
    });
    jumpToSentence(target, false, true);
    setShowBookmarks(false);
  }

  function jumpToSentence(globalId: number, autoplay: boolean, resetWindow = false) {
    const s = flatRef.current[globalId];
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
    const position = positionForSentence(s);
    visiblePositionRef.current = position;
    if (
      resetWindow ||
      globalId < windowStartRef.current ||
      globalId >= windowEndRef.current
    ) {
      resetWindowAround(globalId);
    } else {
      scrollToIndexSafe(globalId, false);
    }
    if (autoplay) {
      if (readAloudBlocked()) return;
      playingRef.current = true;
      setIsPlaying(true);
      setTimeout(() => speakAt(globalId), 150);
    } else {
      playingRef.current = false;
      setIsPlaying(false);
    }
  }

  // ----- bookmarks -----
  async function saveLastRead(updateBookmark = true): Promise<void> {
    const s = visibleSentence();
    if (!s) return;
    const position = positionForSentence(s);
    const progressWrite = Promise.resolve(onProgress?.(position, totalPages)).catch(() => {});
    const bookmarkWrite = updateBookmark
      ? Bookmarks.upsert({
          tag: "Last read",
          docId: doc.docId,
          fileName: doc.fileName,
          page: s.page,
          chunkIndex: 0,
          sentenceId: s.id,
          pageSentenceIndex: s.pageSentenceIndex,
          preview: s.text.slice(0, 60),
        }).catch(() => {})
      : Promise.resolve();
    await Promise.all([progressWrite, bookmarkWrite]);
  }
  saveLastReadRef.current = saveLastRead;

  async function handleBack() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    // Fully halt playback so the voice never keeps reading back on the Library.
    epochRef.current++;
    playingRef.current = false;
    setIsPlaying(false);
    ttsRef.current.stop();
    await saveLastRead();
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

  const cs = visibleSentence();
  const visibleAnchor = visiblePositionRef.current;
  const currentPos: ReadingPosition & { chunkIndex: number } = {
    page: visibleAnchor?.page ?? cs?.page ?? currentPage,
    chunkIndex: 0,
    pageSentenceIndex: visibleAnchor?.pageSentenceIndex ?? cs?.pageSentenceIndex ?? 0,
    sentenceId: visibleAnchor?.sentenceId ?? cs?.id ?? flat[0]?.id ?? 0,
    preview: (visibleAnchor?.preview ?? cs?.text ?? flat[0]?.text ?? "").slice(0, 60),
  };
  const initialWindowIndex = Math.max(
    0,
    Math.min(windowFocusIndex - windowStart, Math.max(0, renderedFlat.length - 1))
  );
  // Live status-bar inset (works with Android edge-to-edge + rotation). When the
  // status bar is hidden (immersive) the inset collapses to 0, which is correct.
  const topInset = immersive ? 0 : Math.max(insets.top, Constants.statusBarHeight);
  const topPad = topInset + theme.spacing(immersive ? 0.5 : 1);
  // The control bar shows when listening (pinned) or when the chrome is revealed.
  const controlsShown = soundEnabled || chromeVisible;
  // Controls participate in flex layout, so the reading viewport already ends
  // above them. Keep only ordinary page padding inside the list.
  const readerBottomPad = theme.spacing(3);

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
              hitSlop={8}
              style={styles.pageNavAi}
              onPress={() => {
                if (canUseAI) {
                  setShowAI(true);
                  return;
                }
                openFeatureLock(
                  "Unlock AI",
                  "Summaries, explanations, Q&A, and capped Cloud AI are part of AI Pro. Reader Plus keeps Phone voice available without cloud voice cost."
                );
              }}
            >
              <Text style={styles.pageNavAiText}>{canUseAI ? "AI" : "AI Pro"}</Text>
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
        key={`${doc.docId}:${listGeneration}`}
        ref={listRef}
        data={renderedFlat}
        keyExtractor={(s) => s.key}
        extraData={`${currentId ?? "n"}:${activeLine.sentenceId ?? "n"}:${activeLine.lineIndex}:${settings.fontSize}:${lineHeight}`}
        renderItem={({ item, index }: ListRenderItemInfo<Sentence>) => (
          <SentenceRow
            sentence={item}
            active={item.id === currentId}
            measureForHighlight={
              currentId != null && item.id >= currentId && item.id <= currentId + 3
            }
            activeLineIndex={item.id === activeLine.sentenceId ? activeLine.lineIndex : null}
            fontSize={settings.fontSize}
            lineHeight={lineHeight}
            layoutKey={`${Math.round(windowWidth)}:${lineHeight}`}
            rtl={Boolean(readingLanguage.rtl)}
            onTapWord={tapHandler}
            onLineRanges={handleLineRanges}
            showPageDivider={index > 0 && renderedFlat[index - 1].page !== item.page}
          />
        )}
        style={styles.reader}
        contentContainerStyle={[styles.readerContent, { paddingBottom: readerBottomPad }]}
        onLayout={(event) => {
          const nextHeight = Number(event.nativeEvent.layout.height || 0);
          if (Math.abs(nextHeight - readerViewportHeightRef.current) < 1) return;
          readerViewportHeightRef.current = nextHeight;
          followPlacementRef.current = null;
          if (playingRef.current && followRef.current && activeLineRef.current.sentenceId != null) {
            keepActiveLineVisible(
              activeLineRef.current.sentenceId,
              activeLineRef.current.lineIndex,
              true
            );
          }
        }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onScrollBeginDrag={onReaderScrollBeginDrag}
        onScrollEndDrag={() => markUserScrollSettling(260)}
        onMomentumScrollEnd={() => markUserScrollSettling(80)}
        initialScrollIndex={initialWindowIndex > 0 ? initialWindowIndex : undefined}
        initialNumToRender={24}
        maxToRenderPerBatch={16}
        windowSize={9}
        updateCellsBatchingPeriod={32}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onEndReached={() =>
          setWindowEnd((end) => {
            const next = Math.min(flatRef.current.length, end + READER_WINDOW_FORWARD_EXPAND);
            windowEndRef.current = next;
            return next;
          })
        }
        onEndReachedThreshold={0.45}
        removeClippedSubviews={false}
      />

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
          voiceEngine={voiceEngineForMode(voiceMode)}
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

      <ThemedNotice
        visible={Boolean(readerNotice)}
        title={readerNotice?.title || ""}
        body={readerNotice?.body || ""}
        primary={readerNotice?.primary}
        secondary={readerNotice?.secondary}
        onClose={() => setReaderNotice(null)}
      />

      {/* upgrade notice / paywall */}
      <UpgradeSheet
        visible={showPaywall}
        reasonTitle={paywallTitle}
        reasonBody={paywallBody}
        onClose={() => setShowPaywall(false)}
        purchasingAvailable={purchasingAvailable}
        purchaseSetupLoading={purchaseSetupLoading}
        purchasing={purchasing}
        purchaseError={purchaseError}
        onPurchase={onPurchasePlan}
        onRestore={onRestorePurchases}
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
  measureForHighlight: boolean;
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
  measureForHighlight,
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
  const referenceMarkers = useMemo(
    () => TextReflow.referenceMarkers(sentence.text, sentence.kind),
    [sentence.kind, sentence.text]
  );
  const [lines, setLines] = useState<LineSegment[] | null>(null);

  useEffect(() => {
    setLines(null);
  }, [sentence.text, fontSize, lineHeight, layoutKey]);

  function handleTextLayout(e: any) {
    if (!measureForHighlight) return;
    const next = buildLineSegments(sentence.text, e?.nativeEvent?.lines || []);
    if (next.length === 0) return;
    setLines((prev) => (sameLineSegments(prev, next) ? prev : next));
    onLineRanges(sentence.id, next);
  }

  function renderWordText(word: string, absoluteStart: number) {
    const absoluteEnd = absoluteStart + word.length;
    const markers = referenceMarkers.filter(
      (marker) => marker.start < absoluteEnd && marker.end > absoluteStart
    );
    if (!markers.length) return word;

    const parts: React.ReactNode[] = [];
    let cursor = absoluteStart;
    for (const marker of markers) {
      const markerStart = Math.max(absoluteStart, marker.start);
      const markerEnd = Math.min(absoluteEnd, marker.end);
      if (markerStart > cursor) {
        parts.push(sentence.text.slice(cursor, markerStart));
      }
      parts.push(
        <Text
          key={`reference-${markerStart}`}
          style={[styles.referenceMarker, { fontSize: Math.max(9, Math.round(fontSize * 0.62)) }]}
        >
          {formatReferenceMarker(sentence.text.slice(markerStart, markerEnd))}
        </Text>
      );
      cursor = markerEnd;
    }
    if (cursor < absoluteEnd) parts.push(sentence.text.slice(cursor, absoluteEnd));
    return parts;
  }

  function renderTokenText(
    tokenSource: { word: string; offset: number }[],
    baseOffset = 0,
    highlightedRange?: LineRange
  ) {
    return tokenSource.map((t, wi) => {
      const absoluteOffset = baseOffset + t.offset;
      const highlighted = Boolean(
        highlightedRange &&
          absoluteOffset >= highlightedRange.start &&
          absoluteOffset < highlightedRange.end
      );
      return (
      <Text
        key={`${baseOffset}-${wi}`}
        onPress={() => onTapWord(sentence.id, absoluteOffset)}
        style={highlighted ? styles.activeLine : undefined}
      >
        {renderWordText(t.word, baseOffset + t.offset)}
        {wi < tokenSource.length - 1 ? " " : ""}
      </Text>
      );
    });
  }

  const textStyle = {
    fontSize: sentence.kind === "heading" ? Math.round(fontSize * 1.18) : fontSize,
    lineHeight: sentence.kind === "heading" ? Math.round(lineHeight * 1.16) : lineHeight,
    textAlign: rtl ? "right" : "left",
    writingDirection: rtl ? "rtl" : "ltr",
  } as const;
  // Android's onTextLayout output is useful for locating the active line, but
  // it is not an authoritative copy of the paragraph. In particular, nested
  // tappable/reference Text spans can make a reported line omit a word. Keep
  // rendering the complete source paragraph and use only the measured source
  // range to decorate its tokens; switching to reconstructed line Text nodes
  // made those omitted measurements disappear from the page until playback
  // advanced.
  const highlightedRange =
    active && activeLineIndex != null && lines?.length ? lines[activeLineIndex] : undefined;

  return (
    <View style={rtl ? styles.rtlRowWrap : undefined}>
      {showPageDivider ? (
        <View style={styles.pageDivider}>
          <View style={styles.pageDividerLine} />
          <Text style={styles.pageDividerLabel}>Page {sentence.page}</Text>
          <View style={styles.pageDividerLine} />
        </View>
      ) : null}
      <Text
        key={`${layoutKey}:${measureForHighlight ? "measure" : "idle"}`}
        style={[styles.row, sentence.kind === "heading" && styles.headingRow, textStyle]}
        onTextLayout={measureForHighlight ? handleTextLayout : undefined}
      >
        {renderTokenText(tokens, 0, highlightedRange)}
      </Text>
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
    out.push({
      text: lineText,
      start,
      end,
      y: Number.isFinite(Number(nativeLine?.y)) ? Number(nativeLine.y) : out.length * 1,
      height: Number.isFinite(Number(nativeLine?.height)) ? Number(nativeLine.height) : 0,
    });
    searchFrom = end;
    while (searchFrom < text.length && /\s/.test(text[searchFrom])) searchFrom++;
  }

  // A native line report can omit the text of a nested span. Close any gap up
  // to the next measured line so every source character still belongs to one
  // highlight range. Rendering never consumes these fragments; they are only
  // position/range metadata for the authoritative paragraph above.
  for (let index = 0; index < out.length; index++) {
    const nextStart = index + 1 < out.length ? out[index + 1].start : text.length;
    if (nextStart > out[index].end) {
      out[index].end = nextStart;
      out[index].text = text.slice(out[index].start, nextStart).trimEnd();
    }
  }

  return out.length ? out : [{ text, start: 0, end: text.length, y: 0, height: 0 }];
}

function sameLineSegments(prev: LineSegment[] | null, next: LineSegment[]): boolean {
  if (!prev || prev.length !== next.length) return false;
  return prev.every(
    (line, index) =>
      line.start === next[index].start &&
      line.end === next[index].end &&
      line.text === next[index].text &&
      Math.abs(line.y - next[index].y) < 0.5 &&
      Math.abs(line.height - next[index].height) < 0.5
  );
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

function formatReferenceMarker(value: string): string {
  const bracketed = value.startsWith("[") && value.endsWith("]");
  const core = bracketed ? value.slice(1, -1) : value;
  const superscript = core
    .split("")
    .map((char) => SUPERSCRIPT_DIGITS[char] || (char === "-" ? "⁻" : char))
    .join("");
  return bracketed ? `⁽${superscript}⁾` : superscript;
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
  pageNavAi: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pageNavAiText: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontFamily: theme.fonts.sansSemiBold,
  },
  reader: { flex: 1 },
  readerContent: { padding: theme.spacing(3) },
  row: { color: theme.colors.body, fontFamily: theme.fonts.serif, paddingVertical: 3 },
  headingRow: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sansSemiBold,
    paddingTop: theme.spacing(2.4),
    paddingBottom: theme.spacing(1.2),
  },
  rtlRowWrap: { alignItems: "stretch" },
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
  activeLine: {
    backgroundColor: theme.colors.highlight,
    color: theme.colors.text,
  },
  referenceMarker: {
    color: theme.colors.textDim,
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
