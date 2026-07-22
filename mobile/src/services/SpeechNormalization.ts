/** Text repairs used only for the downloaded English rF AI voice model. */
export function normalizeLocalSpeechText(value: string): string {
  const typography = (value || "")
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    // Preserve the em dash as a local speech clause boundary below. Other dash
    // forms remain ordinary hyphens, including numeric ranges.
    .replace(/[‐‑‒–―]/g, "-")
    .replace(/[…]/g, "...");
  return normalizeEnglishNumbersForSpeech(typography)
    .replace(/&/g, " and ")
    .replace(/%/g, " percent ")
    .replace(/\bAI\b/g, "A I")
    .replace(/\bOCR\b/g, "O C R")
    .replace(/\bPDF\b/g, "P D F")
    .replace(/\bDr\./g, "Doctor")
    .replace(/\bMr\./g, "Mister")
    .replace(/\bMrs\./g, "Missus")
    .replace(/\bMs\./g, "Miss")
    .replace(/\bProf\./g, "Professor")
    // Initialisms are words/letters, not punctuation instructions. This also
    // prevents a model from literally saying "dot" for forms such as U.S.
    .replace(/\b(?:[A-Za-z]\.){2,}/g, (match) => match.replace(/\./g, " "))
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * Make compact Roman-numeral headings unambiguous to speech engines. This is
 * deliberately heading-only so an ordinary first-person "I" is never changed.
 */
export function normalizeHeadingForSpeech(value: string): string {
  const text = (value || "").trim();
  if (!text) return text;

  const standalone = text.match(/^([IVXLCDM]+)$/i);
  if (standalone) {
    const number = romanNumeralValue(standalone[1]);
    return number === null ? text : String(number);
  }

  const marker = text.match(
    /^(chapter|part|book|section|volume|act|scene|canto)\s+([IVXLCDM]+)(\b.*)$/i
  );
  if (!marker) return text;
  const number = romanNumeralValue(marker[2]);
  return number === null ? text : `${marker[1]} ${number}${marker[3]}`;
}

function romanNumeralValue(value: string): number | null {
  const roman = value.toUpperCase();
  if (!/^(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(roman)) {
    return null;
  }

  const values: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  let total = 0;
  for (let index = 0; index < roman.length; index++) {
    const current = values[roman[index]];
    const next = values[roman[index + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total > 0 ? total : null;
}

const SMALL_NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;
const TENS_NUMBER_WORDS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
] as const;
const LARGE_NUMBER_SCALES = ["", "thousand", "million", "billion", "trillion", "quadrillion"];
const DIGIT_WORDS: Record<string, string> = {
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
};

/**
 * Supertonic is trained primarily on words and is unreliable with longer
 * numeric glyph runs. Convert English reading numbers generically before local
 * synthesis. This is speech-only: displayed/copy/AI text remains byte-for-byte
 * source prose.
 */
export function normalizeEnglishNumbersForSpeech(value: string): string {
  let text = value || "";

  // Currency with an optional magnitude is one semantic unit. In particular,
  // `$1.12 billion` must become `one point one two billion dollars`, never a
  // disconnected symbol, decimal, and scale word.
  text = text.replace(
    /([$£€])\s*(-?\d[\d,]*(?:\.\d+)?)(?:\s*(thousand|million|billion|trillion|mil|bn|[kmb]))?\b/gi,
    (_match, symbol: string, amount: string, rawScale?: string) =>
      currencyToWords(symbol, amount, rawScale)
  );

  text = text.replace(
    /\b(-?\d[\d,]*(?:\.\d+)?)\s+(thousand|million|billion|trillion|mil|bn)\b/gi,
    (_match, amount: string, rawScale: string) =>
      `${decimalNumberToWords(amount)} ${normalizeMagnitude(rawScale)}`
  );

  // ISO dates are handled before ordinary ranges so neither hyphen is mistaken
  // for a subtraction/negative sign.
  text = text.replace(
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
    (_match, year: string, month: string, day: string) => {
      const monthName = [
        "",
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ][Number(month)];
      if (!monthName || Number(day) < 1 || Number(day) > 31) return _match;
      return `${monthName} ${integerToOrdinalWords(day)}, ${integerNumberToWords(year)}`;
    }
  );

  text = text.replace(
    /\b(\d[\d,]*(?:\.\d+)?)\s*-\s*(\d[\d,]*(?:\.\d+)?)\b/g,
    (_match, start: string, end: string) =>
      `${decimalNumberToWords(start)} to ${decimalNumberToWords(end)}`
  );
  text = text.replace(
    /\b(\d{1,6}):(\d{1,6})\b/g,
    (_match, left: string, right: string) =>
      `${integerNumberToWords(left)} ${integerNumberToWords(right)}`
  );
  text = text.replace(
    /\b(-?\d[\d,]*(?:\.\d+)?)\s*%/g,
    (_match, amount: string) => `${decimalNumberToWords(amount)} percent`
  );
  text = text.replace(
    /\b(\d[\d,]*)(?:st|nd|rd|th)\b/gi,
    (_match, amount: string) => integerToOrdinalWords(amount)
  );

  // Do not touch letters-and-digits identifiers (CO2, MP3) or dotted versions
  // such as 1.0.41. The captured prefix avoids a lookbehind requirement on
  // older Hermes runtimes.
  text = text.replace(
    /(^|[^A-Za-z0-9.])(-?\d[\d,]*(?:\.\d+)?)(?![A-Za-z0-9]|\.\d)/g,
    (_match, prefix: string, amount: string) => `${prefix}${decimalNumberToWords(amount)}`
  );
  return text;
}

function currencyToWords(symbol: string, rawAmount: string, rawScale?: string): string {
  const currency = symbol === "£" ? "pound" : symbol === "€" ? "euro" : "dollar";
  const scale = rawScale ? normalizeMagnitude(rawScale) : "";
  if (scale) return `${decimalNumberToWords(rawAmount)} ${scale} ${currency}s`;

  const negative = rawAmount.startsWith("-");
  const unsigned = rawAmount.replace(/^-/, "").replace(/,/g, "");
  const [wholeRaw, fractionRaw = ""] = unsigned.split(".");
  if (fractionRaw.length <= 2 && fractionRaw) {
    const cents = Number(fractionRaw.padEnd(2, "0"));
    const whole = Number(wholeRaw || "0");
    const sign = negative ? "minus " : "";
    const wholePhrase = whole
      ? `${integerNumberToWords(wholeRaw)} ${currency}${whole === 1 ? "" : "s"}`
      : "";
    const centPhrase = cents
      ? `${integerNumberToWords(String(cents))} cent${cents === 1 ? "" : "s"}`
      : "";
    if (wholePhrase && centPhrase) return `${sign}${wholePhrase} and ${centPhrase}`;
    if (wholePhrase) return `${sign}${wholePhrase}`;
    if (centPhrase) return `${sign}${centPhrase}`;
  }

  const exactOne = !negative && /^1(?:\.0+)?$/.test(unsigned);
  return `${decimalNumberToWords(rawAmount)} ${currency}${exactOne ? "" : "s"}`;
}

function normalizeMagnitude(value: string): string {
  const scale = value.toLowerCase();
  if (scale === "k") return "thousand";
  if (scale === "m" || scale === "mil") return "million";
  if (scale === "b" || scale === "bn") return "billion";
  return scale;
}

function decimalNumberToWords(rawValue: string): string {
  const negative = rawValue.startsWith("-");
  const normalized = rawValue.replace(/^-/, "").replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return rawValue;
  const [whole, fraction] = normalized.split(".");
  const sign = negative ? "minus " : "";
  if (!fraction) return `${sign}${integerNumberToWords(whole)}`;
  return `${sign}${integerNumberToWords(whole)} point ${fraction
    .split("")
    .map((digit) => DIGIT_WORDS[digit])
    .join(" ")}`;
}

function integerNumberToWords(rawDigits: string): string {
  const digits = rawDigits.replace(/,/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return rawDigits;
  if (digits.length > 1 && digits.startsWith("0")) {
    return digits.split("").map((digit) => DIGIT_WORDS[digit]).join(" ");
  }
  const compact = digits.replace(/^0+(?=\d)/, "");
  if (compact.length > LARGE_NUMBER_SCALES.length * 3) {
    return compact.split("").map((digit) => DIGIT_WORDS[digit]).join(" ");
  }

  const groups: string[] = [];
  for (let end = compact.length; end > 0; end -= 3) {
    groups.unshift(compact.slice(Math.max(0, end - 3), end));
  }
  const words: string[] = [];
  for (let index = 0; index < groups.length; index++) {
    const amount = Number(groups[index]);
    if (!amount) continue;
    const scaleIndex = groups.length - index - 1;
    words.push(underThousandToWords(amount));
    if (LARGE_NUMBER_SCALES[scaleIndex]) words.push(LARGE_NUMBER_SCALES[scaleIndex]);
  }
  return words.join(" ") || "zero";
}

function underThousandToWords(value: number): string {
  const words: string[] = [];
  let remainder = Math.max(0, Math.min(999, Math.floor(value)));
  if (remainder >= 100) {
    words.push(SMALL_NUMBER_WORDS[Math.floor(remainder / 100)], "hundred");
    remainder %= 100;
  }
  if (remainder >= 20) {
    words.push(TENS_NUMBER_WORDS[Math.floor(remainder / 10)]);
    remainder %= 10;
  }
  if (remainder > 0) words.push(SMALL_NUMBER_WORDS[remainder]);
  return words.join(" ");
}

function integerToOrdinalWords(rawDigits: string): string {
  const cardinal = integerNumberToWords(rawDigits);
  const words = cardinal.split(" ");
  const last = words.pop() || "zero";
  const irregular: Record<string, string> = {
    zero: "zeroth",
    one: "first",
    two: "second",
    three: "third",
    four: "fourth",
    five: "fifth",
    eight: "eighth",
    nine: "ninth",
    twelve: "twelfth",
    twenty: "twentieth",
    thirty: "thirtieth",
    forty: "fortieth",
    fifty: "fiftieth",
    sixty: "sixtieth",
    seventy: "seventieth",
    eighty: "eightieth",
    ninety: "ninetieth",
    hundred: "hundredth",
    thousand: "thousandth",
    million: "millionth",
    billion: "billionth",
    trillion: "trillionth",
    quadrillion: "quadrillionth",
  };
  words.push(irregular[last] || `${last}th`);
  return words.join(" ");
}

export interface LocalSpeechSegment {
  /** Punctuation-safe words sent to Supertonic. */
  text: string;
  /** Deterministic silence stitched after this segment. */
  pauseAfterMs: number;
}

const NON_TERMINAL_ABBREVIATIONS = new Set([
  "dr",
  "mr",
  "mrs",
  "ms",
  "prof",
  "sr",
  "jr",
  "st",
  "no",
  "fig",
  "eq",
  "vol",
  "vs",
]);
const LOCAL_CLAUSE_TARGET_CHARS = 150;
const LOCAL_CLAUSE_MIN_CHARS = 55;
const LOCAL_COMMA_PAUSE_MS = 85;

/**
 * Build punctuation-free sentence/clause renders for rF AI. Supertonic has
 * occasionally verbalized a terminal period and applies inconsistent silence
 * to punctuation inside a long paragraph. We remove only true boundaries from
 * the model input and later stitch fixed PCM silence between the generated
 * pieces. The provider plays those pieces continuously and can begin with the
 * first sentence while the remaining sentence audio is still being rendered.
 */
export function buildLocalSpeechSegments(value: string): LocalSpeechSegment[] {
  const text = normalizeLocalSpeechText(value);
  if (!text) return [];

  const segments: LocalSpeechSegment[] = [];
  // Contents and index pages commonly use an em dash between entries without
  // surrounding spaces. Treat it as a short clause boundary so Supertonic does
  // not receive one huge unpunctuated request. En dashes remain untouched for
  // numeric ranges such as 1750-1760.
  const boundary = /([.!?;:]+)(["']?)(?=\s|$)|([\u2014]+)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = boundary.exec(text)) !== null) {
    const marks = match[1] || match[3];
    if (marks === "." && isNonTerminalPeriod(text, match.index, boundary.lastIndex)) continue;

    const spoken = text.slice(cursor, match.index).trim();
    if (spoken) {
      appendResponsiveSpeechSegments(segments, spoken, pauseForBoundary(marks));
    }
    cursor = boundary.lastIndex;
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
  }

  const tail = text.slice(cursor).trim();
  if (tail) appendResponsiveSpeechSegments(segments, tail, 0);
  return segments.length ? segments : [{ text, pauseAfterMs: 0 }];
}

function appendResponsiveSpeechSegments(
  target: LocalSpeechSegment[],
  value: string,
  finalPauseMs: number
) {
  let start = 0;
  while (value.length - start > LOCAL_CLAUSE_TARGET_CHARS) {
    const preferredEnd = start + LOCAL_CLAUSE_TARGET_CHARS;
    const minimumEnd = start + LOCAL_CLAUSE_MIN_CHARS;
    let comma = value.lastIndexOf(",", preferredEnd);
    if (comma < minimumEnd) {
      const following = value.indexOf(",", preferredEnd);
      comma = following >= minimumEnd && following - start <= 190 ? following : -1;
    }
    if (comma < minimumEnd) break;

    const clause = value.slice(start, comma).trim();
    if (clause) target.push({ text: clause, pauseAfterMs: LOCAL_COMMA_PAUSE_MS });
    start = comma + 1;
    while (start < value.length && /\s/.test(value[start])) start++;
  }

  const tail = value.slice(start).trim();
  if (tail) target.push({ text: tail, pauseAfterMs: finalPauseMs });
}

function pauseForBoundary(marks: string): number {
  if (marks.includes("\u2014")) return 90;
  if (marks.includes("?") || marks.includes("!")) return 340;
  if (marks.includes(".")) return 300;
  if (marks.includes(";")) return 190;
  return 150;
}

function isNonTerminalPeriod(text: string, periodIndex: number, matchEnd: number): boolean {
  const prefix = text.slice(Math.max(0, periodIndex - 24), periodIndex + 1);
  const token = prefix.match(/([A-Za-z][A-Za-z.]*)\.$/)?.[1]?.toLowerCase() || "";
  if (NON_TERMINAL_ABBREVIATIONS.has(token)) return true;
  if (/(?:\b[A-Za-z]\.){2,}$/.test(prefix) || /\b[A-Z]\.$/.test(prefix)) return true;

  const next = text.slice(matchEnd).match(/\S/)?.[0];
  return Boolean(next && /[a-z\u00df-\u024f]/.test(next));
}
