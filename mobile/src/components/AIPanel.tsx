import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from "react-native";
import { AIProvider, AITask, AIResult } from "../services/AIProvider";
import { isNetworkError } from "../services/PDFParser";
import { theme } from "../theme";

interface Props {
  /** Text of the current 10-page section the AI should reason about. */
  contextText: string;
  language?: string;
  onClose: () => void;
}

const ACTIONS: { task: AITask; label: string }[] = [
  { task: "summary", label: "Summary" },
  { task: "explain", label: "Explain" },
  { task: "simplify", label: "Simplify" },
  { task: "key_points", label: "Key points" },
];

export function AIPanel({ contextText, language = "en", onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIResult | null>(null);
  const [question, setQuestion] = useState("");

  async function run(task: AITask, q?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await AIProvider.run({ task, text: contextText, question: q, language });
      setResult(res);
    } catch (e: any) {
      setError(
        isNetworkError(e)
          ? "AI needs an internet connection. Reading and the device voice still work offline — reconnect to use AI."
          : e?.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* tap anywhere outside the sheet to close */}
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Assistant</Text>
        <Pressable onPress={onClose} hitSlop={16} style={styles.closeBtn}>
          <Text style={styles.close}>Close ✕</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        {ACTIONS.map((a) => (
          <Pressable key={a.task} style={styles.chip} onPress={() => run(a.task)}>
            <Text style={styles.chipText}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.askRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask about this section…"
          placeholderTextColor={theme.colors.textDim}
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={() => question.trim() && run("ask", question.trim())}
          returnKeyType="send"
        />
        <Pressable
          style={styles.askBtn}
          onPress={() => question.trim() && run("ask", question.trim())}
        >
          <Text style={styles.askBtnText}>Ask</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 16 }}>
        {loading && <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 16 }} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {result && !loading && (
          <View style={{ gap: 12 }}>
            {result.answer ? <Section label="Answer" body={result.answer} /> : null}
            {result.summary ? <Section label="Summary" body={result.summary} /> : null}
            {result.simple_explanation ? (
              <Section label="In simple terms" body={result.simple_explanation} />
            ) : null}
            {result.key_points?.length ? (
              <View>
                <Text style={styles.sectionLabel}>Key points</Text>
                {result.key_points.map((k, i) => (
                  <Text key={i} style={styles.bullet}>
                    •  {k}
                  </Text>
                ))}
              </View>
            ) : null}
            {result.terms?.length ? (
              <View>
                <Text style={styles.sectionLabel}>Terms</Text>
                {result.terms.map((t, i) => (
                  <Text key={i} style={styles.bullet}>
                    <Text style={{ fontWeight: "700" }}>{t.term}: </Text>
                    {t.meaning}
                  </Text>
                ))}
              </View>
            ) : null}
            {result.cached ? <Text style={styles.cached}>cached</Text> : null}
          </View>
        )}
      </ScrollView>
      </View>
    </>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  return (
    <View>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 40,
    elevation: 40,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "72%",
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(2),
    zIndex: 41,
    elevation: 41,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: "700" },
  closeBtn: {
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  close: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: { color: theme.colors.text, fontWeight: "600" },
  askRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
  },
  askBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  askBtnText: { color: "#fff", fontWeight: "700" },
  body: { marginTop: 12 },
  error: { color: theme.colors.danger, marginTop: 12 },
  sectionLabel: { color: theme.colors.accent, fontWeight: "700", marginBottom: 4, fontSize: 13 },
  sectionBody: { color: theme.colors.text, fontSize: 15, lineHeight: 22 },
  bullet: { color: theme.colors.text, fontSize: 15, lineHeight: 22, marginBottom: 2 },
  cached: { color: theme.colors.textDim, fontSize: 11, marginTop: 8, textAlign: "right" },
});
