import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "readflow.localVoiceUsage.v1";

interface StoredUsage {
  day: string;
  seconds: number;
}

function localDay(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getLocalVoiceSecondsToday(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredUsage>) : null;
    if (!parsed || parsed.day !== localDay()) return 0;
    return Math.max(0, Math.floor(Number(parsed.seconds) || 0));
  } catch {
    return 0;
  }
}

export async function addLocalVoiceSeconds(seconds: number): Promise<number> {
  const amount = Math.max(0, Math.floor(seconds));
  if (!amount) return getLocalVoiceSecondsToday();
  const current = await getLocalVoiceSecondsToday();
  const next = current + amount;
  await AsyncStorage.setItem(KEY, JSON.stringify({ day: localDay(), seconds: next }));
  return next;
}

export function formatLocalVoiceRemaining(limitSeconds: number, usedSeconds: number): string {
  if (limitSeconds <= 0) return "Unlimited";
  const remaining = Math.max(0, limitSeconds - usedSeconds);
  const minutes = Math.ceil(remaining / 60);
  return `${minutes} min left today`;
}
