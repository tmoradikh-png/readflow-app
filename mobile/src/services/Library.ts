import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { ParsedPdf } from "./PDFParser";

/**
 * A document the user has opened, shown on the Library "shelf".
 * The original file is copied into the app's PRIVATE sandbox so it can be
 * reopened later without re-picking. Removing an item deletes that copy.
 */
export interface LibraryItem {
  id: string; // === ParsedPdf.docId
  title: string; // display name (file name without extension)
  fileName: string;
  kind: "pdf" | "docx";
  pageCount: number;
  ocrPages: number;
  scanned: boolean;
  /** Persistent copy of the source file in app storage (null if copy failed). */
  storedUri: string | null;
  mimeType: string | null;
  /** Reading progress. */
  lastPage: number;
  lastSentenceId: number;
  progress: number; // 0..1
  addedAt: number;
  updatedAt: number;
}

const KEY = "readflow.library.v1";
const LIB_DIR = (FileSystem.documentDirectory || "") + "library/";

function titleFromFileName(name: string): string {
  return name.replace(/\.(pdf|docx)$/i, "").trim() || name;
}

function safeName(id: string, kind: string): string {
  const base = id.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
  return `${base}.${kind === "docx" ? "docx" : "pdf"}`;
}

async function ensureDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(LIB_DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(LIB_DIR, { intermediates: true });
  } catch {
    /* best effort */
  }
}

async function readAll(): Promise<LibraryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr: LibraryItem[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeAll(items: LibraryItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export const Library = {
  /** Most-recently-opened first. */
  async list(): Promise<LibraryItem[]> {
    const all = await readAll();
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async get(id: string): Promise<LibraryItem | undefined> {
    return (await readAll()).find((x) => x.id === id);
  },

  /**
   * Record a freshly opened document. Copies the source file into the app
   * sandbox (so it reopens later) and upserts its metadata. Returns the item.
   */
  async saveOpened(doc: ParsedPdf, sourceUri?: string, mimeType?: string): Promise<LibraryItem> {
    const all = await readAll();
    const existing = all.find((x) => x.id === doc.docId);

    let storedUri = existing?.storedUri ?? null;
    if (sourceUri) {
      try {
        await ensureDir();
        const dest = LIB_DIR + safeName(doc.docId, doc.kind);
        // Re-copy only if we don't already have it.
        const have = storedUri ? await FileSystem.getInfoAsync(storedUri) : { exists: false };
        if (!have.exists) {
          await FileSystem.copyAsync({ from: sourceUri, to: dest });
          storedUri = dest;
        }
      } catch {
        storedUri = existing?.storedUri ?? null;
      }
    }

    const now = Date.now();
    const item: LibraryItem = {
      id: doc.docId,
      title: titleFromFileName(doc.fileName),
      fileName: doc.fileName,
      kind: doc.kind,
      pageCount: doc.pageCount,
      ocrPages: doc.ocrPages,
      scanned: doc.scanned,
      storedUri,
      mimeType: mimeType ?? existing?.mimeType ?? null,
      lastPage: existing?.lastPage ?? 1,
      lastSentenceId: existing?.lastSentenceId ?? 0,
      progress: existing?.progress ?? 0,
      addedAt: existing?.addedAt ?? now,
      updatedAt: now,
    };

    const next = [item, ...all.filter((x) => x.id !== item.id)];
    await writeAll(next);
    return item;
  },

  /** Persist the latest reading position for a document. */
  async updateProgress(
    id: string,
    info: { lastPage: number; lastSentenceId: number; totalPages: number }
  ): Promise<void> {
    const all = await readAll();
    const idx = all.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const totalPages = Math.max(1, info.totalPages || all[idx].pageCount || 1);
    all[idx] = {
      ...all[idx],
      lastPage: Math.max(1, info.lastPage || 1),
      lastSentenceId: Math.max(0, info.lastSentenceId || 0),
      progress: Math.min(1, Math.max(0, info.lastPage / totalPages)),
      updatedAt: Date.now(),
    };
    await writeAll(all);
  },

  /** Remove an item and delete its stored copy. */
  async remove(id: string): Promise<void> {
    const all = await readAll();
    const item = all.find((x) => x.id === id);
    await writeAll(all.filter((x) => x.id !== id));
    if (item?.storedUri) {
      try {
        await FileSystem.deleteAsync(item.storedUri, { idempotent: true });
      } catch {
        /* ignore */
      }
    }
  },
};
