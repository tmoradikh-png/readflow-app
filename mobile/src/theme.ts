import { Platform } from "react-native";

/**
 * readFlow reading theme.
 * Warm page surfaces with cool ink and teal support tones, so the app feels
 * book-like without becoming a single beige/orange palette.
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
    bg: "#F7F1E7", // page
    surface: "#FFFDF8", // panels
    surfaceAlt: "#ECE8DE", // controls / inset
    card: "#FFFCF4", // document cards

    // Ink
    text: "#1F2523", // primary ink
    body: "#252A28", // reading body
    textDim: "#7D8580", // secondary
    textMute: "#59635E", // tertiary

    // Brand accent
    accent: "#D95D39",
    accentSoft: "#FBE3D9",
    accentMid: "#F2B79E",
    onAccent: "#FFFDF8",

    // Marks
    ink: "#17201D",
    night: "#101816",
    gold: "#D4B25F",
    teal: "#1F7A6D",
    tealSoft: "#DDEDE8",
    sky: "#DDEAF2",
    premium: "#6F5BA7",

    // Reading themes (selectable later)
    sepia: "#F0E4CF",

    // Lines & states
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
