import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const fontFamilies = {
  serif: "Spectral_400Regular",
  serifMedium: "Spectral_500Medium",
  serifSemiBold: "Spectral_600SemiBold",
  serifItalic: "Spectral_400Regular_Italic",
  sans: "HankenGrotesk_400Regular",
  sansMedium: "HankenGrotesk_500Medium",
  sansSemiBold: "HankenGrotesk_600SemiBold",
  sansBold: "HankenGrotesk_700Bold",
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string,
};

export const lightTheme = {
  colors: {
    bg: "#F7F1E7",
    surface: "#FFFDF8",
    surfaceAlt: "#ECE8DE",
    card: "#FFFCF4",
    text: "#1F2523",
    body: "#252A28",
    textDim: "#7D8580",
    textMute: "#59635E",
    accent: "#D95D39",
    accentSoft: "#FBE3D9",
    accentMid: "#F2B79E",
    onAccent: "#FFFDF8",
    ink: "#17201D",
    night: "#101816",
    gold: "#D4B25F",
    teal: "#1F7A6D",
    tealSoft: "#DDEDE8",
    sky: "#DDEAF2",
    premium: "#6F5BA7",
    sepia: "#F0E4CF",
    border: "#DED8CA",
    borderStrong: "#CCC3B2",
    highlight: "#FFE1D5",
    highlightWord: "#C94828",
    danger: "#B73A30",
  },
  fonts: fontFamilies,
  radius: 8,
  spacing: (n: number) => n * 8,
};

export type AppTheme = typeof lightTheme;
export type ThemeMode = "system" | "light" | "dark";

export const darkTheme: AppTheme = {
  ...lightTheme,
  colors: {
    bg: "#171A18",
    surface: "#222624",
    surfaceAlt: "#303532",
    card: "#252A27",
    text: "#F3EFE6",
    body: "#E9E5DC",
    textDim: "#A8B0AA",
    textMute: "#C2C8C3",
    accent: "#F07A55",
    accentSoft: "#4A2E27",
    accentMid: "#A9583E",
    onAccent: "#FFF9F3",
    ink: "#0E1210",
    night: "#080B09",
    gold: "#E1C46F",
    teal: "#58B8A7",
    tealSoft: "#1E3D37",
    sky: "#263B46",
    premium: "#B7A3E5",
    sepia: "#352F27",
    border: "#444A46",
    borderStrong: "#5C635E",
    highlight: "#553229",
    highlightWord: "#FF9A79",
    danger: "#F07B72",
  },
};

const STORAGE_KEY = "readflow.theme-mode.v1";
const ThemeContext = createContext<{
  theme: AppTheme;
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}>({ theme: lightTheme, mode: "system", resolved: "light", setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "system" || saved === "light" || saved === "dark") setModeState(saved);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Appearance.setColorScheme(mode === "system" ? null : mode);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);
  const resolved = mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;
  const value = useMemo(
    () => ({ theme: resolved === "dark" ? darkTheme : lightTheme, mode, resolved, setMode }),
    [mode, resolved, setMode]
  );
  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useAppTheme() {
  return useContext(ThemeContext).theme;
}

export function useThemeController() {
  const { mode, resolved, setMode } = useContext(ThemeContext);
  return { mode, resolved, setMode };
}

export function useThemedStyles(
  factory: (theme: AppTheme) => Record<string, any>
): any {
  const current = useAppTheme();
  return useMemo(() => StyleSheet.create(factory(current) as any), [current, factory]);
}

// Kept for non-component utilities while UI modules migrate to useAppTheme.
export const theme = lightTheme;
