// Generated from the existing backend text rules by scripts/sync-offline-text.cjs.
const OCR_LANG = "eng";
export const SUPPORTED_OCR_LANGS = new Set<string>([
  "eng", // English
  "deu", // German
  "fra", // French
  "spa", // Spanish
  "ita", // Italian
  "por", // Portuguese (Portugal + Brazil share one pack)
  "nld", // Dutch
  "swe", // Swedish
  "nor", // Norwegian
  "dan", // Danish
  "fin", // Finnish
  "tur", // Turkish
  "ind", // Indonesian
  "vie", // Vietnamese
  "jpn", // Japanese
  "kor", // Korean
  "chi_sim", // Chinese (Simplified)
  "hin", // Hindi
  "rus", // Russian
  "ara", // Arabic
  "fas", // Persian
  "tha", // Thai
]);

export function resolveOcrLang(requested?: string): string {
  const lang = (requested || "").trim().toLowerCase();
  if (lang && SUPPORTED_OCR_LANGS.has(lang)) return lang;
  return SUPPORTED_OCR_LANGS.has(OCR_LANG) ? OCR_LANG : "eng";
}

export function needsOcr(text: string, lang?: string): boolean {
  const t = (text || "").trim();
  if (t.length < 16) return true; // essentially empty → scanned image
  const ocrLang = resolveOcrLang(lang);
  if (looksCorrupted(t, ocrLang)) return true;

  const profile = scriptProfile(ocrLang);
  if (profile) {
    const scriptChars = (t.match(profile.re) || []).length;
    if (scriptChars >= profile.minChars) return false;
    const latinChars = (t.match(/[A-Za-z\u00C0-\u024F]/g) || []).length;
    if ((scriptChars + latinChars) / t.length > 0.45 && t.length >= 80) return false;
    const ratio = scriptChars / t.length;
    if (ratio < profile.minRatio) return true;
    return false;
  }

  const letters = (t.match(/[A-Za-z\u00C0-\u024F]/g) || []).length;
  const ratio = letters / t.length;
  // Mostly symbols/gibberish on a short page → likely a bad extraction.
  return ratio < 0.35 && t.length < 200;
}

