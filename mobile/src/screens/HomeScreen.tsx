import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { PDFParser, ParsedPdf } from "../services/PDFParser";
import { ImportProgress, ImportPhase } from "../components/ImportProgress";
import { theme } from "../theme";

interface Props {
  onParsed: (doc: ParsedPdf) => void;
}

export function HomeScreen({ onParsed }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imp, setImp] = useState<{
    phase: ImportPhase;
    percent: number;
    loaded: number;
    total: number;
    fileName?: string;
  } | null>(null);

  async function pick() {
    setError(null);
    setLoading(true);
    try {
      const doc = await PDFParser.pickAndParse({
        onProgress: (loaded, total) => {
          setImp({
            phase: "uploading",
            percent: total ? Math.round((loaded / total) * 100) : 0,
            loaded,
            total,
          });
        },
        onUploaded: () => {
          setImp((p) => (p ? { ...p, phase: "processing", percent: 100 } : p));
        },
      });
      if (doc) {
        setImp((p) => (p ? { ...p, phase: "done", percent: 100 } : p));
        onParsed(doc);
      }
    } catch (e: any) {
      setError(e?.message || "Could not read that PDF.");
    } finally {
      setLoading(false);
      setImp(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {imp ? (
        <ImportProgress
          percent={imp.percent}
          phase={imp.phase}
          loadedBytes={imp.loaded}
          totalBytes={imp.total}
          fileName={imp.fileName}
        />
      ) : null}
      <View style={styles.container}>
        <Text style={styles.logo}>ReadFlow</Text>
        <Text style={styles.tagline}>
          Upload a PDF. It reflows to your screen, reads aloud with a natural voice, and explains
          anything with AI.
        </Text>

        <Pressable style={styles.cta} onPress={pick} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>＋  Upload PDF</Text>
          )}
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.features}>
          <Feature icon="🅰" text="Slide to resize text — it fills the screen" />
          <Feature icon="🔊" text="Natural voice reads with synced highlighting" />
          <Feature icon="📖" text="Reads 10 pages at a time, with understanding" />
          <Feature icon="✨" text="Summarize, explain, simplify, ask questions" />
        </View>

        <Text style={styles.note}>First pages free • Premium unlocks unlimited reading</Text>
      </View>
    </SafeAreaView>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { flex: 1, padding: theme.spacing(3), justifyContent: "center", gap: theme.spacing(2) },
  logo: { color: theme.colors.text, fontSize: 40, fontWeight: "900", letterSpacing: -1 },
  tagline: { color: theme.colors.textDim, fontSize: 16, lineHeight: 23 },
  cta: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: theme.spacing(1),
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  error: { color: theme.colors.danger },
  features: { gap: 12, marginTop: theme.spacing(2) },
  feature: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIcon: { fontSize: 20, width: 28, textAlign: "center" },
  featureText: { color: theme.colors.text, fontSize: 15, flex: 1 },
  note: { color: theme.colors.textDim, fontSize: 12, marginTop: theme.spacing(2) },
});
