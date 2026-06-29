import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  Modal,
} from "react-native";
import Constants from "expo-constants";
import * as Speech from "expo-speech";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { PDFParser, ParsedPdf, isNetworkError } from "../services/PDFParser";
import { Library, LibraryItem } from "../services/Library";
import { DocCache } from "../services/DocCache";
import { Bookmarks } from "../services/Bookmarks";
import { EntitlementSnapshot, UsageSnapshot } from "../services/Entitlements";
import { ThemedNotice, ThemedNoticeAction } from "../components/ThemedNotice";
import {
  downloadLocalNeuralVoice,
  formatLocalModelSize,
  getLocalNeuralVoiceStatus,
  loadLocalNeuralVoiceStatus,
  LocalNeuralDownloadProgress,
  LocalNeuralVoiceStatus,
} from "../services/LocalNeuralVoice";
import { ReadingPreferences, VoiceEngine } from "../services/Preferences";
import {
  getReadingLanguage,
  languageMatchesVoice,
  READING_LANGUAGES,
  ReadingLanguage,
  voiceRegionKey,
  voiceRegionLabel,
} from "../services/ReadingLanguages";
import { theme } from "../theme";

interface Props {
  /** Open a freshly parsed document in the reader. */
  onOpen: (doc: ParsedPdf, item: LibraryItem) => void;
  entitlement: EntitlementSnapshot;
  usage: UsageSnapshot | null;
  preferences: ReadingPreferences;
  onPreferencesChange: (next: ReadingPreferences) => void;
  onRefreshUsage?: () => void;
}

interface NoticeState {
  title: string;
  body: string;
  primary?: ThemedNoticeAction;
  secondary?: ThemedNoticeAction;
}

/** Deterministic cover variant from the document id. */
function coverVariant(id: string): 0 | 1 | 2 | 3 {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 4) as 0 | 1 | 2 | 3;
}

