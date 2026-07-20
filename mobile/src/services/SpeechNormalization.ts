/** Text repairs used only for the downloaded English rF AI voice model. */
export function normalizeLocalSpeechText(value: string): string {
  return (value || "")
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[…]/g, "...")
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
    // Supertonic can reduce these auxiliary pairs until they are inaudible at
    // normal reading speed. A light comma keeps both words clear.
    .replace(/\b(would|could|should|might|must)\s+have\b/gi, "$1, have")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}
