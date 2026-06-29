import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeReadingLanguageCode } from "./ReadingLanguages";

export type VoiceEngine = "device" | "cloud" | "local_ai";

export interface ReadingPreferences {
  voiceEngine: VoiceEngine;
  deviceVoiceId?: string;
  cloudVoiceId: string;
  bookLanguage: string;
}

const KEY = "readflow.preferences.v1";

export const DEFAULT_PREFERENCES: ReadingPreferences = {
  voiceEngine: "device",
  cloudVoiceId: "nova",
  bookLanguage: "en",
};

export async function loadPreferences(): Promise<ReadingPreferences> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<ReadingPreferences>;
    return normalizePreferences(parsed);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(next: ReadingPreferences): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(normalizePreferences(next)));
}

export function normalizePreferences(
  value: Partial<ReadingPreferences> | null | undefined
): ReadingPreferences {
  const voiceEngine =
    value?.voiceEngine === "cloud" || value?.voiceEngine === "local_ai"
      ? value.voiceEngine
      : "device";
  const cloudVoiceId =
    typeof value?.cloudVoiceId === "string" && value.cloudVoiceId.trim()
      ? value.cloudVoiceId.trim()
      : "nova";
  const deviceVoiceId =
    typeof value?.deviceVoiceId === "string" && value.deviceVoiceId.trim()
      ? value.deviceVoiceId.trim()
      : undefined;
  const bookLanguage = normalizeReadingLanguageCode(value?.bookLanguage);
  return { voiceEngine, cloudVoiceId, deviceVoiceId, bookLanguage };
}
