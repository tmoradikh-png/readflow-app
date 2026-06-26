import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Bookmark {
  /** Tag/name; unique per document (re-using a name UPDATES, never duplicates). */
  tag: string;
  docId: string;
  fileName: string;
  page: number;
  chunkIndex: number;
  sentenceId: number;
  preview: string;
  updatedAt: number;
}

const KEY_PREFIX = "readflow.bookmarks.";

/**
 * Bookmarks — named reading positions saved per document in AsyncStorage.
 * Saving with an existing tag UPDATES that bookmark instead of creating a dup.
 */
export const Bookmarks = {
  async list(docId: string): Promise<Bookmark[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY_PREFIX + docId);
      const arr: Bookmark[] = raw ? JSON.parse(raw) : [];
      return arr.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  },

  /** Insert or update by tag (case-insensitive match on the same document). */
  async upsert(b: Omit<Bookmark, "updatedAt">): Promise<void> {
    const existing = await this.list(b.docId);
    const tagKey = b.tag.trim().toLowerCase();
    const filtered = existing.filter((x) => x.tag.trim().toLowerCase() !== tagKey);
    filtered.push({ ...b, tag: b.tag.trim(), updatedAt: Date.now() });
    await AsyncStorage.setItem(KEY_PREFIX + b.docId, JSON.stringify(filtered));
  },

  async remove(docId: string, tag: string): Promise<void> {
    const existing = await this.list(docId);
    const tagKey = tag.trim().toLowerCase();
    const filtered = existing.filter((x) => x.tag.trim().toLowerCase() !== tagKey);
    await AsyncStorage.setItem(KEY_PREFIX + docId, JSON.stringify(filtered));
  },
};
