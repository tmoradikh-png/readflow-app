import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import Constants from "expo-constants";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { PDFParser, ParsedPdf, isNetworkError } from "../services/PDFParser";
import { Library, LibraryItem } from "../services/Library";
import { DocCache } from "../services/DocCache";
import { EntitlementSnapshot } from "../services/Entitlements";
import { theme } from "../theme";

interface Props {
  /** Open a freshly parsed document in the reader. */
  onOpen: (doc: ParsedPdf, item: LibraryItem) => void;
  entitlement: EntitlementSnapshot;
}

/** Deterministic cover variant from the document id. */
function coverVariant(id: string): 0 | 1 | 2 | 3 {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 4) as 0 | 1 | 2 | 3;
}

export function LibraryScreen({ onOpen, entitlement }: Props) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setItems(await Library.list());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function importNew() {
    setError(null);
    setLoading(true);
    try {
      const doc = await PDFParser.pickAndParse();
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

  function confirmRemove(item: LibraryItem) {
    Alert.alert("Remove from library?", `“${item.title}” will be removed from this device.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await Library.remove(item.id);
          await DocCache.remove(item.id);
          await refresh();
        },
      },
    ]);
  }

  const recent = items[0];
  const rest = items.slice(1);
  const isPaid = Boolean(
    entitlement.features.ai || entitlement.features.ocr || entitlement.features.unlimitedLibrary
  );
  const planLabel = isPaid ? entitlement.name : "Free";

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
          Reflowed reading, device voice, and saved library are ready.
        </Text>
      </View>

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
                onLongPress={() => confirmRemove(item)}
              />
            ))}
            {rest.length === 0 && (
              <Text style={styles.hint}>Your next document will appear here.</Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ---------- pieces ---------- */

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
}: {
  item: LibraryItem;
  busy: boolean;
  onPress: () => void;
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
      {busy && <ActivityIndicator style={styles.cardSpinner} color={theme.colors.accent} />}
    </Pressable>
  );
}

function DocCard({
  item,
  busy,
  onPress,
  onLongPress,
}: {
  item: LibraryItem;
  busy: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      style={styles.docCard}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      disabled={busy}
    >
      <Cover item={item} />
      <Text style={styles.docTitle} numberOfLines={2}>
        {item.title}
      </Text>
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
  brandBlock: { flex: 1 },
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
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
});