function looksCorrupted(text: string, lang: string): boolean {
  const replacement = (text.match(/\uFFFD/g) || []).length;
  const mojibakeChars = (text.match(/[ÂÃÄÅÆØÙÛÜÝÞÐÑâãäåæðñøùûüýþÿ]/g) || []).length;
  const mojibakePairs = (
    text.match(/(?:Ã.|Â.|Ð.|Ñ.|Ø.|Ù.|Ú.|Û.|â[€\u0080-\u00BF]?)/g) || []
  ).length;
  const nonLatin = /[^\u0000-\u024F\s\d.,;:!?'"()[\]{}\-–—/\\]/.test(text);
  const repeatedA = nonLatin ? (text.match(/A{2,}/g) || []).length : 0;
  const profile = scriptProfile(lang);
  const scriptRange = scriptRangeForLang(lang);
  const scriptChars =
    profile && scriptRange ? (text.match(profile.re) || []).length : 0;
  const latinA = (text.match(/A/g) || []).length;
  const latinStuckToScript = scriptRange ? countLatinStuckToScript(text, scriptRange) : 0;
  if (profile && scriptChars > 0) {
    if (repeatedA > 0) return true;
    if (shouldTreatEmbeddedLatinAsCorrupt(lang) && latinStuckToScript >= 2) return true;
    if (
      (lang === "ara" || lang === "fas") &&
      scriptChars >= 40 &&
      latinA >= 3 &&
      latinA / scriptChars > 0.015
    ) {
      return true;
    }
    if ((replacement + mojibakeChars + mojibakePairs) / Math.max(1, text.length) > 0.012) {
      return true;
    }
  }
  // Latin-script books legitimately contain characters such as å, ø, æ, ü,
  // ñ and ÿ. Treat only mojibake *patterns* as suspicious there; reserve the
  // broad single-character mojibake count for non-Latin script repair.
  const bad =
    replacement + mojibakePairs * 2 + (profile ? mojibakeChars : 0) + repeatedA * 2;
  return bad / Math.max(1, text.length) > 0.018;
}

function shouldTreatEmbeddedLatinAsCorrupt(lang: string): boolean {
  // CJK books often mix Latin product names directly into text. For scripts
  // below, glued Latin fragments usually indicate a broken PDF text layer.
  return ["ara", "fas", "rus", "hin", "tha", "kor"].includes(lang);
}

function countLatinStuckToScript(text: string, scriptRange: string): number {
  const re = new RegExp(
    `(?:[${scriptRange}][A-Za-z]+|[A-Za-z]+[${scriptRange}])`,
    "g"
  );
  return (text.match(re) || []).length;
}

function scriptRangeForLang(lang: string): string | null {
  switch (lang) {
    case "ara":
    case "fas":
      return "\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF";
    case "rus":
      return "\\u0400-\\u04FF";
    case "hin":
      return "\\u0900-\\u097F";
    case "jpn":
      return "\\u3040-\\u30FF\\u4E00-\\u9FFF";
    case "kor":
      return "\\uAC00-\\uD7AF\\u1100-\\u11FF";
    case "chi_sim":
      return "\\u4E00-\\u9FFF";
    case "tha":
      return "\\u0E00-\\u0E7F";
    default:
      return null;
  }
}

function scriptProfile(lang: string): { re: RegExp; minRatio: number; minChars: number } | null {
  switch (lang) {
    case "ara":
    case "fas":
      return { re: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, minRatio: 0.45, minChars: 12 };
    case "rus":
      return { re: /[\u0400-\u04FF]/g, minRatio: 0.45, minChars: 12 };
    case "hin":
      return { re: /[\u0900-\u097F]/g, minRatio: 0.45, minChars: 12 };
    case "jpn":
      return { re: /[\u3040-\u30FF\u4E00-\u9FFF]/g, minRatio: 0.35, minChars: 12 };
    case "kor":
      return { re: /[\uAC00-\uD7AF\u1100-\u11FF]/g, minRatio: 0.45, minChars: 12 };
    case "chi_sim":
      return { re: /[\u4E00-\u9FFF]/g, minRatio: 0.35, minChars: 12 };
    case "tha":
      return { re: /[\u0E00-\u0E7F]/g, minRatio: 0.45, minChars: 12 };
    default:
      return null;
  }
}

function tidy(text: string, lang: string): string {
  return normalizeOcrText(text || "", lang)
    .replace(/\r/g, "")
    .split("\n")
    .map((l, index) => cleanOcrLine(l.trimEnd(), lang, index))
    .map((l) => repairLatinOcrWordBreaks(l, lang))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // collapse big gaps to a single paragraph break
    .trim();
}

function normalizeOcrText(text: string, lang: string): string {
  let out = text.replace(/\u0640/g, "");
  if (lang === "fas") {
    out = out
      .replace(/ك/g, "ک")
      .replace(/[يى]/g, "ی")
      .replace(/ة/g, "ه");
  }
  return out;
}

function cleanOcrLine(line: string, lang: string, index: number): string {
  void index;
  if (lang === "fas" || lang === "ara") {
    if (/^[\s\d۰-۹٠-٩]{1,8}$/.test(line)) return "";
    return line.replace(/^[\s\d۰-۹٠-٩]{1,8}(?=[\u0600-\u06FF])/, "");
  }
  return line;
}

function repairLatinOcrWordBreaks(line: string, lang: string): string {
  if (scriptProfile(lang)) return line;
  if (!isMostlyLatinLine(line)) return line;

  let out = line
    .replace(/\b([A-Za-z]{3,})\s+(er|ers|est|ing|ed|ly|ment|ness|tion|tions|sion|ter|der|per|able|ible|ally|ive|ous)\b/g, "$1$2")
    .replace(/\b([A-Za-z]{5,})\s+(al|ic|ical|ity|ies)\b/g, "$1$2");

  for (const word of COMMON_LATIN_OCR_JOIN_WORDS) {
    out = joinKnownWord(out, word);
  }
  return out;
}

function isMostlyLatinLine(line: string): boolean {
  const letters = line.match(/[A-Za-z]/g)?.length ?? 0;
  if (letters < 8) return false;
  const otherScript = line.match(new RegExp(`[${NON_LATIN_SCRIPT_RANGES}]`, "g"))?.length ?? 0;
  return letters > otherScript * 3;
}

const NON_LATIN_SCRIPT_RANGES =
  "\\u0400-\\u04FF" +
  "\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF" +
  "\\u0900-\\u097F" +
  "\\u0E00-\\u0E7F" +
  "\\u3040-\\u30FF\\u3400-\\u9FFF" +
  "\\uAC00-\\uD7AF\\u1100-\\u11FF";

const COMMON_LATIN_OCR_JOIN_WORDS = [
  "apache",
  "helicopter",
  "sniper",
  "overwatch",
  "south-central",
];

function joinKnownWord(line: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (let i = 2; i <= word.length - 2; i++) {
    const left = escaped.slice(0, i);
    const right = escaped.slice(i);
    const re = new RegExp(`\\b(${left})\\s+(${right})\\b`, "gi");
    line = line.replace(re, (_match, a: string, b: string) => `${a}${b}`);
  }
  return line;
}

export { normalizeOcrText };
