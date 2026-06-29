export interface ReadingLanguage {
  code: string;
  label: string;
  shortLabel: string;
  voiceLanguage: string;
  ocrLang: string;
  aiLanguage: string;
  voicePrefixes: string[];
  edgeAi: boolean;
  rtl?: boolean;
}

export const READING_LANGUAGES: ReadingLanguage[] = [
  {
    code: "en",
    label: "English",
    shortLabel: "EN",
    voiceLanguage: "en-US",
    ocrLang: "eng",
    aiLanguage: "English",
    voicePrefixes: ["en"],
    edgeAi: true,
  },
  {
    code: "es",
    label: "Spanish",
    shortLabel: "ES",
    voiceLanguage: "es-ES",
    ocrLang: "spa",
    aiLanguage: "Spanish",
    voicePrefixes: ["es"],
    edgeAi: false,
  },
  {
    code: "fr",
    label: "French",
    shortLabel: "FR",
    voiceLanguage: "fr-FR",
    ocrLang: "fra",
    aiLanguage: "French",
    voicePrefixes: ["fr"],
    edgeAi: false,
  },
  {
    code: "de",
    label: "German",
    shortLabel: "DE",
    voiceLanguage: "de-DE",
    ocrLang: "deu",
    aiLanguage: "German",
    voicePrefixes: ["de"],
    edgeAi: false,
  },
  {
    code: "it",
    label: "Italian",
    shortLabel: "IT",
    voiceLanguage: "it-IT",
    ocrLang: "ita",
    aiLanguage: "Italian",
    voicePrefixes: ["it"],
    edgeAi: false,
  },
  {
    code: "pt",
    label: "Portuguese",
    shortLabel: "PT",
    voiceLanguage: "pt-BR",
    ocrLang: "por",
    aiLanguage: "Portuguese",
    voicePrefixes: ["pt"],
    edgeAi: false,
  },
  {
    code: "nl",
    label: "Dutch",
    shortLabel: "NL",
    voiceLanguage: "nl-NL",
    ocrLang: "nld",
    aiLanguage: "Dutch",
    voicePrefixes: ["nl"],
    edgeAi: false,
  },
  {
    code: "sv",
    label: "Swedish",
    shortLabel: "SV",
    voiceLanguage: "sv-SE",
    ocrLang: "swe",
    aiLanguage: "Swedish",
    voicePrefixes: ["sv"],
    edgeAi: false,
  },
  {
    code: "no",
    label: "Norwegian",
    shortLabel: "NO",
    voiceLanguage: "nb-NO",
    ocrLang: "nor",
    aiLanguage: "Norwegian",
    voicePrefixes: ["no", "nb", "nn"],
    edgeAi: false,
  },
  {
    code: "da",
    label: "Danish",
    shortLabel: "DA",
    voiceLanguage: "da-DK",
    ocrLang: "dan",
    aiLanguage: "Danish",
    voicePrefixes: ["da"],
    edgeAi: false,
  },
  {
    code: "fi",
    label: "Finnish",
    shortLabel: "FI",
    voiceLanguage: "fi-FI",
    ocrLang: "fin",
    aiLanguage: "Finnish",
    voicePrefixes: ["fi"],
    edgeAi: false,
  },
  {
    code: "tr",
    label: "Turkish",
    shortLabel: "TR",
    voiceLanguage: "tr-TR",
    ocrLang: "tur",
    aiLanguage: "Turkish",
    voicePrefixes: ["tr"],
    edgeAi: false,
  },
  {
    code: "id",
    label: "Indonesian",
    shortLabel: "ID",
    voiceLanguage: "id-ID",
    ocrLang: "ind",
    aiLanguage: "Indonesian",
    voicePrefixes: ["id", "in"],
    edgeAi: false,
  },
  {
    code: "vi",
    label: "Vietnamese",
    shortLabel: "VI",
    voiceLanguage: "vi-VN",
    ocrLang: "vie",
    aiLanguage: "Vietnamese",
    voicePrefixes: ["vi"],
    edgeAi: false,
  },
  {
    code: "ja",
    label: "Japanese",
    shortLabel: "JA",
    voiceLanguage: "ja-JP",
    ocrLang: "jpn",
    aiLanguage: "Japanese",
    voicePrefixes: ["ja"],
    edgeAi: false,
  },
  {
    code: "ko",
    label: "Korean",
    shortLabel: "KO",
    voiceLanguage: "ko-KR",
    ocrLang: "kor",
    aiLanguage: "Korean",
    voicePrefixes: ["ko"],
    edgeAi: false,
  },
  {
    code: "zh",
    label: "Chinese (Simplified)",
    shortLabel: "ZH",
    voiceLanguage: "zh-CN",
    ocrLang: "chi_sim",
    aiLanguage: "Chinese",
    voicePrefixes: ["zh"],
    edgeAi: false,
  },
  {
    code: "hi",
    label: "Hindi",
    shortLabel: "HI",
    voiceLanguage: "hi-IN",
    ocrLang: "hin",
    aiLanguage: "Hindi",
    voicePrefixes: ["hi"],
    edgeAi: false,
  },
  {
    code: "ru",
    label: "Russian",
    shortLabel: "RU",
    voiceLanguage: "ru-RU",
    ocrLang: "rus",
    aiLanguage: "Russian",
    voicePrefixes: ["ru"],
    edgeAi: false,
  },
  {
    code: "ar",
    label: "Arabic",
    shortLabel: "AR",
    voiceLanguage: "ar-SA",
    ocrLang: "ara",
    aiLanguage: "Arabic",
    voicePrefixes: ["ar"],
    edgeAi: false,
    rtl: true,
  },
  {
    code: "fa",
    label: "Persian",
    shortLabel: "FA",
    voiceLanguage: "fa-IR",
    ocrLang: "fas",
    aiLanguage: "Persian",
    voicePrefixes: ["fa", "fas"],
    edgeAi: false,
    rtl: true,
  },
];

