import AsyncStorage from "@react-native-async-storage/async-storage";

const APP_USER_ID_KEY = "readflow:appUserId";
const APP_USER_ID_RE = /^rf_[A-Za-z0-9_-]{18,80}$/;

let cachedAppUserId: string | null = null;

function randomPart(): string {
  return Math.random().toString(36).slice(2, 12);
}

function createAppUserId(): string {
  return `rf_${Date.now().toString(36)}_${randomPart()}_${randomPart()}`;
}

export function getAppUserId(): string | null {
  return cachedAppUserId;
}

export async function loadAppUserId(): Promise<string> {
  if (cachedAppUserId) return cachedAppUserId;

  try {
    const existing = await AsyncStorage.getItem(APP_USER_ID_KEY);
    if (existing && APP_USER_ID_RE.test(existing)) {
      cachedAppUserId = existing;
      return existing;
    }
  } catch {
    /* fall through and create a fresh id */
  }

  const next = createAppUserId();
  cachedAppUserId = next;
  try {
    await AsyncStorage.setItem(APP_USER_ID_KEY, next);
  } catch {
    /* keep the in-memory id for this session */
  }
  return next;
}
