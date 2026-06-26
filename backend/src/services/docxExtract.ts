import mammoth from "mammoth";
import { ExtractedDocument, ExtractedPage } from "./pdfExtract";

const CHARS_PER_PAGE = 1800; // synthetic page size for Word docs (no fixed pages)

/**
 * Extracts text from a .docx (Word) buffer and paginates it into synthetic
 * "pages" on paragraph boundaries, so the rest of the app (10-page chunks,
 * go-to-page, bookmarks) works the same as for PDFs.
 *
 * Legacy .doc and image-only content are not supported here.
 */
export async function extractDocx(buffer: Buffer): Promise<ExtractedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  const paragraphs = result.value
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pages: ExtractedPage[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) {
      pages.push({ page: pages.length + 1, text: current.trim(), source: "native" });
      current = "";
    }
  };

  for (const para of paragraphs) {
    if (current.length + para.length > CHARS_PER_PAGE && current.length > 0) {
      flush();
    }
    current += (current ? "\n" : "") + para;
  }
  flush();

  return { pageCount: pages.length, pages };
}
