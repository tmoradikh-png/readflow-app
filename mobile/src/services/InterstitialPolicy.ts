export type AdHistory = { day: string; count: number; lastShown: number };
export const MIN_READING_MS = 10 * 60 * 1000;
export const MIN_AD_GAP_MS = 20 * 60 * 1000;
export const MAX_ADS_PER_DAY = 2;
export function canShowBookCloseAd(history: AdHistory, now: number, readingMs: number): boolean {
  const today = new Date(now).toISOString().slice(0, 10);
  return Number.isFinite(readingMs) && readingMs >= MIN_READING_MS
    && Number.isFinite(history.lastShown) && now >= history.lastShown
    && now - history.lastShown >= MIN_AD_GAP_MS
    && Number.isInteger(history.count) && history.count >= 0
    && (history.day !== today || history.count < MAX_ADS_PER_DAY);
}
export function recordBookCloseAd(history: AdHistory, now: number): AdHistory {
  const day = new Date(now).toISOString().slice(0, 10);
  return { day, lastShown: now, count: history.day === day ? history.count + 1 : 1 };
}
