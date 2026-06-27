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
} from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { ParsedPdf, PdfPage, PDFParser } from "../services/PDFParser";
import { DocCache } from "../services/DocCache";
import { Sentence, TextReflow } from "../services/TextReflow";
import { Bookmark, Bookmarks } from "../services/Bookmarks";
import { createTTSProvider } from "../services/tts";
import { Controls, ReadingSettings } from "./Controls";
import { AIPanel } from "./AIPanel";
import { BookmarkPanel } from "./BookmarkPanel";
import { EntitlementSnapshot } from "../services/Entitlements";
import { theme } from "../theme";

interface Props {
  doc: ParsedPdf;
  entitlement: EntitlementSnapshot;
  language?: string; // BCP-47, e.g. "en-US"
  /** Pages readable for free before the subscribe gate. */
  freePageLimit?: number;
  /** Sentence id to resume from (from the Library). */
  startSentenceId?: number;
  /** Reports the latest reading position so the Library can persist it. */
  onProgress?: (page: number, sentenceId: number, totalPages: number) => void;
  onBack: () => void;
}

const ENFORCE_FREE_LIMIT = false;

export function Reader({
  doc,
  entitlement,
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

  const [settings, setSettings] = useState<ReadingSettings>({
    fontSize: 22,
    lineSpacing: 1.5,
    speed: 1.0,
  });
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [immersive, setImmersive] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"natural" | "device">("device");
  const [paywallTitle, setPaywallTitle] = useState("Paid feature");
  const [paywallBody, setPaywallBody] = useState(
    "This feature is available on paid plans. Free users can continue with local reading and device voice."
  );
  const [controlsOpen, setControlsOpen] = useState(false);

  const canUseAI = Boolean(entitlement.features.ai);
  const canUseOcr = Boolean(entitlement.features.ocr);
  // TTS route is currently gated by the backend AI feature.
  const canUseCloudVoice = canUseAI;

  const insets = useSafeAreaInsets();
  const ttsRef = useRef(createTTSProvider(voiceMode === "natural" ? "cloud" : "device"));
  const playingRef = useRef(false);
  const indexRef = useRef(0); // global sentence index being read
  const epochRef = useRef(0); // invalidates stale TTS onDone callbacks
  const pendingOffsetRef = useRef(0); // mid-sentence start offset for tap-to-read
  const currentIdRef = useRef<number | null>(null);
  const followRef = useRef(true); // auto-scroll to follow the voice (optional)
  const listRef = useRef<FlatList<Sentence>>(null);
  const settingsRef = useRef(settings);
  // Stable tap handler so memoized rows never re-render on scroll/highlight.
  const onTapWordRef = useRef<(id: number, offset: number) => void>(() => {});
  const tapHandler = useRef((id: number, offset: number) => onTapWordRef.current(id, offset))
    .current;

  // ----- background OCR (so big scanned docs open fast, then fill in fully) -----
  const pendingOcrRef = useRef<Set<number>>(new Set(doc.pendingOcr ?? []));
  const currentPageRef = useRef(1); // page currently in view (drives OCR priority)
  const prioritizePageRef = useRef<number | null>(null); // page to OCR next
  const pendingJumpRef = useRef<number | null>(null); // page to jump to once loaded
  const ocrOfflineRef = useRef(false); // background OCR paused because we're offline
  const anchorRef = useRef<{ page: number; within: number } | null>(null);
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const [loadingPageMsg, setLoadingPageMsg] = useState<string | null>(null);
  useEffect(() => {
    pendingOcrRef.current = new Set(doc.pendingOcr ?? []);
    ocrOfflineRef.current = false;
    prioritizePageRef.current = null;
    pendingJumpRef.current = null;
    anchorRef.current = null;
    setOcrNote(null);
    setLoadingPageMsg(null);
  }, [doc]);

  const langCode = language.split("-")[0];

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
    useEffect(() => {
      if (canUseCloudVoice || voiceMode !== "natural") return;
      epochRef.current++;
      ttsRef.current.stop();
      ttsRef.current = createTTSProvider("device");
      setVoiceMode("device");
    }, [canUseCloudVoice, voiceMode]);

    function openFeatureLock(title: string, body: string) {
      setPaywallTitle(title);
      setPaywallBody(body);
      setShowPaywall(true);
    }

  useEffect(() => {
    return () => {
      // Hard-stop on unmount so the voice never keeps reading after you leave.
      epochRef.current++;
      playingRef.current = false;
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
    const start = Math.max(0, Math.min(startSentenceId, flat.length - 1));
    if (start <= 0) return;
    indexRef.current = start;
    setCurrent(flat[start]?.id ?? null);
    const t = setTimeout(() => scrollToIndexSafe(start, false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // ----- helpers -----
  function setCurrent(id: number | null) {
    currentIdRef.current = id;
    setCurrentId(id);
    if (id != null && flat[id]) {
      const pg = flat[id].page;
      setCurrentPage(pg);
      currentPageRef.current = pg;
      // Remember WHICH sentence (page + position within page) is active so the
      // highlight can re-anchor if OCR later inserts pages and shifts indices.
      const within = flat.filter((s) => s.page === pg).findIndex((s) => s.id === id);
      anchorRef.current = { page: pg, within: Math.max(0, within) };
    }
  }
  function currentSentence(): Sentence | undefined {
    const id = currentIdRef.current ?? indexRef.current;
    return flat[id];
  }
  function freeCap(): number {
    if (!ENFORCE_FREE_LIMIT) return totalPages;
    return Math.min(totalPages, freePageLimit);
  }

  // Merge freshly OCR'd pages into the page list (kept sorted by page number).
  function mergeOcrPages(improved: { page: number; text: string; confidence?: number }[]) {
    setPages((prev) => {
      const map = new Map(prev.map((p) => [p.page, p] as const));
      for (const r of improved) {
        const existing = map.get(r.page);
        if (!existing || r.text.length > existing.text.length) {
          map.set(r.page, { page: r.page, text: r.text, source: "ocr", confidence: r.confidence });
        }
      }
      return Array.from(map.values()).sort((a, b) => a.page - b.page);
    });
  }

  // Continuously OCR every pending scanned page in the background, prioritised by
  // whatever page you're looking at / jumping to, so pages keep loading as you
  // scroll and never stall. Pauses cleanly (with a note) if the network drops.
  useEffect(() => {
    if (!canUseOcr || !doc.docToken || pendingOcrRef.current.size === 0) return;
    const token = doc.docToken;
    let cancelled = false;

    (async () => {
      await new Promise((r) => setTimeout(r, 300)); // let the first paint settle
      while (!cancelled && pendingOcrRef.current.size > 0) {
        const focus = prioritizePageRef.current ?? currentPageRef.current ?? 1;
        const want = [...pendingOcrRef.current]
          .sort((a, b) => Math.abs(a - focus) - Math.abs(b - focus) || a - b)
          .slice(0, 4);

        let results;
        try {
          results = await PDFParser.ocrPages(token, want);
        } catch {
          // Likely offline — pause the loop and tell the reader why.
          ocrOfflineRef.current = true;
          if (!cancelled)
            setOcrNote("You're offline — scanned pages will finish loading when you reconnect.");
          break;
        }
        if (cancelled) break;

        for (const p of want) pendingOcrRef.current.delete(p);
        const improved = (results || []).filter((r) => r.text && r.text.trim().length > 0);
        if (improved.length > 0) mergeOcrPages(improved);
        if (
          prioritizePageRef.current != null &&
          !pendingOcrRef.current.has(prioritizePageRef.current)
        ) {
          prioritizePageRef.current = null;
        }
        await new Promise((r) => setTimeout(r, 120)); // be gentle on the backend
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, canUseOcr]);

  // Persist merged OCR text so the book becomes fully available offline.
  useEffect(() => {
    if (!doc.docToken) return; // cache-only docs are already saved
    const t = setTimeout(() => {
      DocCache.update(doc.docId, pages, [...pendingOcrRef.current]).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  // Re-anchor the highlight after OCR inserts pages (so it stays on the same
  // sentence even though array indices shifted). Never moves the cursor while the
  // voice is actively reading.
  useEffect(() => {
    const a = anchorRef.current;
    if (!a || playingRef.current) return;
    const onPage = flat.filter((s) => s.page === a.page);
    if (onPage.length === 0) return;
    const target = onPage[Math.min(a.within, onPage.length - 1)];
    if (target && target.id !== currentIdRef.current) {
      currentIdRef.current = target.id;
      indexRef.current = target.id;
      setCurrentId(target.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat]);

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
  function scrollToIndexSafe(index: number, animated: boolean) {
    if (index < 0 || index >= flat.length) return;
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
    if (next && currentIdRef.current != null) scrollToIndexSafe(currentIdRef.current, true);
  }

  // onViewableItemsChanged / viewabilityConfig must be stable across renders.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current;
  const onViewableItemsChanged = useRef((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems.find((v) => v.isViewable);
    if (first && first.item) {
      const p = (first.item as Sentence).page;
      setCurrentPage(p);
      currentPageRef.current = p;
      // Bias background OCR toward what's on screen so scrolling keeps loading.
      prioritizePageRef.current = p;
    }
  }).current;

  function onScrollToIndexFailed(info: { index: number; averageItemLength: number }) {
    listRef.current?.scrollToOffset({
      offset: info.averageItemLength * info.index,
      animated: false,
    });
    setTimeout(() => scrollToIndexSafe(info.index, true), 60);
  }

  // ----- playback -----
  function speakAt(i: number) {
    const myEpoch = ++epochRef.current; // any earlier utterance's callback is now stale
    if (i < 0 || i >= flat.length) {
      reachedEnd();
      return;
    }
    const s = flat[i];
    if (s.page > freeCap()) {
      saveLastRead();
      playingRef.current = false;
      setIsPlaying(false);
      openFeatureLock(
        "Page limit reached",
        `You've reached the free reading limit (${freePageLimit} pages). Upgrade to continue reading this document.`
      );
      return;
    }

    indexRef.current = i;
    setCurrent(s.id);
    if (followRef.current) scrollToIndexSafe(i, true);

    const offset = pendingOffsetRef.current;
    pendingOffsetRef.current = 0;
    const text = offset > 0 ? s.text.slice(offset) : s.text;

    // Warm the next sentence's audio so the natural voice has no gap.
    const next = flat[i + 1];
    if (next && next.page <= freeCap()) {
      ttsRef.current.prefetch?.(next.text, { language, rate: settingsRef.current.speed }).catch(
        () => {}
      );
    }

    ttsRef.current.speak(text, {
      language,
      rate: settingsRef.current.speed,
      onDone: () => {
        if (playingRef.current && myEpoch === epochRef.current) speakAt(i + 1);
      },
      onError: () => {
        if (playingRef.current && myEpoch === epochRef.current) speakAt(i + 1);
      },
    });
  }

  function reachedEnd() {
    saveLastRead();
    playingRef.current = false;
    setIsPlaying(false);
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

  function toggleVoice() {
    if (voiceMode === "device" && !canUseCloudVoice) {
      openFeatureLock(
        "Cloud voice is paid",
        "Natural cloud voice requires a paid plan. Free users can continue with device voice."
      );
      return;
    }
    const next = voiceMode === "natural" ? "device" : "natural";
    epochRef.current++;
    ttsRef.current.stop();
    playingRef.current = false;
    setIsPlaying(false);
    ttsRef.current = createTTSProvider(next === "natural" ? "cloud" : "device");
    setVoiceMode(next);
  }

  // ----- tap-to-read -----
  function onTapWord(globalId: number, charOffset: number) {
    epochRef.current++; // invalidate the sentence we're interrupting (prevents double-read)
    ttsRef.current.stop();
    indexRef.current = globalId;
    pendingOffsetRef.current = charOffset;
    playingRef.current = true;
    setIsPlaying(true);
    speakAt(globalId);
  }
  onTapWordRef.current = onTapWord;

  // ----- navigation -----
  function goToPage(page: number) {
    const p = Math.max(1, Math.min(totalPages, page));
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
        `Page ${p} is a scanned page. Reading it needs OCR, available on paid plans with an internet connection.`
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
    prioritizePageRef.current = p;
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
      openFeatureLock(
        "Page limit reached",
        `You've reached the free reading limit (${freePageLimit} pages). Upgrade to continue reading this document.`
      );
      return;
    }
    epochRef.current++;
    ttsRef.current.stop();
    indexRef.current = globalId;
    pendingOffsetRef.current = 0;
    setCurrent(globalId);
    scrollToIndexSafe(globalId, true);
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

  const lineHeight = Math.round(settings.fontSize * settings.lineSpacing);
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
  // Float the AI button just above the controls; the bar is shorter when collapsed.
  const fabBottom = (controlsOpen ? 268 : 96) + insets.bottom;

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" hidden={immersive} />

      {/* In fullscreen we hide the top bar entirely (the Exit button used to sit
          under the camera cutout). Use the Android back button to leave fullscreen. */}
      {immersive ? (
        <View style={{ height: insets.top }} />
      ) : (
        <>
          {/* header */}
          <View style={[styles.header, { paddingTop: topPad }]}>
            <Pressable onPress={handleBack} hitSlop={10}>
              <Text style={styles.headerBtn}>←</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName} numberOfLines={1}>
                {doc.fileName}
              </Text>
              <Text style={styles.pageRange}>
                Page {currentPage} of {totalPages}
                {doc.ocrPages > 0 ? `  ·  OCR ${doc.ocrPages}p` : ""}
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
              <Text style={styles.chipText}>Full</Text>
            </Pressable>
            <Pressable onPress={() => setShowBookmarks(true)} hitSlop={8}>
              <Text style={styles.headerIcon}>🔖</Text>
            </Pressable>
          </View>

          {/* page nav strip */}
          <View style={styles.pageNav}>
            <Pressable onPress={() => goToPage(currentPage - 1)} hitSlop={8} disabled={currentPage <= 1}>
              <Text style={[styles.pageNavBtn, currentPage <= 1 && styles.disabled]}>‹ Prev page</Text>
            </Pressable>
            <Pressable
              onPress={() => goToPage(currentPage + 1)}
              hitSlop={8}
              disabled={currentPage >= totalPages}
            >
              <Text style={[styles.pageNavBtn, currentPage >= totalPages && styles.disabled]}>
                Next page ›
              </Text>
            </Pressable>
          </View>
          {doc.needsPaidOcr && !canUseOcr ? (
            <View style={styles.lockBanner}>
              <Text style={styles.lockBannerText}>
                Scanned-PDF OCR is locked on Free. Upgrade to Reader Plus or AI Pro.
              </Text>
            </View>
          ) : null}
          {loadingPageMsg ? (
            <View style={styles.loadingBanner}>
              <ActivityIndicator color={theme.colors.accent} size="small" />
              <Text style={styles.loadingBannerText}>{loadingPageMsg}</Text>
            </View>
          ) : ocrNote ? (
            <View style={styles.noteBanner}>
              <Text style={styles.noteBannerText}>{ocrNote}</Text>
            </View>
          ) : null}
        </>
      )}

      {/* reading surface — virtualized for smooth, uninterrupted scrolling */}
      <FlatList
        ref={listRef}
        data={flat}
        keyExtractor={(s) => String(s.id)}
        extraData={currentId}
        renderItem={({ item, index }: ListRenderItemInfo<Sentence>) => (
          <SentenceRow
            sentence={item}
            active={item.id === currentId}
            fontSize={settings.fontSize}
            lineHeight={lineHeight}
            onTapWord={tapHandler}
            showPageDivider={index === 0 || flat[index - 1].page !== item.page}
          />
        )}
        style={styles.reader}
        contentContainerStyle={styles.readerContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={onScrollToIndexFailed}
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
              "AI is paid",
              "Summaries, explanations, and Q&A are available on AI Pro and higher."
            )
          }
        >
          <Text style={[styles.aiFabText, styles.aiFabTextLocked]}>AI Pro</Text>
        </Pressable>
      )}

      {/* controls */}
      <Controls
        settings={settings}
        onChange={setSettings}
        isPlaying={isPlaying}
        onPlayPause={onPlayPause}
        onStop={stop}
        voiceMode={voiceMode}
        onToggleVoice={toggleVoice}
        canUseCloudVoice={canUseCloudVoice}
        onCloudVoiceLocked={() =>
          openFeatureLock(
            "Cloud voice is paid",
            "Natural cloud voice requires a paid plan. Free users can continue with device voice."
          )
        }
        expanded={controlsOpen}
        onToggleExpand={() => setControlsOpen((v) => !v)}
        bottomInset={insets.bottom}
      />

      {/* AI panel */}
      {showAI && (
        <AIPanel
          contextText={flat
            .filter((s) => Math.abs(s.page - currentPage) <= 2)
            .map((s) => s.text)
            .join(" ")}
          language={langCode}
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

      {/* paywall */}
      {showPaywall && (
        <View style={styles.paywall}>
          <View style={styles.paywallCard}>
            <Text style={styles.paywallTitle}>{paywallTitle}</Text>
            <Text style={styles.paywallBody}>{paywallBody}</Text>
            <Pressable
              style={styles.paywallBtn}
              onPress={() => setShowPaywall(false)}
            >
              <Text style={styles.paywallBtnText}>OK</Text>
            </Pressable>
            <Pressable onPress={() => setShowPaywall(false)}>
              <Text style={styles.paywallDismiss}>Not now</Text>
            </Pressable>
          </View>
        </View>
      )}
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
  fontSize: number;
  lineHeight: number;
  onTapWord: (globalId: number, charOffset: number) => void;
  showPageDivider?: boolean;
}
const SentenceRow = React.memo(function SentenceRow({
  sentence,
  active,
  fontSize,
  lineHeight,
  onTapWord,
  showPageDivider,
}: SentenceRowProps) {
  const tokens = useMemo(() => TextReflow.tokenizeWords(sentence.text), [sentence.text]);
  return (
    <View>
      {showPageDivider ? (
        <View style={styles.pageDivider}>
          <View style={styles.pageDividerLine} />
          <Text style={styles.pageDividerLabel}>Page {sentence.page}</Text>
          <View style={styles.pageDividerLine} />
        </View>
      ) : null}
      <Text style={[styles.row, { fontSize, lineHeight }, active && styles.activeSentence]}>
        {tokens.map((t, wi) => (
          <Text key={wi} onPress={() => onTapWord(sentence.id, t.offset)}>
            {t.word}
            {wi < tokens.length - 1 ? " " : ""}
          </Text>
        ))}
      </Text>
    </View>
  );
});

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
  headerBtn: { color: theme.colors.text, fontSize: 26, paddingHorizontal: 4 },
  headerIcon: { fontSize: 20, paddingHorizontal: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
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
  },
  lockBanner: {
    marginHorizontal: theme.spacing(3),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
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
    borderRadius: theme.radius,
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
    borderRadius: theme.radius,
    paddingHorizontal: theme.spacing(1.2),
    paddingVertical: theme.spacing(0.9),
  },
  noteBannerText: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontFamily: theme.fonts.sans,
  },
  pageNavBtn: { color: theme.colors.accent, fontSize: 14, fontFamily: theme.fonts.sansSemiBold },
  reader: { flex: 1 },
  readerContent: { padding: theme.spacing(3), paddingBottom: theme.spacing(14) },
  row: { color: theme.colors.body, fontFamily: theme.fonts.serif, paddingVertical: 3 },
  pageDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: theme.spacing(2),
  },
  pageDividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  pageDividerLabel: {
    color: theme.colors.textDim,
    fontSize: 12,
    fontFamily: theme.fonts.mono,
    letterSpacing: 0.5,
  },
  activeSentence: {
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
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.3,
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
    borderRadius: theme.radius,
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
    borderRadius: 20,
    padding: 24,
    gap: 14,
    width: "100%",
    maxWidth: 380,
  },
  paywallTitle: { color: theme.colors.text, fontSize: 20, fontFamily: theme.fonts.serifSemiBold },
  paywallBody: { color: theme.colors.textMute, fontSize: 15, lineHeight: 21, fontFamily: theme.fonts.sans },
  paywallBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: 14,
    alignItems: "center",
  },
  paywallBtnText: { color: theme.colors.onAccent, fontFamily: theme.fonts.sansSemiBold, fontSize: 16 },
  paywallDismiss: { color: theme.colors.textDim, textAlign: "center", paddingVertical: 6 },
});