const DEFAULT_LANGUAGE = READING_LANGUAGES[0];

export function normalizeReadingLanguageCode(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_LANGUAGE.code;
  const code = value.trim().toLowerCase().replace("_", "-");
  if (!code) return DEFAULT_LANGUAGE.code;
  const direct = READING_LANGUAGES.find((language) => language.code === code);
  if (direct) return direct.code;
  const primary = code.split("-")[0];
  return READING_LANGUAGES.some((language) => language.code === primary)
    ? primary
    : DEFAULT_LANGUAGE.code;
}

export function getReadingLanguage(value: unknown): ReadingLanguage {
  const code = normalizeReadingLanguageCode(value);
  return READING_LANGUAGES.find((language) => language.code === code) ?? DEFAULT_LANGUAGE;
}

export function languageMatchesVoice(voiceLanguage: string | undefined, language: ReadingLanguage) {
  const normalized = (voiceLanguage || "").toLowerCase().replace("_", "-");
  const primary = normalized.split("-")[0];
  return language.voicePrefixes.includes(primary);
}

export function voiceRegionKey(voiceLanguage: string): string {
  const parts = voiceLanguage.replace("_", "-").split("-");
  return (parts[1] || parts[0] || "default").toUpperCase();
}

export function voiceRegionLabel(voiceLanguage: string, language: ReadingLanguage): string {
  const key = voiceRegionKey(voiceLanguage);
  if (language.code === "en") {
    const english = ENGLISH_REGION_LABELS[key];
    if (english) return english;
  }
  const region = REGION_LABELS[key];
  return region ? `${language.label} (${region})` : language.label;
}

const ENGLISH_REGION_LABELS: Record<string, string> = {
  AU: "Australian English",
  CA: "Canadian English",
  GB: "British English",
  IE: "Irish English",
  IN: "Indian English",
  NZ: "New Zealand English",
  UK: "British English",
  US: "American English",
  ZA: "South African English",
};

const REGION_LABELS: Record<string, string> = {
  AE: "UAE",
  AR: "Argentina",
  AT: "Austria",
  AU: "Australia",
  BE: "Belgium",
  BR: "Brazil",
  CA: "Canada",
  CH: "Switzerland",
  CN: "China",
  CO: "Colombia",
  DE: "Germany",
  DK: "Denmark",
  EG: "Egypt",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  ID: "Indonesia",
  IE: "Ireland",
  IN: "India",
  IR: "Iran",
  IT: "Italy",
  JP: "Japan",
  KR: "Korea",
  MX: "Mexico",
  NL: "Netherlands",
  NO: "Norway",
  NZ: "New Zealand",
  PT: "Portugal",
  RU: "Russia",
  SA: "Saudi Arabia",
  SE: "Sweden",
  TR: "Turkey",
  TW: "Taiwan",
  US: "United States",
  VN: "Vietnam",
  ZA: "South Africa",
};
