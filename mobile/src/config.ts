import Constants from "expo-constants";
import { getAppUserId } from "./services/AppIdentity";

/**
 * Backend base URL.
 *
 * In Expo dev, the phone cannot reach "localhost" (that's the phone itself).
 * We auto-detect your computer's LAN IP from the Expo dev server host,
 * then point at port 4000 where the backend runs.
 *
 * For a real build, set API_BASE to your deployed backend URL.
 */
const BACKEND_PORT = 4000;

function detectDevHost(): string | null {
  // e.g. "192.168.1.20:8081"
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost;
  if (!hostUri) return null;
  const host = String(hostUri).split(":")[0];
  return host || null;
}

/**
 * Production backend URL. Set this before building a release (.aab/.ipa):
 *   - via app.json  -> expo.extra.apiUrl, or
 *   - via env var   -> EXPO_PUBLIC_API_URL
 * It MUST be HTTPS (Android blocks cleartext HTTP in release builds).
 */
const prodApiUrl: string =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ||
  ((Constants.expoConfig as any)?.extra?.apiUrl as string | undefined) ||
  "";

const devHost = detectDevHost();

export const API_BASE = prodApiUrl
  ? prodApiUrl.replace(/\/+$/, "") // deployed backend (release builds)
  : devHost
    ? `http://${devHost}:${BACKEND_PORT}` // Expo dev on LAN
    : "http://localhost:4000"; // last-resort dev fallback

/**
 * Shared app key sent on every backend request (x-app-key header) so the public
 * backend isn't open for anyone to spend our OpenAI credit. Set it the same way
 * as the API url: app.json -> expo.extra.appKey, or EXPO_PUBLIC_APP_KEY.
 * If empty (e.g. local dev), no header is sent and the backend allows it.
 */
export const APP_KEY: string =
  (process.env.EXPO_PUBLIC_APP_KEY as string | undefined) ||
  ((Constants.expoConfig as any)?.extra?.appKey as string | undefined) ||
  "";

/**
 * RevenueCat public SDK keys. These are safe to ship in the app, but they are
 * still environment-driven so release builds can be prepared without committing
 * account-specific dashboard values.
 */
export const REVENUECAT_ANDROID_API_KEY: string =
  (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY as string | undefined) ||
  ((Constants.expoConfig as any)?.extra?.revenueCatAndroidApiKey as string | undefined) ||
  "";

export const REVENUECAT_IOS_API_KEY: string =
  (process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY as string | undefined) ||
  ((Constants.expoConfig as any)?.extra?.revenueCatIosApiKey as string | undefined) ||
  "";

/** Merge the app-key header into any request headers. */
export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...(extra || {}) };
  if (APP_KEY) h["x-app-key"] = APP_KEY;
  const appUserId = getAppUserId();
  if (appUserId) h["x-app-user-id"] = appUserId;
  return h;
}
