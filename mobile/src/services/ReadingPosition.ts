import type { Sentence } from "./TextReflow";

export interface ReadingPosition {
  page: number;
  pageSentenceIndex: number;
  sentenceId: number;
  preview: string;
}

export function positionForSentence(sentence: Sentence): ReadingPosition {
  return {
    page: sentence.page,
    pageSentenceIndex: sentence.pageSentenceIndex,
    sentenceId: sentence.id,
    preview: sentence.text.slice(0, 80),
  };
}

export function resolveReadingPosition(
  sentences: Sentence[],
  position: Partial<ReadingPosition> | null | undefined
): number {
  if (!sentences.length) return 0;
  if (!position) return 0;

  const page = Math.max(1, Number(position.page) || 1);
  const onPage = sentences.filter((sentence) => sentence.page === page);
  if (onPage.length) {
    const preview = normalizePreview(position.preview || "");
    if (preview) {
      const previewMatch = onPage.find((sentence) => {
        const candidate = normalizePreview(sentence.text);
        return candidate.startsWith(preview) || preview.startsWith(candidate.slice(0, 32));
      });
      if (previewMatch) return previewMatch.id;
    }

    const within = Number(position.pageSentenceIndex);
    if (Number.isFinite(within)) {
      return onPage[Math.min(Math.max(0, Math.round(within)), onPage.length - 1)].id;
    }

    return onPage[0].id;
  }

  const legacyId = Number(position.sentenceId);
  if (Number.isFinite(legacyId)) {
    return Math.min(Math.max(0, Math.round(legacyId)), sentences.length - 1);
  }

  const nextPage = sentences.find((sentence) => sentence.page > page);
  return nextPage?.id ?? sentences[sentences.length - 1].id;
}

function normalizePreview(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim().slice(0, 64);
}
