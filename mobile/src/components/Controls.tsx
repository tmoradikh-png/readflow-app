import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { theme } from "../theme";

export interface ReadingSettings {
  fontSize: number;
  lineSpacing: number; // multiplier
  speed: number; // TTS rate
}

interface Props {
  settings: ReadingSettings;
  onChange: (next: ReadingSettings) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  /** Master switch: when off, tapping text won't read and this bar collapses. */
  soundEnabled: boolean;
  onToggleSound: () => void;
  /** Whether the full settings (font, spacing, speed) are shown. */
  expanded: boolean;
  onToggleExpand: () => void;
  /** Safe-area bottom inset (gesture nav bar). */
  bottomInset?: number;
}

export function Controls({
  settings,
  onChange,
  isPlaying,
  onPlayPause,
  onStop,
  soundEnabled,
  onToggleSound,
  expanded,
  onToggleExpand,
  bottomInset = 0,
}: Props) {
  return (
    <View style={[styles.wrap, { paddingBottom: theme.spacing(1) + bottomInset }]}>
      {/* Pull handle — tap to show/hide the reading settings. Always available so
          you can change font/spacing/speed without entering listening mode. */}
      <Pressable style={styles.grabber} onPress={onToggleExpand} hitSlop={10}>
        <View style={styles.grabHandle} />
        <Text style={styles.grabHint}>{expanded ? "Hide settings" : "Settings"}</Text>
      </Pressable>

      {expanded && (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>Font {Math.round(settings.fontSize)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={14}
              maximumValue={40}
              step={1}
              value={settings.fontSize}
              minimumTrackTintColor={theme.colors.accent}
              maximumTrackTintColor={theme.colors.border}
              thumbTintColor={theme.colors.accent}
              onValueChange={(v) => onChange({ ...settings, fontSize: v })}
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Spacing</Text>
            <Stepper
              value={settings.lineSpacing}
              fmt={(v) => `${v.toFixed(1)}x`}
              onDec={() => onChange({ ...settings, lineSpacing: Math.max(1.0, +(settings.lineSpacing - 0.1).toFixed(1)) })}
              onInc={() => onChange({ ...settings, lineSpacing: Math.min(2.4, +(settings.lineSpacing + 0.1).toFixed(1)) })}
            />
            <Text style={styles.label}>Speed</Text>
            <Stepper
              value={settings.speed}
              fmt={(v) => `${v.toFixed(2)}x`}
              onDec={() => onChange({ ...settings, speed: Math.max(0.5, +(settings.speed - 0.1).toFixed(2)) })}
              onInc={() => onChange({ ...settings, speed: Math.min(2.0, +(settings.speed + 0.1).toFixed(2)) })}
            />
          </View>
        </>
      )}

      <View style={styles.playRow}>
        {soundEnabled ? (
          <>
            {/* 1) Sound toggle — turning it off stops tap-to-read and hides this bar. */}
            <Pressable style={[styles.btn, styles.btnSound]} onPress={onToggleSound}>
              <Text style={styles.btnSoundText}>Sound</Text>
            </Pressable>
            {/* 2) Play / Pause */}
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onPlayPause}>
              <Text style={styles.btnPrimaryText}>{isPlaying ? "Pause" : "Play"}</Text>
            </Pressable>
            {/* 3) Stop */}
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onStop}>
              <Text style={styles.btnGhostText}>Stop</Text>
            </Pressable>
          </>
        ) : (
          // Collapsed: a single, low-footprint button to enter listening mode.
          <Pressable style={[styles.btn, styles.btnListen]} onPress={onToggleSound}>
            <Text style={styles.btnListenText}>Listen</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Stepper({
  value,
  onInc,
  onDec,
  fmt,
}: {
  value: number;
  onInc: () => void;
  onDec: () => void;
  fmt: (v: number) => string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={onDec}>
        <Text style={styles.stepBtnText}>-</Text>
      </Pressable>
      <Text style={styles.stepValue}>{fmt(value)}</Text>
      <Pressable style={styles.stepBtn} onPress={onInc}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing(1.5),
    paddingTop: theme.spacing(0.5),
    gap: theme.spacing(1),
  },
  grabber: {
    alignItems: "center",
    paddingVertical: theme.spacing(0.5),
    gap: 4,
  },
  grabHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
  },
  grabHint: {
    color: theme.colors.textDim,
    fontSize: 11,
    fontFamily: theme.fonts.sansSemiBold,
  },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1) },
  label: { color: theme.colors.textDim, fontSize: 13, width: 64 },
  slider: { flex: 1, height: 36 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  stepBtnText: { color: theme.colors.text, fontSize: 18 },
  stepValue: { color: theme.colors.text, width: 46, textAlign: "center", fontSize: 13 },
  playRow: { flexDirection: "row", gap: theme.spacing(1) },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnGhost: { backgroundColor: theme.colors.surfaceAlt },
  btnGhostText: { color: theme.colors.text, fontWeight: "600", fontSize: 15 },
  // Sound toggle (listening on) — quieter than Play, clearly "active".
  btnSound: {
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentMid,
  },
  btnSoundText: { color: theme.colors.accent, fontWeight: "700", fontSize: 15 },
  // Collapsed "Tap to listen" pill (listening off).
  btnListen: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnListenText: { color: theme.colors.textMute, fontWeight: "700", fontSize: 15 },
});
