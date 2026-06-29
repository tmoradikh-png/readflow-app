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
  /** OCR language used when extracting this cached document. */
  ocrLang?: string;
  /** Short-lived server token for on-demand OCR of remaining pages. */
  docToken?: string;
  /** Page numbers still needing OCR (fetched lazily as the reader views them). */
  pendingOcr?: number[];
  /** True when the backend detected scanned content that requires paid OCR. */
  needsPaidOcr?: boolean;
  /** True when backend returned only the plan-allowed leading pages. */
  truncated?: boolean;
  /** Highest page returned for this plan when truncated. */
  pageCap?: number;
  /** True when this document was rebuilt from page images instead of native text. */
  forceOcr?: boolean;
}

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * PDFParser — picks a PDF or Word (.docx) file and sends it to the backend for
 * per-page text extraction. (Reflow/sentence-splitting is done on-device by
 * TextReflow so layout adapts to the chosen font size and screen width.)
 */
/** Reports upload progress (real bytes) and the upload→processing handoff. */
export interface ImportProgressHooks {
  onProgress?: (loaded: number, total: number) => void;
  /** Fired once the file bytes are fully uploaded and the server starts work. */
  onUploaded?: () => void;
}

export const PDFParser = {
  async pickAndParse(
    opts?: { ocrLang?: string; forceOcr?: boolean } & ImportProgressHooks
  ): Promise<ParsedPdf | null> {
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
      forceOcr: opts?.forceOcr,
      onProgress: opts?.onProgress,
      onUploaded: opts?.onUploaded,
    });
  },

  /** Parse a file already on disk (e.g. a stored Library document being reopened). */
  async parseUri(args: {
    uri: string;
    fileName: string;
    mimeType?: string;
    ocrLang?: string;
    forceOcr?: boolean;
  } & ImportProgressHooks): Promise<ParsedPdf> {
    const form = new FormData();
    // React Native FormData file shape:
    form.append("file", {
      uri: args.uri,
      name: args.fileName || "document",
      type: args.mimeType || "application/octet-stream",
    } as any);
    // Optional OCR language hint (backend validates against its allow-list).
    if (args.ocrLang) form.append("ocrLang", args.ocrLang);
    if (args.forceOcr) form.append("forceOcr", "true");

    // Use XHR (not fetch) so we get real upload-byte progress for the UI.
    const data = await uploadForm(
      `${API_BASE}/api/pdf/extract`,
      form,
      apiHeaders(),
      args.onProgress,
      args.onUploaded
    );
    if (args.forceOcr && !data.forceOcr) {
      throw new Error(
        "OCR rebuild is not active on the document server yet. Deploy the latest readFlow backend, then try Fix text again."
      );
    }
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
      ocrLang: args.ocrLang,
      docToken: typeof data.docToken === "string" ? data.docToken : undefined,
      pendingOcr: Array.isArray(data.pendingOcr) ? data.pendingOcr : [],
      needsPaidOcr: Boolean(data.needsPaidOcr),
      truncated: Boolean(data.truncated),
      pageCap: Number.isFinite(Number(data.pageCap)) ? Number(data.pageCap) : undefined,
      forceOcr: Boolean(data.forceOcr),
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
    if (!res.ok) throw await responseError(res);
    const data = await res.json();
    return Array.isArray(data.pages) ? data.pages : [];
  },
};

/**
 * POST a multipart form with real upload progress. `fetch` can't report upload
 * bytes in React Native, but XMLHttpRequest exposes `upload.onprogress`.
 * Do NOT set Content-Type — the engine adds the multipart boundary itself.
 */
function uploadForm(
  url: string,
  form: FormData,
  headers: Record<string, string>,
  onProgress?: (loaded: number, total: number) => void,
  onUploaded?: () => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    if (xhr.upload) {
      xhr.upload.onprogress = (e: any) => {
        if (e && e.lengthComputable) onProgress?.(e.loaded, e.total);
      };
      xhr.upload.onload = () => onUploaded?.();
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("The server returned an unexpected response."));
        }
      } else {
        let msg = `Upload failed (${xhr.status}).`;
        try {
          const j = JSON.parse(xhr.responseText);
          if (j?.error) msg = String(j.error);
        } catch {
          /* keep default */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("The upload timed out. Please try again."));
    xhr.send(form as any);
  });
}

async function safeError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j.error || `Upload failed (${res.status})`;
  } catch {
    return `Upload failed (${res.status})`;
  }
}

async function responseError(res: Response): Promise<Error> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* keep null */
  }
  const code = String(body?.error || `http_${res.status}`);
  const message = String(body?.message || body?.error || `Request failed (${res.status}).`);
  return Object.assign(new Error(message), {
    code,
    status: res.status,
    feature: typeof body?.feature === "string" ? body.feature : undefined,
  });
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

/** True when the app is pointed at a developer machine instead of hosted Render. */
export function isLocalBackendTarget(): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(
    API_BASE
  );
}

export function apiErrorCode(e: unknown): string {
  return String((e as any)?.code || (e as any)?.message || "");
}

export function isQuotaError(e: unknown): boolean {
  return /quota_exceeded/i.test(apiErrorCode(e));
}

export function isExpiredDocError(e: unknown): boolean {
  return /doc_expired/i.test(apiErrorCode(e));
}
