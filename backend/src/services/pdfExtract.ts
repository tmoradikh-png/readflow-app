// pdf-parse ships no types; require the lib entry directly to avoid its debug harness.
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

/** How a page's text was obtained. */
export type TextSource = "native" | "ocr";

export interface ExtractedPage {
  page: number;
  text: string;
  /** Where the text came from. Native = PDF text layer; OCR = recognized from image. */
  source: TextSource;
  /** OCR confidence 0–100 (only present for OCR pages). */
  confidence?: number;
}

export interface ExtractedDocument {
  pageCount: number;
  pages: ExtractedPage[];
}

/**
 * Extracts text per page from a clean (text-based) PDF buffer.
 * Image-only/scanned pages return little/no text; the route then falls back to
 * OCR for those pages (see services/ocrExtract.ts).
 */
export async function extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
  const pages: string[] = [];

  function renderPage(pageData: any): Promise<string> {
    const options = { normalizeWhitespace: false, disableCombineTextItems: false };
    return pageData.getTextContent(options).then((content: any) => {
      let lastY: number | undefined;
      let text = "";
      for (const item of content.items) {
        const y = item.transform?.[5];
        if (lastY === y || lastY === undefined) {
          text += item.str;
        } else {
          text += "\n" + item.str;
        }
        lastY = y;
      }
      pages.push(text);
      return text;
    });
  }

  await pdfParse(buffer, { pagerender: renderPage });

  return {
    pageCount: pages.length,
    pages: pages.map((text, i) => ({ page: i + 1, text: text.trim(), source: "native" as const })),
  };
}
