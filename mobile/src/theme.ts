import { Platform } from "react-native";

/**
 * ReadFlow "Paper" theme — warm, book-like palette inspired by the Reflow design.
 * Cream paper backgrounds, ink text, a single warm read-orange accent, and the
 * Spectral / Hanken Grotesk type pairing (loaded in App.tsx via expo-google-fonts).
 */
export const fontFamilies = {
  // Reading & titles (serif)
  serif: "Spectral_400Regular",
  serifMedium: "Spectral_500Medium",
  serifSemiBold: "Spectral_600SemiBold",
  serifItalic: "Spectral_400Regular_Italic",
  // Interface (sans)
  sans: "HankenGrotesk_400Regular",
  sansMedium: "HankenGrotesk_500Medium",
  sansSemiBold: "HankenGrotesk_600SemiBold",
  sansBold: "HankenGrotesk_700Bold",
  // Small mono labels (system monospace — no extra font asset needed)
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string,
};

export const theme = {
  colors: {
    // Surfaces
    bg: "#F4ECD6", // paper
    surface: "#FBF4E6", // cards / panels
    surfaceAlt: "#EFE6D0", // chips / steppers / inset
    card: "#FCF6EA", // document cards

    // Ink
    text: "#2A2620", // primary ink
    body: "#33302A", // reading body
    textDim: "#9C9384", // secondary
    textMute: "#6E665A", // tertiary

    // Brand accent (warm read-orange)
    accent: "#E5533A",
    accentSoft: "#F7DDD4", // light tint — icon chips, underlines
    accentMid: "#F4C5B5", // medium tint — active sentence highlight
    onAccent: "#FBF6EC", // text/icons on accent

    // Marks
    ink: "#20180F", // dark book "spine"
    night: "#14110B",
    gold: "#EAD08A",

    // Reading themes (selectable later)
    sepia: "#F0E2C8",

    // Lines & states
    border: "#E8DBC0",
    borderStrong: "#E2D4B8",
    highlight: "#F4C5B5", // active sentence bg
    highlightWord: "#E5533A",
    danger: "#C0392B",
  },
  fonts: fontFamilies,
  radius: 16,
  spacing: (n: number) => n * 8,
};
