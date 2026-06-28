import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { theme } from "../theme";

export type ImportPhase = "uploading" | "processing" | "done";

interface Props {
  /** 0–100, real bytes uploaded. */
  percent: number;
  phase: ImportPhase;
  loadedBytes?: number;
  totalBytes?: number;
  fileName?: string;
}

/**
 * ImportProgress — a book "page" that fills with warm ink as the file uploads.
 * On-brand for a reading app: you literally watch the page fill up. Shows the
 * real percentage and MB transferred, with a phase label.
 */
export function ImportProgress({ percent, phase, loadedBytes, totalBytes, fileName }: Props) {
  const fill = useRef(new Animated.Value(0)).current; // 0..1 of page height
  const shimmer = useRef(new Animated.Value(0)).current;
  const num = useRef(new Animated.Value(0)).current; // animated % for the counter
  const [shown, setShown] = React.useState(0);

  const clamped = Math.max(0, Math.min(100, percent));

  useEffect(() => {
    Animated.timing(fill, {
      toValue: clamped / 100,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    Animated.timing(num, {
      toValue: clamped,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clamped, fill, num]);

  useEffect(() => {
    const id = num.addListener(({ value }) => setShown(Math.round(value)));
    return () => num.removeListener(id);
  }, [num]);

  // Gentle shimmer sweep while the server processes (indeterminate phase).
  useEffect(() => {
    if (phase !== "processing") return;
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [phase, shimmer]);

  const PAGE_H = 196;
  const fillHeight = fill.interpolate({ inputRange: [0, 1], outputRange: [0, PAGE_H] });
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] });

  const label =
    phase === "done"
      ? "Ready"
      : phase === "processing"
        ? "Preparing your book…"
        : "Uploading…";

  return (
    <View style={styles.overlay}>
      <View style={styles.stage}>
        {/* The page that fills with ink */}
        <View style={styles.page}>
          {/* red book spine (brand) */}
          <View style={styles.spine} />
          {/* faint text lines behind the fill */}
          <View style={styles.lines} pointerEvents="none">
            {[0.7, 0.5, 0.62, 0.42, 0.66, 0.5, 0.58].map((w, i) => (
              <View key={i} style={[styles.textLine, { width: `${w * 100}%` }]} />
            ))}
          </View>
          {/* the rising ink fill */}
          <Animated.View style={[styles.fill, { height: fillHeight }]}>
            <View style={styles.fillTop} />
          </Animated.View>
          {/* big percentage */}
          <View style={styles.numWrap} pointerEvents="none">
            <Text style={styles.num}>{shown}</Text>
            <Text style={styles.pct}>%</Text>
          </View>
        </View>

        {/* processing shimmer bar */}
        {phase === "processing" ? (
          <View style={styles.shimmerTrack}>
            <Animated.View
              style={[styles.shimmerDot, { transform: [{ translateX: shimmerX }] }]}
            />
          </View>
        ) : (
          <View style={styles.shimmerTrack} />
        )}

        <Text style={styles.phase}>{label}</Text>
        {fileName ? (
          <Text style={styles.file} numberOfLines={1}>
            {fileName}
          </Text>
        ) : null}
        {phase === "uploading" && totalBytes ? (
          <Text style={styles.bytes}>
            {fmtMB(loadedBytes || 0)} / {fmtMB(totalBytes)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function fmtMB(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  stage: { alignItems: "center", gap: theme.spacing(1.5) },
  page: {
    width: 148,
    height: 196,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    // soft lift
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  spine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 14,
    backgroundColor: theme.colors.accent,
  },
  lines: {
    position: "absolute",
    left: 28,
    right: 16,
    top: 22,
    gap: 12,
  },
  textLine: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceAlt,
  },
  fill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.accentMid,
  },
  fillTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.colors.accent,
    opacity: 0.85,
  },
  numWrap: { flexDirection: "row", alignItems: "flex-start" },
  num: {
    fontFamily: theme.fonts.serifSemiBold,
    fontSize: 46,
    color: theme.colors.ink,
    letterSpacing: -1,
  },
  pct: {
    fontFamily: theme.fonts.serifMedium,
    fontSize: 18,
    color: theme.colors.textMute,
    marginTop: 8,
    marginLeft: 2,
  },
  shimmerTrack: {
    width: 148,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: "hidden",
    justifyContent: "center",
  },
  shimmerDot: {
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.accent,
  },
  phase: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 15,
    color: theme.colors.text,
  },
  file: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    color: theme.colors.textDim,
    maxWidth: 220,
  },
  bytes: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.colors.textMute,
  },
});
