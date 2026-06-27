import * as DocumentPicker from "expo-document-picker";
import { API_BASE, apiHeaders } from "../config";

export interface PdfPage {
  page: number;
  text: string;
  /** Where the text came from: PDF text layer or OCR. */
  source?: "native" | "ocr";
  /** OCR confidence 0–100 (OCR pages only). */
  confidence?: number;
}

export interface ParsedPdf {
  pageCount: number;
  pages: PdfPage[];
  scanned: boolean;
  fileName: string;
  kind: "pdf" | "docx";
  /** Number of pages recovered via OCR. */
  ocrPages: number;
  /** Stable id for this document, used to key bookmarks. */
  docId: string;
  /** Local URI of the picked/stored source file (used by the Library). */
  sourceUri?: string;
  /** MIME type of the source file, if known. */
  mimeType?: string;
  /** Short-lived server token for on-demand OCR of remaining pages. */
  docToken?: string;
  /** Page numbers still needing OCR (fetched lazily as the reader views them). */
  pendingOcr?: number[];
  /** True when the backend detected scanned content that requires paid OCR. */
  needsPaidOcr?: boolean;
}

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * PDFParser — picks a PDF or Word (.docx) file and sends it to the backend for
 * per-page text extraction. (Reflow/sentence-splitting is done on-device by
 * TextReflow so layout adapts to the chosen font size and screen width.)
 */
export const PDFParser = {
  async pickAndParse(opts?: { ocrLang?: string }): Promise<ParsedPdf | null> {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", DOCX_TYPE],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (picked.canceled || !picked.assets?.length) return null;
    const asset = picked.assets[0];
    return PDFParser.parseUri({
      uri: asset.uri,
      fileName: asset.name || "document",
      mimeType: asset.mimeType || "application/octet-stream",
      ocrLang: opts?.ocrLang,
    });
  },

  /** Parse a file already on disk (e.g. a stored Library document being reopened). */
  async parseUri(args: {
    uri: string;
    fileName: string;
    mimeType?: string;
    ocrLang?: string;
  }): Promise<ParsedPdf> {
    const form = new FormData();
    // React Native FormData file shape:
    form.append("file", {
      uri: args.uri,
      name: args.fileName || "document",
      type: args.mimeType || "application/octet-stream",
    } as any);
    // Optional OCR language hint (backend validates against its allow-list).
    if (args.ocrLang) form.append("ocrLang", args.ocrLang);

    const res = await fetch(`${API_BASE}/api/pdf/extract`, {
      method: "POST",
      headers: apiHeaders(),
      body: form,
    });

    if (!res.ok) {
      const msg = await safeError(res);
      throw new Error(msg);
    }

    const data = await res.json();
    const fileName = args.fileName || "document";
    return {
      pageCount: data.pageCount,
      pages: data.pages,
      scanned: Boolean(data.scanned),
      fileName,
      kind: data.kind === "docx" ? "docx" : "pdf",
      ocrPages: Number(data.ocrPages || 0),
      docId: `${fileName}:${data.pageCount}`,
      sourceUri: args.uri,
      mimeType: args.mimeType,
      docToken: typeof data.docToken === "string" ? data.docToken : undefined,
      pendingOcr: Array.isArray(data.pendingOcr) ? data.pendingOcr : [],
      needsPaidOcr: Boolean(data.needsPaidOcr),
    };
  },

  /** OCR specific pages of an already-uploaded document, on demand. */
  async ocrPages(
    docToken: string,
    pages: number[],
    ocrLang?: string
  ): Promise<{ page: number; text: string; confidence?: number }[]> {
    const res = await fetch(`${API_BASE}/api/pdf/ocr`, {
      method: "POST",
      headers: apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ docToken, pages, ocrLang }),
    });
    if (!res.ok) throw new Error(await safeError(res));
    const data = await res.json();
    return Array.isArray(data.pages) ? data.pages : [];
  },
};

async function safeError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j.error || `Upload failed (${res.status})`;
  } catch {
    return `Upload failed (${res.status})`;
  }
}

/**
 * True when an error looks like a lost/absent network connection (airplane
 * mode, no Wi-Fi) rather than a server response. `fetch` throws a TypeError
 * ("Network request failed") in that case, so callers can fall back to the
 * offline cache instead of showing a scary error.
 */
export function isNetworkError(e: unknown): boolean {
  const msg = (e as any)?.message ? String((e as any).message) : "";
  return (
    e instanceof TypeError ||
    /network request failed|network error|failed to fetch|timeout|timed out/i.test(msg)
  );
}