export function LibraryScreen({
  onOpen,
  entitlement,
  usage,
  preferences,
  onPreferencesChange,
  onRefreshUsage,
}: Props) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [deviceVoices, setDeviceVoices] = useState<DeviceVoiceOption[]>([]);
  const [localStatus, setLocalStatus] = useState<LocalNeuralVoiceStatus>(
    getLocalNeuralVoiceStatus()
  );
  const [localDownloading, setLocalDownloading] = useState(false);
  const [localDownloadProgress, setLocalDownloadProgress] =
    useState<LocalNeuralDownloadProgress | null>(null);
  const readingLanguage = getReadingLanguage(preferences.bookLanguage);

  const refresh = useCallback(async () => {
    setItems(await Library.list());
  }, []);

  const refreshLocalVoiceStatus = useCallback(async () => {
    const status = await loadLocalNeuralVoiceStatus();
    setLocalStatus(status);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    loadLocalNeuralVoiceStatus()
      .then((status) => {
        if (alive) setLocalStatus(status);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (showVoice) refreshLocalVoiceStatus().catch(() => {});
  }, [refreshLocalVoiceStatus, showVoice]);

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        setDeviceVoices(formatDeviceVoices(voices, readingLanguage));
      })
      .catch(() => setDeviceVoices([]));
  }, [readingLanguage.code]);

  useEffect(() => {
    onRefreshUsage?.();
  }, [onRefreshUsage]);

  async function importNew() {
    setError(null);
    setLoading(true);
    try {
      const doc = await PDFParser.pickAndParse({ ocrLang: readingLanguage.ocrLang });
      if (!doc) return; // cancelled
      const item = await Library.saveOpened(doc, doc.sourceUri, doc.mimeType);
      // Save the parsed text so this book can be reopened offline later.
      await DocCache.save(doc);
      await refresh();
      onOpen(doc, item);
    } catch (e: any) {
      setError(
        isNetworkError(e)
          ? "You're offline. Connect to the internet to add a new book — once added it works offline."
          : e?.message || "Could not read that PDF."
      );
    } finally {
      setLoading(false);
    }
  }

  async function openItem(item: LibraryItem) {
    if (!item.storedUri) {
      setError("This document's file is no longer available. Please add it again.");
      return;
    }
    setError(null);
    setBusyId(item.id);
    try {
      const cached = await DocCache.load(item.id);
      let doc: ParsedPdf;

      if (cached && DocCache.isComplete(cached)) {
        // Fully saved for offline — open instantly, no network needed.
        doc = DocCache.toParsed(cached);
      } else {
        // Not fully cached yet (new, or scanned with pages still to OCR).
        try {
          const fresh = await PDFParser.parseUri({
            uri: item.storedUri,
            fileName: item.fileName,
            mimeType: item.mimeType || undefined,
            ocrLang: readingLanguage.ocrLang,
          });
          doc = cached ? DocCache.mergeCachedOcr(fresh, cached) : fresh;
          await DocCache.save(doc);
        } catch (netErr) {
          if (cached && isNetworkError(netErr)) {
            // Offline: open whatever text we already saved.
            doc = DocCache.toParsed(cached);
            setError(
              "You're offline — opened the saved copy. Any scanned pages will finish loading when you reconnect."
            );
          } else if (isNetworkError(netErr)) {
            setError(
              "You're offline and this book isn't saved for offline reading yet. Open it once with internet, then it'll work in airplane mode."
            );
            return;
          } else {
            throw netErr;
          }
        }
      }

      doc.sourceUri = item.storedUri;
      doc.mimeType = item.mimeType || undefined;
      await Library.saveOpened(doc, item.storedUri, item.mimeType || undefined);
      await refresh();
      onOpen(doc, item);
    } catch (e: any) {
      setError(e?.message || "Could not reopen that document.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(item: LibraryItem) {
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    setBusyId(item.id);
    try {
      await Library.remove(item.id);
      await DocCache.remove(item.id);
      await Bookmarks.removeAll(item.id);
    } catch (e: any) {
      setNotice({
        title: "Remove document",
        body: e?.message || "Could not remove that document.",
      });
    } finally {
      await refresh();
      setBusyId(null);
    }
  }

  function confirmRemove(item: LibraryItem) {
    setNotice({
      title: "Remove from library?",
      body: `"${item.title}" will be removed from this device.`,
      secondary: { label: "Cancel", tone: "secondary" },
      primary: {
        label: "Remove",
        tone: "danger",
        onPress: () => removeItem(item).catch(() => {}),
      },
    });
  }

  async function installLocalVoice() {
    if (localDownloading) return;
    setLocalDownloading(true);
    setLocalDownloadProgress(null);
    try {
      const status = await downloadLocalNeuralVoice((progress) => {
        setLocalDownloadProgress(progress);
      });
      setLocalStatus(status);
      onPreferencesChange({ ...preferences, voiceEngine: "local_ai" });
    } catch (e: any) {
      setNotice({
        title: "Edge AI voice",
        body:
          e?.message ||
          "Could not download Edge AI. Check your connection and try again.",
      });
      refreshLocalVoiceStatus().catch(() => {});
    } finally {
      setLocalDownloading(false);
      setLocalDownloadProgress(null);
    }
  }

  const recent = items[0];
  const rest = items.slice(1);
  const isPaid = Boolean(
    entitlement.features.ai || entitlement.features.ocr || entitlement.features.unlimitedLibrary
  );
  const planLabel = isPaid ? entitlement.name : "Free";
  const cloudVoiceRemaining =
    usage?.remaining.cloudVoiceChars ?? entitlement.limits.cloudVoiceCharsPerMonth ?? 0;
  const cloudVoiceLimit = entitlement.limits.cloudVoiceCharsPerMonth ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, Constants.statusBarHeight) + theme.spacing(1) },
        ]}
      >
        <View style={styles.brandBlock}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <View style={styles.brandSpine} />
              <Text style={styles.brandText}>rF</Text>
            </View>
            <Text style={styles.kicker}>READFLOW</Text>
          </View>
          <Text style={styles.title}>Your shelf</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={[styles.planPill, isPaid && styles.planPillPaid]}>
            <Text style={[styles.planPillText, isPaid && styles.planPillTextPaid]}>
              {planLabel}
            </Text>
          </View>
          <Pressable
            style={styles.headerMiniBtn}
            onPress={() => setShowLanguage(true)}
            hitSlop={8}
          >
            <Text style={styles.headerMiniText}>{readingLanguage.shortLabel}</Text>
          </Pressable>
          <Pressable style={styles.headerMiniBtn} onPress={() => setShowVoice(true)} hitSlop={8}>
            <Text style={styles.headerMiniText}>Voice</Text>
          </Pressable>
          <Pressable style={styles.headerIconMiniBtn} onPress={() => setShowHelp(true)} hitSlop={8}>
            <Text style={styles.headerIconMiniText}>?</Text>
          </Pressable>
          <Pressable style={styles.addBtn} onPress={importNew} disabled={loading} hitSlop={8}>
            {loading ? (
              <ActivityIndicator color={theme.colors.onAccent} />
            ) : (
              <Text style={styles.addBtnText}>+</Text>
            )}
          </Pressable>
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.statusStrip}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>
          {preferences.voiceEngine === "cloud"
            ? cloudVoiceLimit > 0
              ? `Cloud AI selected - ${formatChars(cloudVoiceRemaining)} left this month.`
              : "Cloud AI selected - upgrade or use device voice before reading."
            : preferences.voiceEngine === "local_ai"
              ? localStatus.engineInstalled
                ? "Edge AI selected - ready on this phone with no cloud voice cost."
                : localStatus.nativeAvailable
                  ? "Edge AI selected - download the voice model before reading."
                  : "Edge AI selected - install the new native build first."
              : "Device voice selected - unlimited reading with no ReadFlow voice cost."}
        </Text>
      </View>

      <VoiceOverview
        preferences={preferences}
        cloudVoiceRemaining={cloudVoiceRemaining}
        cloudVoiceLimit={cloudVoiceLimit}
        localStatus={localStatus}
        onPress={() => setShowVoice(true)}
      />

      {items.length === 0 ? (
        <Empty onAdd={importNew} loading={loading} isPaid={isPaid} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {recent && (
            <ContinueCard
              item={recent}
              busy={busyId === recent.id}
              onPress={() => openItem(recent)}
              onRemove={() => confirmRemove(recent)}
            />
          )}

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>All documents</Text>
            <Text style={styles.count}>{items.length}</Text>
          </View>

          <View style={styles.grid}>
            {rest.map((item) => (
              <DocCard
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onPress={() => openItem(item)}
                onRemove={() => confirmRemove(item)}
              />
            ))}
            {rest.length === 0 && (
              <Text style={styles.hint}>Your next document will appear here.</Text>
            )}
          </View>
        </ScrollView>
      )}

      <VoiceSettingsSheet
        visible={showVoice}
        entitlement={entitlement}
        usage={usage}
        preferences={preferences}
        readingLanguage={readingLanguage}
        deviceVoices={deviceVoices}
        localStatus={localStatus}
        localDownloading={localDownloading}
        localDownloadProgress={localDownloadProgress}
        onClose={() => setShowVoice(false)}
        onChange={onPreferencesChange}
        onDownloadLocalVoice={installLocalVoice}
        onNotice={setNotice}
      />
      <LanguageSettingsSheet
        visible={showLanguage}
        preferences={preferences}
        onClose={() => setShowLanguage(false)}
        onChange={onPreferencesChange}
      />
      <HelpAboutSheet visible={showHelp} onClose={() => setShowHelp(false)} />
      <ThemedNotice
        visible={Boolean(notice)}
        title={notice?.title || ""}
        body={notice?.body || ""}
        primary={notice?.primary}
        secondary={notice?.secondary}
        onClose={() => setNotice(null)}
      />
    </SafeAreaView>
  );
}

