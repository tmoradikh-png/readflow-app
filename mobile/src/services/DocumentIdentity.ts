import * as FileSystem from "expo-file-system/legacy";

/**
 * Fingerprint the exact bytes selected by the reader. MD5 is used only as a
 * stable cache identity, not for security. DocumentPicker copies selections to
 * a readable local file, so Android and iOS can calculate this without loading
 * the whole book into JavaScript memory.
 */
export async function fingerprintSourceFile(uri: string): Promise<string | undefined> {
  if (!uri) return undefined;
  try {
    const info = await FileSystem.getInfoAsync(uri, { md5: true });
    if (!info.exists || info.isDirectory || !info.md5) return undefined;
    const md5 = info.md5.toLowerCase().replace(/[^a-f0-9]/g, "");
    return md5.length === 32 ? `md5-${md5}` : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A revised file must never inherit text cached for an older edition merely
 * because both files have the same name and page count. Put the fingerprint at
 * the front so filesystem-safe truncated names retain the unique part.
 */
export function contentDocumentId(
  fileName: string,
  pageCount: number,
  sourceFingerprint?: string
): string {
  const fingerprint = String(sourceFingerprint || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);
  return fingerprint
    ? `rf2:${fingerprint}:${fileName}:${pageCount}`
    : `${fileName}:${pageCount}`;
}
