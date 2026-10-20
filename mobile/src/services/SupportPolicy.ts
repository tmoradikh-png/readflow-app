export const DAY_MS = 24 * 60 * 60 * 1000;
export interface SupportState {
  firstSeen: number;
  lastVisitDay: number;
  visits: number;
  nextPrompt: number;
  neverAsk: boolean;
}

export function visitSupport(state: SupportState | null, now: number): SupportState {
  const day = Math.floor(now / DAY_MS);
  if (!state) return { firstSeen: now, lastVisitDay: day, visits: 1, nextPrompt: now + 7 * DAY_MS, neverAsk: false };
  return { ...state, visits: state.visits + (day > state.lastVisitDay ? 1 : 0), lastVisitDay: Math.max(day, state.lastVisitDay) };
}

export function shouldOfferSupport(state: SupportState, now: number, lastSupport: number): boolean {
  return !state.neverAsk && state.visits >= 3 && now >= state.nextPrompt &&
    now >= state.firstSeen + 7 * DAY_MS && (!lastSupport || now >= lastSupport + 180 * DAY_MS);
}

export function dismissSupport(state: SupportState | null, now: number, neverAsk = false): SupportState {
  const current = state || visitSupport(null, now);
  return { ...current, nextPrompt: now + 30 * DAY_MS, neverAsk: neverAsk || current.neverAsk };
}