/* ---------- pieces ---------- */

const CLOUD_VOICES = [
  "nova",
  "alloy",
  "ash",
  "coral",
  "echo",
  "fable",
  "onyx",
  "sage",
  "shimmer",
  "ballad",
];

function formatChars(n: number): string {
  if (n <= 0) return "0 chars";
  if (n >= 1000) return `${Math.round(n / 1000)}k chars`;
  return `${n} chars`;
}

function estimatePages(chars: number): number {
  return Math.max(0, Math.floor(chars / 1650));
}

interface DeviceVoiceOption {
  id: string;
  name: string;
  language: string;
  regionKey: string;
  regionLabel: string;
  displayName: string;
  detail: string;
  rank: number;
}

function formatDeviceVoices(
  voices: Speech.Voice[],
  readingLanguage: ReadingLanguage
): DeviceVoiceOption[] {
  const seen = new Set<string>();
  return voices
    .filter((voice) => languageMatchesVoice(voice.language, readingLanguage))
    .map((voice, index) => toDeviceVoiceOption(voice, index, readingLanguage))
    .sort((a, b) => a.rank - b.rank || a.displayName.localeCompare(b.displayName))
    .filter((voice) => {
      const key = `${voice.regionKey}:${voice.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function toDeviceVoiceOption(
  voice: Speech.Voice,
  index: number,
  readingLanguage: ReadingLanguage
): DeviceVoiceOption {
  const language = normalizeVoiceLanguage(voice.language || readingLanguage.voiceLanguage);
  const rawName = String(voice.name || voice.identifier || "");
  const lower = `${rawName} ${voice.identifier || ""}`.toLowerCase();
  const regionKey = voiceRegionKey(language);
  const regionLabel = voiceRegionLabel(language, readingLanguage);
  const quality = lower.includes("network")
    ? "Network voice"
    : lower.includes("local") || lower.includes("offline") || lower.includes("google")
      ? "Offline voice"
      : "Phone voice";
  const number = index + 1;
  return {
    id: voice.identifier,
    name: rawName || `${readingLanguage.label} voice ${number}`,
    language,
    regionKey,
    regionLabel,
    displayName: regionLabel,
    detail: quality === "Network voice" ? "Needs Android voice data" : "Available on this phone",
    rank:
      regionRank(regionKey, readingLanguage) * 10 +
      (quality === "Offline voice" ? 0 : quality === "Phone voice" ? 1 : 2),
  };
}

function normalizeVoiceLanguage(language: string): string {
  return language.replace("_", "-") || "en-US";
}

function regionRank(regionKey: string, readingLanguage: ReadingLanguage): number {
  const preferred = voiceRegionKey(readingLanguage.voiceLanguage);
  const ranks: Record<string, number> = {
    [preferred]: 0,
    US: 1,
    GB: 2,
    UK: 2,
    ES: 3,
    MX: 4,
    FR: 5,
    CA: 6,
    DE: 7,
    BR: 8,
    PT: 9,
  };
  return ranks[regionKey] ?? 9;
}

function VoiceOverview({
  preferences,
  cloudVoiceRemaining,
  cloudVoiceLimit,
  localStatus,
  onPress,
}: {
  preferences: ReadingPreferences;
  cloudVoiceRemaining: number;
  cloudVoiceLimit: number;
  localStatus: LocalNeuralVoiceStatus;
  onPress: () => void;
}) {
  const isCloud = preferences.voiceEngine === "cloud";
  const isLocal = preferences.voiceEngine === "local_ai";
  return (
    <Pressable style={styles.voiceOverview} onPress={onPress}>
      <View style={styles.voiceOverviewTop}>
        <Text style={styles.voiceOverviewTitle}>Reading voice</Text>
        <Text style={styles.voiceOverviewAction}>Change</Text>
      </View>
      <Text style={styles.voiceOverviewBody}>
        {isCloud
          ? cloudVoiceLimit > 0
            ? `Cloud AI: ${formatChars(cloudVoiceRemaining)} left, about ${estimatePages(cloudVoiceRemaining)} pages.`
            : "Cloud AI needs AI Pro or Power. Device voice remains unlimited."
          : isLocal
            ? localStatus.engineInstalled
              ? "Edge AI: ready on this phone. It uses battery and CPU, with no cloud cost."
              : `${localStatus.title}. ${localStatus.detail}`
            : "Phone voice: unlimited, offline after import, and no ReadFlow AI voice cost."}
      </Text>
    </Pressable>
  );
}

function LanguageSettingsSheet({
  visible,
  preferences,
  onClose,
  onChange,
}: {
  visible: boolean;
  preferences: ReadingPreferences;
  onClose: () => void;
  onChange: (next: ReadingPreferences) => void;
}) {
  const current = getReadingLanguage(preferences.bookLanguage);

  function selectLanguage(language: ReadingLanguage) {
    onChange({
      ...preferences,
      bookLanguage: language.code,
      deviceVoiceId: undefined,
      voiceEngine:
        preferences.voiceEngine === "local_ai" && !language.edgeAi
          ? "device"
          : preferences.voiceEngine,
    });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book language</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.modalClose}>x</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.voiceGuide}>
              <Text style={styles.voiceGuideTitle}>Improve scanned text and reading voice</Text>
              <Text style={styles.voiceGuideText}>
                ReadFlow uses this for OCR, phone voices, Cloud AI, and AI answers.
                Edge AI is English-only until more language packs are added.
              </Text>
            </View>

            <View style={styles.languageGrid}>
              {READING_LANGUAGES.map((language) => {
                const active = language.code === current.code;
                return (
                  <Pressable
                    key={language.code}
                    style={[styles.languageChoice, active && styles.languageChoiceOn]}
                    onPress={() => selectLanguage(language)}
                  >
                    <Text style={[styles.languageChoiceTitle, active && styles.languageChoiceTitleOn]}>
                      {language.label}
                    </Text>
                    <Text style={[styles.languageChoiceMeta, active && styles.languageChoiceMetaOn]}>
                      OCR {language.ocrLang}
                      {language.edgeAi ? " · Edge AI" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function VoiceSettingsSheet({
  visible,
  entitlement,
  usage,
  preferences,
  readingLanguage,
  deviceVoices,
  localStatus,
  localDownloading,
  localDownloadProgress,
  onClose,
  onChange,
  onDownloadLocalVoice,
  onNotice,
}: {
  visible: boolean;
  entitlement: EntitlementSnapshot;
  usage: UsageSnapshot | null;
  preferences: ReadingPreferences;
  readingLanguage: ReadingLanguage;
  deviceVoices: DeviceVoiceOption[];
  localStatus: LocalNeuralVoiceStatus;
  localDownloading: boolean;
  localDownloadProgress: LocalNeuralDownloadProgress | null;
  onClose: () => void;
  onChange: (next: ReadingPreferences) => void;
  onDownloadLocalVoice: () => void;
  onNotice: (notice: NoticeState) => void;
}) {
  const cloudLimit = entitlement.limits.cloudVoiceCharsPerMonth || 0;
  const cloudRemaining = usage?.remaining.cloudVoiceChars ?? cloudLimit;
  const canUseCloud = Boolean(entitlement.features.cloudVoice && cloudLimit > 0);
  const currentDeviceVoice = deviceVoices.find((v) => v.id === preferences.deviceVoiceId);
  const [voiceRegion, setVoiceRegion] = useState("recommended");
  const regionOptions = useMemo(() => {
    const unique = Array.from(
      new Map(deviceVoices.map((voice) => [voice.regionKey, voice.regionLabel])).entries()
    );
    return [{ key: "recommended", label: "Recommended" }].concat(
      unique.map(([key, label]) => ({ key, label }))
    );
  }, [deviceVoices]);
  const visibleDeviceVoices = useMemo(() => {
    if (voiceRegion === "recommended") return deviceVoices.slice(0, 6);
    return deviceVoices.filter((voice) => voice.regionKey === voiceRegion).slice(0, 8);
  }, [deviceVoices, voiceRegion]);

  function selectEngine(engine: VoiceEngine) {
    if (engine === "cloud" && !canUseCloud) {
      onNotice({
        title: "Cloud AI voice",
        body:
          "Cloud AI is active for AI Pro and Power when the backend grants a monthly voice allowance. Device voice stays unlimited.",
      });
      return;
    }
    if (engine === "local_ai" && !readingLanguage.edgeAi) {
      onNotice({
        title: "Edge AI language pack",
        body: `Edge AI is available for English right now. Use Device voice or Cloud AI for ${readingLanguage.label} until we add this language pack.`,
      });
      return;
    }
    if (engine === "local_ai" && !localStatus.engineInstalled) {
      if (localStatus.nativeAvailable && !localStatus.modelDownloaded) {
        onNotice({
          title: "Download Edge AI voice",
          body: localStatus.detail,
          secondary: { label: "Not now", tone: "secondary" },
          primary: { label: "Download", onPress: onDownloadLocalVoice },
        });
        return;
      }
      onNotice({
        title: "Edge AI voice",
        body: localStatus.detail,
      });
      return;
    }
    onChange({ ...preferences, voiceEngine: engine });
  }

  function buyMoreVoice() {
    onNotice({
      title: "AI voice packs",
      body:
        "The cost-safe product path is a Play Billing top-up, for example 100k AI voice characters. Purchases are not live in this build yet.",
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Voice</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.modalClose}>x</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.voiceGuide}>
              <Text style={styles.voiceGuideTitle}>Choose how books are read aloud</Text>
              <Text style={styles.voiceGuideText}>
                Book language is {readingLanguage.label}. Extra settings appear only for the
                voice you choose.
              </Text>
            </View>

            <View style={styles.voiceChoiceGroup}>
              <VoiceChoice
                title="Edge AI"
                detail={
                  localStatus.engineInstalled
                    ? readingLanguage.edgeAi
                      ? "Natural offline reading. No OpenAI cost. Uses this phone's battery."
                      : "English voice pack only for now. More Edge AI languages can be added later."
                    : localStatus.detail
                }
                active={preferences.voiceEngine === "local_ai"}
                locked={!localStatus.engineInstalled || !readingLanguage.edgeAi}
                stateLabel={
                  !readingLanguage.edgeAi
                    ? "English"
                    : localStatus.engineInstalled
                    ? undefined
                    : localStatus.nativeAvailable
                      ? "Download"
                      : "Build"
                }
                onPress={() => selectEngine("local_ai")}
              />
              <VoiceChoice
                title="Phone voice"
                detail={
                  currentDeviceVoice
                    ? `Uses ${currentDeviceVoice.displayName}. Smallest battery use.`
                    : `Uses the phone's built-in ${readingLanguage.label} voice when available.`
                }
                active={preferences.voiceEngine === "device"}
                onPress={() => selectEngine("device")}
              />
              <VoiceChoice
                title="Cloud AI"
                detail={
                  canUseCloud
                    ? `${formatChars(cloudRemaining)} left this month. Best cloud quality.`
                    : "Included in AI Pro and Power. Best quality, monthly allowance."
                }
                active={preferences.voiceEngine === "cloud"}
                locked={!canUseCloud}
                stateLabel={canUseCloud ? undefined : "AI Pro"}
                onPress={() => selectEngine("cloud")}
              />
            </View>

            {preferences.voiceEngine === "local_ai" ? (
              <View style={styles.voiceBlock}>
                <Text style={styles.voiceBlockTitle}>
                  {localStatus.engineInstalled ? "Edge AI is ready" : "Download Edge AI"}
                </Text>
                <Text style={styles.voiceBlockHint}>
                  {localStatus.engineInstalled
                    ? `${localStatus.modelName} reads on this phone with no OpenAI cost. It uses battery and about ${formatLocalModelSize(localStatus.modelSizeBytes)} of storage. Reading stops when you leave ReadFlow.`
                    : localStatus.nativeAvailable
                      ? `${localStatus.modelName} downloads once, about ${formatLocalModelSize(localStatus.modelSizeBytes)}.`
                      : localStatus.detail}
                </Text>
                {localDownloading ? (
                  <View style={styles.localProgressWrap}>
                    <View style={styles.localProgressTrack}>
                      <View
                        style={[
                          styles.localProgressFill,
                          {
                            width: `${Math.max(
                              3,
                              Math.min(100, localDownloadProgress?.percent ?? 3)
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.voiceBlockHint}>
                      {localDownloadProgress?.phase === "extracting"
                        ? "Installing voice..."
                        : `Downloading ${Math.round(localDownloadProgress?.percent ?? 0)}%`}
                    </Text>
                  </View>
                ) : localStatus.nativeAvailable && !localStatus.modelDownloaded ? (
                  <Pressable style={styles.voicePackBtn} onPress={onDownloadLocalVoice}>
                    <Text style={styles.voicePackText}>Download Edge AI</Text>
                  </Pressable>
                ) : localStatus.engineInstalled ? (
                  <Text style={styles.localReadyText}>Ready for Edge AI reading.</Text>
                ) : null}
              </View>
            ) : null}

            {preferences.voiceEngine === "device" ? (
              <View style={styles.voiceBlock}>
                <Text style={styles.voiceBlockTitle}>Phone voice accent</Text>
                <Text style={styles.voiceBlockHint}>
                  Optional. Choose a {readingLanguage.label} phone voice, or keep the phone default.
                </Text>
                <View style={styles.voiceRegionRow}>
                  {regionOptions.map((region) => {
                    const active = voiceRegion === region.key;
                    return (
                      <Pressable
                        key={region.key}
                        style={[styles.voiceRegionChip, active && styles.voiceRegionChipOn]}
                        onPress={() => setVoiceRegion(region.key)}
                      >
                        <Text
                          style={[
                            styles.voiceRegionChipText,
                            active && styles.voiceRegionChipTextOn,
                          ]}
                        >
                          {region.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.voiceList}>
                  <Pressable
                    style={[styles.voiceChip, !preferences.deviceVoiceId && styles.voiceChipOn]}
                    onPress={() =>
                      onChange({
                        ...preferences,
                        voiceEngine: "device",
                        deviceVoiceId: undefined,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.voiceChipText,
                        !preferences.deviceVoiceId && styles.voiceChipTextOn,
                      ]}
                    >
                      Phone default
                    </Text>
                    <Text
                      style={[
                        styles.voiceChipSub,
                        !preferences.deviceVoiceId && styles.voiceChipTextOn,
                      ]}
                    >
                      Uses Android setting
                    </Text>
                  </Pressable>
                  {deviceVoices.length === 0 ? (
                    <Text style={styles.voiceEmpty}>
                      No optional {readingLanguage.label} voices were reported.
                    </Text>
                  ) : (
                    visibleDeviceVoices.map((voice) => {
                      const active = preferences.deviceVoiceId === voice.id;
                      return (
                        <Pressable
                          key={voice.id}
                          style={[styles.voiceChip, active && styles.voiceChipOn]}
                          onPress={() =>
                            onChange({
                              ...preferences,
                              voiceEngine: "device",
                              deviceVoiceId: voice.id,
                            })
                          }
                        >
                          <Text style={[styles.voiceChipText, active && styles.voiceChipTextOn]}>
                            {voice.displayName}
                          </Text>
                          <Text style={[styles.voiceChipSub, active && styles.voiceChipTextOn]}>
                            {voice.detail}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            ) : null}

            {preferences.voiceEngine === "cloud" ? (
              <>
                <View style={styles.voiceBlock}>
                  <Text style={styles.voiceBlockTitle}>Cloud AI style</Text>
                  <Text style={styles.voiceBlockHint}>
                    Cloud AI uses your monthly allowance.
                  </Text>
                  <View style={styles.voiceList}>
                    {CLOUD_VOICES.map((voice) => {
                      const active = preferences.cloudVoiceId === voice;
                      return (
                        <Pressable
                          key={voice}
                          style={[styles.cloudChip, active && styles.cloudChipOn]}
                          onPress={() =>
                            onChange({
                              ...preferences,
                              voiceEngine: canUseCloud ? "cloud" : preferences.voiceEngine,
                              cloudVoiceId: voice,
                            })
                          }
                        >
                          <Text style={[styles.cloudChipText, active && styles.cloudChipTextOn]}>
                            {voice.charAt(0).toUpperCase() + voice.slice(1)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.voiceBlock}>
                  <Text style={styles.voiceBlockTitle}>Need more Cloud AI?</Text>
                  <Text style={styles.voiceBlockHint}>
                    When the monthly allowance is used, ReadFlow should offer a paid top-up.
                  </Text>
                  <Pressable style={styles.voicePackBtn} onPress={buyMoreVoice}>
                    <Text style={styles.voicePackText}>AI voice packs</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function VoiceChoice({
  title,
  detail,
  active,
  locked,
  stateLabel,
  onPress,
}: {
  title: string;
  detail: string;
  active: boolean;
  locked?: boolean;
  stateLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.voiceChoice, active && styles.voiceChoiceOn]} onPress={onPress}>
      <View style={styles.voiceChoiceTop}>
        <Text style={[styles.voiceChoiceTitle, active && styles.voiceChoiceTitleOn]}>
          {title}
        </Text>
        <Text style={[styles.voiceChoiceState, active && styles.voiceChoiceStateOn]}>
          {stateLabel || (locked ? "Locked" : active ? "On" : "Use")}
        </Text>
      </View>
      <Text style={[styles.voiceChoiceDetail, active && styles.voiceChoiceDetailOn]}>
        {detail}
      </Text>
    </Pressable>
  );
}

function HelpAboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const expo = Constants.expoConfig as any;
  const version = expo?.version || "dev";
  const code = expo?.android?.versionCode || expo?.ios?.buildNumber || "";
  const supportEmail = expo?.extra?.supportEmail || "support@urmiaworks.com";
  const website = expo?.extra?.website || "https://urmiaworks.com";

  function contact() {
    Linking.openURL(`mailto:${supportEmail}?subject=ReadFlow support`).catch(() => {});
  }

  function openWebsite() {
    Linking.openURL(website).catch(() => {});
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>About</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.modalClose}>x</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.aboutVersion}>
              ReadFlow {version}
              {code ? ` (${code})` : ""}
            </Text>
            <Text style={styles.aboutBody}>
              ReadFlow turns PDF and Word documents into phone-sized reading text, then reads with device voice, capped Cloud AI, or downloaded Edge AI.
            </Text>
            <View style={styles.helpRows}>
              <HelpRow label="+" text="Add a PDF or Word document." />
              <HelpRow label="Lang" text="Sets OCR, phone voices, Cloud AI, and AI answer language." />
              <HelpRow label="Voice" text="Choose unlimited device voice, capped Cloud AI, or downloaded Edge AI." />
              <HelpRow label="Plan" text="Shows the active subscription tier and monthly limits." />
              <HelpRow label="Follow" text="Keeps the highlighted line centered while reading aloud." />
              <HelpRow label="Focus" text="Hides controls for a cleaner reading view." />
              <HelpRow label="BM" text="Opens bookmarks and page navigation." />
              <HelpRow label="AI" text="Summaries, explanations, and questions for AI Pro and Power." />
            </View>
            <View style={styles.aboutActions}>
              <Pressable style={styles.aboutBtn} onPress={contact}>
                <Text style={styles.aboutBtnText}>Contact support</Text>
              </Pressable>
              <Pressable style={styles.aboutBtnGhost} onPress={openWebsite}>
                <Text style={styles.aboutBtnGhostText}>Website</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function HelpRow({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.helpRow}>
      <Text style={styles.helpLabel}>{label}</Text>
      <Text style={styles.helpText}>{text}</Text>
    </View>
  );
}

function Empty({
  onAdd,
  loading,
  isPaid,
}: {
  onAdd: () => void;
  loading: boolean;
  isPaid: boolean;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyCover}>
        <View style={styles.spine} />
        <View style={[styles.coverLine, { width: "100%" }]} />
        <View style={[styles.coverLine, { width: "62%" }]} />
        <View style={[styles.coverLine, { width: "88%" }]} />
      </View>
      <Text style={styles.emptyTitle}>Your shelf is empty</Text>
      <Text style={styles.emptyBody}>
        {isPaid
          ? "Add a PDF or Word file and ReadFlow will turn it into a clean phone-first reading view."
          : "Add a PDF or Word file. Free mode keeps local reading and device voice open; AI, OCR, and cloud voice stay behind paid plans."}
      </Text>
      <Pressable style={styles.cta} onPress={onAdd} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={theme.colors.onAccent} />
        ) : (
          <Text style={styles.ctaText}>Add document</Text>
        )}
      </Pressable>
    </View>
  );
}

function ContinueCard({
  item,
  busy,
  onPress,
  onRemove,
}: {
  item: LibraryItem;
  busy: boolean;
  onPress: () => void;
  onRemove: () => void;
}) {
  const pct = Math.round((item.progress || 0) * 100);
  return (
    <Pressable style={styles.continueCard} onPress={onPress} disabled={busy}>
      <MiniCover item={item} large />
      <View style={styles.continueBody}>
        <Text style={styles.continueKicker}>{pct > 0 ? "CONTINUE" : "START READING"}</Text>
        <Text style={styles.continueTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.continueMeta}>
          {item.pageCount} pages{pct > 0 ? ` · ${pct}% read` : ""}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(4, pct)}%` }]} />
        </View>
      </View>
      <Pressable
        style={styles.cardRemoveBtn}
        onPress={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        hitSlop={8}
      >
        <Text style={styles.cardRemoveText}>Remove</Text>
      </Pressable>
      {busy && <ActivityIndicator style={styles.cardSpinner} color={theme.colors.accent} />}
    </Pressable>
  );
}

function DocCard({
  item,
  busy,
  onPress,
  onRemove,
}: {
  item: LibraryItem;
  busy: boolean;
  onPress: () => void;
  onRemove: () => void;
}) {
  return (
    <Pressable
      style={styles.docCard}
      onPress={onPress}
      onLongPress={onRemove}
      delayLongPress={350}
      disabled={busy}
    >
      <Cover item={item} />
      <Text style={styles.docTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Pressable
        style={styles.docRemoveBtn}
        onPress={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        hitSlop={8}
      >
        <Text style={styles.docRemoveText}>Remove</Text>
      </Pressable>
      {busy && <ActivityIndicator style={styles.cardSpinner} color={theme.colors.accent} />}
    </Pressable>
  );
}

/** Full 3:4 book cover for the grid. */
function Cover({ item }: { item: LibraryItem }) {
  const v = coverVariant(item.id);
  const palettes = [
    { bg: theme.colors.card, line: "#DCD5C7", strong: "#BEB39E", border: theme.colors.borderStrong },
    { bg: theme.colors.accent, line: "rgba(255,255,255,0.4)", strong: "rgba(255,255,255,0.85)", border: "transparent" },
    { bg: theme.colors.ink, line: "#5A5446", strong: "#EBDFC6", border: "transparent" },
    { bg: theme.colors.teal, line: "rgba(255,255,255,0.35)", strong: "#DDEDE8", border: "transparent" },
  ] as const;
  const p = palettes[v];
  return (
    <View style={[styles.cover, { backgroundColor: p.bg, borderColor: p.border }]}>
      <View style={[styles.coverHead, { backgroundColor: p.strong, width: "74%" }]} />
      <View style={[styles.coverRow, { backgroundColor: p.line, width: "100%" }]} />
      <View style={[styles.coverRow, { backgroundColor: p.line, width: "90%" }]} />
      <View style={[styles.coverRow, { backgroundColor: p.line, width: "96%" }]} />
      <View style={[styles.coverRow, { backgroundColor: p.line, width: "70%" }]} />
    </View>
  );
}

/** Small spine-style cover for the Continue card. */
function MiniCover({ item, large }: { item: LibraryItem; large?: boolean }) {
  return (
    <View style={[styles.miniCover, large && styles.miniCoverLarge]}>
      <View style={styles.miniSpine} />
      <View style={[styles.miniLine, { width: "100%" }]} />
      <View style={[styles.miniLine, { width: "58%", backgroundColor: theme.colors.accent }]} />
      <View style={[styles.miniLine, { width: "86%" }]} />
      <View style={[styles.miniLine, { width: "44%", backgroundColor: "#86806F" }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing(3),
    paddingBottom: theme.spacing(2),
  },
  brandBlock: { flex: 1, minWidth: 0 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: theme.colors.ink,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brandSpine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: theme.colors.accent,
  },
  brandText: {
    color: theme.colors.onAccent,
    fontFamily: theme.fonts.serifSemiBold,
    fontSize: 15,
    marginLeft: 4,
  },
  kicker: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: theme.colors.textDim,
  },
  title: {
    fontFamily: theme.fonts.serifMedium,
    fontSize: 32,
    color: theme.colors.text,
    marginTop: 2,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  planPill: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  planPillPaid: {
    backgroundColor: theme.colors.tealSoft,
    borderColor: theme.colors.teal,
  },
  planPillText: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 12,
  },
  planPillTextPaid: { color: theme.colors.teal },
  headerMiniBtn: {
    height: 34,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMiniText: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 12,
  },
  headerIconMiniBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconMiniText: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sansBold,
    fontSize: 15,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  addBtnText: { color: theme.colors.onAccent, fontSize: 26, lineHeight: 28, marginTop: -2 },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.sansMedium,
    paddingHorizontal: theme.spacing(3),
    paddingBottom: theme.spacing(1),
  },
  statusStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: theme.spacing(3),
    marginBottom: theme.spacing(1.5),
    paddingHorizontal: theme.spacing(1.25),
    paddingVertical: theme.spacing(0.9),
    borderRadius: 8,
    backgroundColor: theme.colors.tealSoft,
    borderWidth: 1,
    borderColor: "#C7DED8",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.teal,
  },
  statusText: {
    flex: 1,
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  voiceOverview: {
    marginHorizontal: theme.spacing(3),
    marginBottom: theme.spacing(2),
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1.25),
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  voiceOverviewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  voiceOverviewTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 14,
  },
  voiceOverviewAction: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 12,
  },
  voiceOverviewBody: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sans,
    fontSize: 12.5,
    lineHeight: 17,
  },
  scroll: { paddingHorizontal: theme.spacing(3), paddingBottom: theme.spacing(6) },

  /* continue card */
  continueCard: {
    flexDirection: "row",
    gap: 15,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: theme.spacing(3),
    shadowColor: "#281E0F",
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  continueBody: { flex: 1, justifyContent: "center" },
  continueKicker: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: theme.colors.accent,
  },
  continueTitle: {
    fontFamily: theme.fonts.serifMedium,
    fontSize: 19,
    color: theme.colors.text,
    marginTop: 5,
    lineHeight: 23,
  },
  continueMeta: { fontFamily: theme.fonts.sans, fontSize: 12, color: theme.colors.textDim, marginTop: 3 },
  progressTrack: {
    height: 5,
    backgroundColor: "#EBDFC6",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 11,
  },
  progressFill: { height: "100%", backgroundColor: theme.colors.accent, borderRadius: 3 },
  cardRemoveBtn: {
    position: "absolute",
    right: 12,
    top: 12,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardRemoveText: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 11,
  },

  /* section */
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1.5),
  },
  sectionTitle: { fontFamily: theme.fonts.sansSemiBold, fontSize: 15, color: theme.colors.text },
  count: { fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.accent },

  /* grid */
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  docCard: { width: "31%", marginBottom: theme.spacing(2.5) },
  docTitle: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 12,
    color: theme.colors.text,
    marginTop: 7,
    lineHeight: 15,
  },
  docRemoveBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  docRemoveText: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 10.5,
  },
  hint: { fontFamily: theme.fonts.sans, color: theme.colors.textDim, fontSize: 13, paddingVertical: 8 },

  /* covers */
  cover: {
    aspectRatio: 3 / 4,
    borderRadius: 7,
    borderWidth: 1,
    padding: 11,
    gap: 4,
    shadowColor: "#281E0F",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  coverHead: { height: 5, borderRadius: 2, marginBottom: 3 },
  coverRow: { height: 3, borderRadius: 2 },

  miniCover: {
    width: 64,
    height: 86,
    borderRadius: 7,
    backgroundColor: theme.colors.ink,
    paddingVertical: 12,
    paddingHorizontal: 11,
    justifyContent: "center",
    gap: 5,
    overflow: "hidden",
  },
  miniCoverLarge: { width: 64, height: 86 },
  miniSpine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5, backgroundColor: theme.colors.accent },
  miniLine: { height: 4, borderRadius: 2, backgroundColor: "#EBDFC6" },

  cardSpinner: { position: "absolute", top: "40%", left: 0, right: 0 },

  /* empty state */
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing(4), gap: 14 },
  emptyCover: {
    width: 96,
    height: 124,
    borderRadius: 8,
    backgroundColor: theme.colors.ink,
    paddingVertical: 18,
    paddingHorizontal: 18,
    justifyContent: "center",
    gap: 7,
    overflow: "hidden",
    marginBottom: 6,
  },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 8, backgroundColor: theme.colors.accent },
  coverLine: { height: 5, borderRadius: 3, backgroundColor: "#EBDFC6" },
  emptyTitle: { fontFamily: theme.fonts.serifMedium, fontSize: 24, color: theme.colors.text },
  emptyBody: {
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    color: theme.colors.textMute,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  cta: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: 15,
    paddingHorizontal: 26,
    alignItems: "center",
    marginTop: 8,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaText: { color: theme.colors.onAccent, fontFamily: theme.fonts.sansSemiBold, fontSize: 16 },

  /* modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20,17,11,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: theme.spacing(2.5),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2.5),
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.serifSemiBold,
    fontSize: 25,
  },
  modalClose: { color: theme.colors.textDim, fontSize: 18, paddingHorizontal: 4 },
  modalContent: { gap: theme.spacing(1.25), paddingTop: theme.spacing(1.5), paddingBottom: 8 },
  voiceGuide: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7DED8",
    backgroundColor: theme.colors.tealSoft,
    paddingHorizontal: theme.spacing(1.25),
    paddingVertical: theme.spacing(1),
  },
  voiceGuideTitle: {
    color: theme.colors.teal,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 14,
  },
  voiceGuideText: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sans,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 3,
  },
  voiceChoiceGroup: {
    gap: theme.spacing(1),
  },
  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  languageChoice: {
    width: "48%",
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: "center",
  },
  languageChoiceOn: {
    borderColor: theme.colors.teal,
    backgroundColor: theme.colors.tealSoft,
  },
  languageChoiceTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 13,
  },
  languageChoiceTitleOn: {
    color: theme.colors.teal,
  },
  languageChoiceMeta: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.sans,
    fontSize: 10.5,
    lineHeight: 13,
    marginTop: 3,
  },
  languageChoiceMetaOn: {
    color: theme.colors.textMute,
  },

  voiceChoice: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.card,
  },
  voiceChoiceOn: {
    backgroundColor: theme.colors.tealSoft,
    borderColor: theme.colors.teal,
  },
  voiceChoiceTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  voiceChoiceTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 15,
  },
  voiceChoiceTitleOn: { color: theme.colors.teal },
  voiceChoiceState: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 12,
  },
  voiceChoiceStateOn: { color: theme.colors.teal },
  voiceChoiceDetail: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },
  voiceChoiceDetailOn: { color: theme.colors.textMute },
  voiceBlock: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing(1.25),
    gap: theme.spacing(0.75),
  },
  voiceBlockTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 14,
  },
  voiceBlockHint: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sans,
    fontSize: 12.5,
    lineHeight: 17,
  },
  localProgressWrap: {
    gap: 6,
  },
  localProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    overflow: "hidden",
  },
  localProgressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: theme.colors.teal,
  },
  localReadyText: {
    color: theme.colors.teal,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 12.5,
  },
  voiceList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  voiceRegionRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  voiceRegionChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  voiceRegionChipOn: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  voiceRegionChipText: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 12,
  },
  voiceRegionChipTextOn: { color: theme.colors.onAccent },
  voiceEmpty: { color: theme.colors.textDim, fontFamily: theme.fonts.sans, fontSize: 13 },
  voiceChip: {
    maxWidth: "100%",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: theme.colors.surface,
  },
  voiceChipOn: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accent,
  },
  voiceChipText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 12.5,
  },
  voiceChipSub: {
    color: theme.colors.textDim,
    fontFamily: theme.fonts.sans,
    fontSize: 11,
    marginTop: 1,
  },
  voiceChipTextOn: { color: theme.colors.accent },
  cloudChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
  },
  cloudChipOn: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  cloudChipText: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 13,
  },
  cloudChipTextOn: { color: theme.colors.onAccent },
  voicePackBtn: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.colors.accent,
  },
  voicePackText: {
    color: theme.colors.onAccent,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 13,
  },

  aboutVersion: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 15,
  },
  aboutBody: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  helpRows: { gap: 8 },
  helpRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 8,
  },
  helpLabel: {
    width: 48,
    color: theme.colors.accent,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 13,
  },
  helpText: {
    flex: 1,
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sans,
    fontSize: 13.5,
    lineHeight: 18,
  },
  aboutActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  aboutBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
  },
  aboutBtnText: {
    color: theme.colors.onAccent,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 14,
  },
  aboutBtnGhost: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
  },
  aboutBtnGhostText: {
    color: theme.colors.textMute,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 14,
  },
});
