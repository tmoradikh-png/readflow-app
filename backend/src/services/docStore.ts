import crypto from "crypto";

/**
 * Short-lived in-memory store for uploaded PDF buffers.
 *
 * Lets the client open a document instantly (native text only) and then OCR the
 * pages it actually views, on demand, without re-uploading the whole file. The
 * buffer is dropped after a TTL or when the store is full (LRU), so memory stays
 * bounded and we never persist the user's document.
 */

interface Entry {
  buffer: Buffer;
  expires: number;
}

const TTL_MS = Number(process.env.DOC_STORE_TTL_MS || 45 * 60_000); // 45 min
const MAX_DOCS = Number(process.env.DOC_STORE_MAX || 8);

const store = new Map<string, Entry>();

function prune() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expires <= now) store.delete(k);
  }
  while (store.size > MAX_DOCS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** Store a buffer and return an opaque token the client uses for on-demand OCR. */
export function putDoc(buffer: Buffer): string {
  prune();
  const token = crypto.randomBytes(16).toString("hex");
  store.set(token, { buffer, expires: Date.now() + TTL_MS });
  return token;
}

/** Retrieve a stored buffer (refreshing its TTL), or null if missing/expired. */
export function getDoc(token: string): Buffer | null {
  const e = store.get(token);
  if (!e) return null;
  if (e.expires <= Date.now()) {
    store.delete(token);
    return null;
  }
  e.expires = Date.now() + TTL_MS;
  // refresh LRU order
  store.delete(token);
  store.set(token, e);
  return e.buffer;
}
