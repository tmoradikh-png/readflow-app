import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Keyboard,
} from "react-native";
import { Bookmark, Bookmarks } from "../services/Bookmarks";
import { ThemedNotice } from "./ThemedNotice";
import { theme } from "../theme";

interface CurrentPos {
  page: number;
  chunkIndex: number;
  sentenceId: number;
  preview: string;
}

interface Props {
  docId: string;
  fileName: string;
  pageCount: number;
  current: CurrentPos;
  onJump: (b: Bookmark) => void;
  onGoToPage: (page: number) => void;
  onClose: () => void;
}

export function BookmarkPanel({
  docId,
  fileName,
  pageCount,
  current,
  onJump,
  onGoToPage,
  onClose,
}: Props) {
  const [items, setItems] = useState<Bookmark[]>([]);
  const [tag, setTag] = useState("");
  const [pageInput, setPageInput] = useState("");
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  // Lift the sheet above the on-screen keyboard so the input stays visible.
  const [kb, setKb] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setKb(e.endCoordinates?.height ?? 0)
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  async function refresh() {
    setItems(await Bookmarks.list(docId));
  }
  useEffect(() => {
    refresh();
  }, [docId]);

  async function saveCurrent() {
    const name = tag.trim() || `Page ${current.page}`;
    await Bookmarks.upsert({
      tag: name,
      docId,
      fileName,
      page: current.page,
      chunkIndex: current.chunkIndex,
      sentenceId: current.sentenceId,
      preview: current.preview,
    });
    setTag("");
    refresh();
  }

  async function del(b: Bookmark) {
    await Bookmarks.remove(docId, b.tag);
    refresh();
  }

  function go() {
    const n = parseInt(pageInput, 10);
    if (!Number.isFinite(n) || n < 1 || n > pageCount) {
      setNotice({
        title: "Go to page",
        body: `Enter a page between 1 and ${pageCount}.`,
      });
      return;
    }
    onGoToPage(n);
    onClose();
  }

  return (
    <>
    <Pressable style={styles.backdrop} onPress={onClose} />
    <View style={[styles.panel, { bottom: kb }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Navigation</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.close}>x</Text>
        </Pressable>
      </View>

      {/* Go to page */}
      <Text style={styles.sectionLabel}>Go to page (1-{pageCount})</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder={`e.g. 5`}
          placeholderTextColor={theme.colors.textDim}
          keyboardType="number-pad"
          value={pageInput}
          onChangeText={setPageInput}
          onSubmitEditing={go}
          returnKeyType="go"
        />
        <Pressable style={styles.primaryBtn} onPress={go}>
          <Text style={styles.primaryBtnText}>Go</Text>
        </Pressable>
      </View>

      {/* Save current as a named tag */}
      <Text style={styles.sectionLabel}>Bookmark page {current.page}</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Tag name (re-use to update)"
          placeholderTextColor={theme.colors.textDim}
          value={tag}
          onChangeText={setTag}
          onSubmitEditing={saveCurrent}
          returnKeyType="done"
        />
        <Pressable style={styles.primaryBtn} onPress={saveCurrent}>
          <Text style={styles.primaryBtnText}>Save</Text>
        </Pressable>
      </View>

      {/* Saved bookmarks */}
      <Text style={styles.sectionLabel}>Saved</Text>
      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 12 }}>
        {items.length === 0 && <Text style={styles.empty}>No bookmarks yet.</Text>}
        {items.map((b) => (
          <View key={b.tag} style={styles.bookmark}>
            <Pressable style={{ flex: 1 }} onPress={() => onJump(b)}>
              <Text style={styles.bmTag}>{b.tag}</Text>
              <Text style={styles.bmMeta}>
                Page {b.page} · {b.preview}
              </Text>
            </Pressable>
            <Pressable onPress={() => del(b)} hitSlop={8}>
              <Text style={styles.bmDelete}>Remove</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
    <ThemedNotice
      visible={Boolean(notice)}
      title={notice?.title || ""}
      body={notice?.body || ""}
      onClose={() => setNotice(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20,17,11,0.3)",
    zIndex: 40,
    elevation: 40,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "80%",
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(2),
    zIndex: 41,
    elevation: 41,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: theme.colors.text, fontSize: 18, fontFamily: theme.fonts.serifSemiBold },
  close: { color: theme.colors.textDim, fontSize: 18, fontFamily: theme.fonts.sansBold },
  sectionLabel: {
    color: theme.colors.accent,
    fontWeight: "700",
    fontSize: 13,
    marginTop: 14,
    marginBottom: 6,
  },
  row: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
  },
  primaryBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  list: { marginTop: 4 },
  empty: { color: theme.colors.textDim, paddingVertical: 8 },
  bookmark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  bmTag: { color: theme.colors.text, fontWeight: "700", fontSize: 15 },
  bmMeta: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  bmDelete: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 12,
  },
});
