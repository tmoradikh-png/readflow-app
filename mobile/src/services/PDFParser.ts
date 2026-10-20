import * as DocumentPicker from "expo-document-picker";
import { NativeModules, Platform } from "react-native";
import { contentDocumentId, fingerprintSourceFile } from "./DocumentIdentity";
import { renderPdfTextItemsWithLayout } from "./offline/PdfLayout";
import { needsOcr, normalizeOcrText, resolveOcrLang } from "./offline/OcrText";

export interface PdfPage {
  page: number;
  text: string;
  source?: "native" | "ocr";
  confidence?: number;
  hasRasterImage?: boolean;
  footnoteStartLine?: number;
}

export interface ParsedPdf {
  pageCount: number;
  pages: PdfPage[];
  scanned: boolean;
  fileName: string;
  kind: "pdf" | "docx";
  ocrPages: number;
  docId: string;
  sourceFingerprint?: string;
  sourceUri?: string;
  mimeType?: string;
  ocrLang?: string;
  /** Local source URI for resumed OCR; retained field name for old caches. */
  docToken?: string;
  pendingOcr?: number[];
  needsPaidOcr?: boolean;
  truncated?: boolean;
  pageCap?: number;
  forceOcr?: boolean;
}

export interface ImportProgressHooks {
  /** Completed pages and total pages, not network bytes. */
  onProgress?: (loaded: number, total: number) => void;
  onUploaded?: () => void;
}

interface OfflineEngine {
  pageCount(uri: string): Promise<number>;
  extractPage(uri: string, page: number): Promise<{ items: unknown[]; hasRasterImage: boolean }>;
  extractDocx(uri: string): Promise<string>;
  ocrPage(uri: string, page: number, language: string): Promise<{ page: number; text: string; confidence: number }>;
  releaseDocument(): Promise<void>;
}

function engine(): OfflineEngine {
  const module = NativeModules.ReadFlowOffline as OfflineEngine | undefined;
  if (Platform.OS !== "android" || !module) {
    throw new Error("Offline document import requires the updated Android app.");
  }
  return module;
}

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function paginateWordText(text: string): PdfPage[] {
  const pages: PdfPage[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) pages.push({ page: pages.length + 1, text: current.trim(), source: "native" });
    current = "";
  };
  for (const paragraph of text.split(/\n+/).map(p => p.trim()).filter(Boolean)) {
    if (current.length + paragraph.length > 1800 && current.length) flush();
    current += (current ? "\n" : "") + paragraph;
  }
  flush();
  return pages;
}

export const PDFParser = {
  async pickAndParse(opts?: { ocrLang?: string; forceOcr?: boolean } & ImportProgressHooks): Promise<ParsedPdf | null> {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", DOCX_TYPE], copyToCacheDirectory: true, multiple: false,
    });
    if (picked.canceled || !picked.assets?.length) return null;
    const asset = picked.assets[0];
    return PDFParser.parseUri({
      ...opts, uri: asset.uri, fileName: asset.name || "document", mimeType: asset.mimeType,
    });
  },

  async parseUri(args: {
    uri: string; fileName: string; mimeType?: string; ocrLang?: string; forceOcr?: boolean;
  } & ImportProgressHooks): Promise<ParsedPdf> {
    const native = engine();
    const ocrLang = resolveOcrLang(args.ocrLang);
    const kind = /\.docx$/i.test(args.fileName) || args.mimeType === DOCX_TYPE ? "docx" : "pdf";
    const sourceFingerprint = await fingerprintSourceFile(args.uri);
    const pages: PdfPage[] = [];
    const pendingOcr: number[] = [];
    args.onUploaded?.();
    try {
      if (kind === "docx") {
        pages.push(...paginateWordText(await native.extractDocx(args.uri)));
        if (!pages.length) throw new Error("This Word document has no readable text. Image-only Word documents are not supported.");
      } else {
        const total = await native.pageCount(args.uri);
        for (let page = 1; page <= total; page++) {
          if (args.forceOcr) {
            pages.push({ page, text: "", source: "native", hasRasterImage: true });
            pendingOcr.push(page);
          } else {
            const raw = await native.extractPage(args.uri, page);
            const layout = renderPdfTextItemsWithLayout(raw.items);
            const text = layout.text.trim();
            pages.push({ page, text, source: "native", hasRasterImage: raw.hasRasterImage || !text,
              ...(layout.footnoteStartLine == null ? {} : { footnoteStartLine: layout.footnoteStartLine }) });
            if (needsOcr(text, ocrLang)) pendingOcr.push(page);
          }
          args.onProgress?.(page, total);
        }
      }
    } finally {
      await native.releaseDocument().catch(() => {});
    }
    return {
      pageCount: pages.length, pages, scanned: pendingOcr.length > 0, fileName: args.fileName,
      kind, ocrPages: 0, docId: contentDocumentId(args.fileName, pages.length, sourceFingerprint),
      sourceFingerprint, sourceUri: args.uri, mimeType: args.mimeType, ocrLang,
      docToken: kind === "pdf" ? args.uri : undefined, pendingOcr,
      needsPaidOcr: false, truncated: false, forceOcr: Boolean(args.forceOcr),
    };
  },

  async ocrPages(uri: string, pages: number[], ocrLang?: string): Promise<PdfPage[]> {
    if (!uri.startsWith("file://")) throw Object.assign(new Error("Reopen the saved book to resume local OCR."), { code: "doc_expired" });
    const lang = resolveOcrLang(ocrLang);
    const results: PdfPage[] = [];
    for (const page of pages) {
      const result = await engine().ocrPage(uri, page, lang);
      results.push({ ...result, text: normalizeOcrText(result.text || "", lang), source: "ocr", hasRasterImage: true });
    }
    return results;
  },
};

export function isNetworkError(e: unknown): boolean {
  return /network request failed|network error|failed to fetch/i.test(String((e as any)?.message || ""));
}
export function isLocalBackendTarget(): boolean { return false; }
export function apiErrorCode(e: unknown): string { return String((e as any)?.code || (e as any)?.message || ""); }
export function isQuotaError(_e: unknown): boolean { return false; }
export function isExpiredDocError(e: unknown): boolean { return /doc_expired/i.test(apiErrorCode(e)); }
