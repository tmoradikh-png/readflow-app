import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "readflow.reviewerToken.v1";
let cachedToken: string | null = null;

export function getReviewerToken(): string | null {
  return cachedToken;
}

export async function loadReviewerToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = await AsyncStorage.getItem(KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function saveReviewerToken(token: string): Promise<void> {
  cachedToken = token;
  await AsyncStorage.setItem(KEY, token);
}
