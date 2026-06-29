import { Router } from "express";
import multer from "multer";
import { extractPdf } from "../services/pdfExtract";
import { extractDocx } from "../services/docxExtract";
import { needsOcr, ocrPdfPages } from "../services/ocrExtract";
import { addUsage, checkQuota } from "../services/usage";
import { getDoc, putDoc } from "../services/docStore";

// How many low-quality pages to OCR up-front (so the doc opens fast). The rest
// are OCR'd on demand as the reader views them (POST /api/pdf/ocr).
const OCR_EAGER_PAGES = Number(process.env.OCR_EAGER_PAGES || 4);

// Hard ceiling across all tiers; per-tier size is enforced below from the plan.
const ABSOLUTE_MAX_BYTES = 200 * 1024 * 1024; // 200 MB (Power tier max)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ABSOLUTE_MAX_BYTES },
});

export const pdfRouter = Router();

const PDF_TYPE = "application/pdf";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * POST /api/pdf/extract
 * form-data: file=<pdf|docx>, ocrLang?, forceOcr?
 * -> { pageCount, pages: [{ page, text, source, confidence? }], scanned, kind, ocrPages, truncated? }
 *
 * Tier rules:
 *   - Free: native text only, capped to `perDocPageCap` pages, NO OCR. Ads UI.
 *   - Reader Plus: full native-text documents, NO OCR and no AI cost.
 *   - AI Pro / Power: OCR for scanned pages, or full rebuild when forceOcr=true
 *     (counts toward monthly quota).
 * Per-tier file-size and page limits are enforced from the plan config so a
 * free user can't push large/expensive jobs through the backend.
 */
pdfRouter.post("/extract", upload.single("file"), async (req, res) => {
  try {
    const ent = req.entitlement!;
    const { limits, features } = ent.tier;

    if (!features.serverExtract) {
      return res.status(402).json({ error: "upgrade_required", feature: "serverExtract" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded (field name must be 'file')." });
    }

    // Per-tier file-size guard (multer enforces the absolute max; this is the plan max).
    if (req.file.size > limits.maxFileSizeMb * 1024 * 1024) {
      return res.status(413).json({
        error: "file_too_large",
        maxFileSizeMb: limits.maxFileSizeMb,
        message: `Your plan allows files up to ${limits.maxFileSizeMb} MB. Upgrade for larger files.`,
      });
    }

    // Monthly extraction count guard (abuse / cost control).
    const pdfQuota = checkQuota(ent.appUserId, "pdfs", limits.pdfsPerMonth);
    if (!pdfQuota.ok) {
      return res.status(429).json({
        error: "quota_exceeded",
        feature: "pdfs",
        used: pdfQuota.used,
        limit: pdfQuota.limit,
        message: "You've reached this month's document limit. It resets next month, or upgrade for higher limits.",
      });
    }

    const name = (req.file.originalname || "").toLowerCase();
    const isPdf = req.file.mimetype === PDF_TYPE || name.endsWith(".pdf");
    const isDocx = req.file.mimetype === DOCX_TYPE || name.endsWith(".docx");

    if (!isPdf && !isDocx) {
      return res
        .status(415)
        .json({ error: "Unsupported file. Upload a PDF or Word (.docx) document." });
    }

    const forceOcr =
      isPdf &&
      ["1", "true", "yes"].includes(String(req.body?.forceOcr || "").trim().toLowerCase());
    if (forceOcr && !features.ocr) {
      return res.status(402).json({ error: "upgrade_required", feature: "ocr" });
    }

    const doc = isPdf ? await extractPdf(req.file.buffer) : await extractDocx(req.file.buffer);
    addUsage(ent.appUserId, "pdfs");

    // Enforce per-document page limits: free users get a hard cap; paid users
    // get their (larger) plan ceiling. Pages beyond the cap are dropped here so
    // the client never receives — and the paywall is shown — beyond the limit.
    const pageCap =
      limits.perDocPageCap > 0
        ? Math.min(limits.perDocPageCap, limits.maxPages)
        : limits.maxPages;
    let truncated = false;
    if (doc.pages.length > pageCap) {
      doc.pages = doc.pages.slice(0, pageCap);
      truncated = true;
    }

    // Optional OCR language hint from the client (validated in ocrPdfPages).
    const ocrLang =
      typeof req.body?.ocrLang === "string" ? req.body.ocrLang : undefined;

    const lowQuality = isPdf
      ? forceOcr
        ? doc.pages.map((p) => p.page)
        : doc.pages.filter((p) => needsOcr(p.text, ocrLang)).map((p) => p.page)
      : [];

    // Keep the original bytes briefly so the client can OCR more pages on
    // demand (only for PDFs whose plan allows OCR).
    let docToken: string | null = null;
    const pendingOcr = new Set<number>();

    let ocrPages = 0;
    // OCR is an AI Pro / Power feature. Free and Reader Plus never trigger
    // server OCR cost.
    if (isPdf && features.ocr) {
      docToken = putDoc(req.file.buffer);
      const lowQualitySet = new Set(lowQuality);
      if (lowQuality.length > 0) {
        // Only OCR the first few pages now; the rest are pending (on demand).
        const eager = lowQuality.slice(0, Math.max(0, OCR_EAGER_PAGES));
        for (const p of lowQuality.slice(eager.length)) pendingOcr.add(p);

        // Cap eager OCR work to the user's remaining monthly OCR-page quota.
        const ocrQuota = checkQuota(ent.appUserId, "ocrPages", limits.ocrPagesPerMonth, 0);
        const allowed = eager.slice(0, Math.max(0, ocrQuota.remaining));
        // Pages we couldn't OCR now (quota) are also pending.
        for (const p of eager.slice(allowed.length)) pendingOcr.add(p);
        if (allowed.length > 0) {
          const ocr = await ocrPdfPages(req.file.buffer, allowed, ocrLang);
          const replaced = new Set<number>();
          for (const p of doc.pages) {
            const r = ocr.get(p.page);
            const shouldReplace =
              r &&
              r.text.trim() &&
              (forceOcr || lowQualitySet.has(p.page) || r.text.length > p.text.length);
            if (shouldReplace) {
              p.text = r.text;
              p.source = "ocr";
              p.confidence = r.confidence;
              ocrPages++;
              replaced.add(p.page);
            }
          }
          for (const page of allowed) {
            if (!replaced.has(page)) pendingOcr.add(page);
          }
          if (ocrPages > 0) addUsage(ent.appUserId, "ocrPages", ocrPages);
        }
      }
    }

    // Did this doc have scanned pages the user's plan couldn't OCR?
    const needsPaidOcr =
      isPdf && !features.ocr && documentNeedsPaidOcr(doc.pages, ocrLang);
    if (isPdf && (features.ocr || needsPaidOcr)) {
      blankUnusablePages(doc.pages, features.ocr ? Array.from(pendingOcr) : lowQuality);
    }
    const hasText = doc.pages.some((p) => p.text.trim().length > 0);

    return res.json({
      ...doc,
      kind: isPdf ? "pdf" : "docx",
      ocrPages,
      docToken, // used for on-demand OCR of the remaining pages
      pendingOcr: Array.from(pendingOcr).sort((a, b) => a - b), // pages still needing OCR
      truncated, // client shows paywall when more pages exist beyond the cap
      pageCap,
      needsPaidOcr, // client shows "upgrade to read scanned PDFs"
      forceOcr, // client/cache remember this document was rebuilt from page images
      // Scanned = a PDF where we still couldn't recover usable text anywhere.
      scanned: isPdf && !hasText,
    });
  } catch (err: any) {
    console.error("Document extract failed:", err?.message);
    if (req.entitlement) addUsage(req.entitlement.appUserId, "failedRequests");
    return res.status(500).json({ error: "Failed to read document." });
  }
});

function documentNeedsPaidOcr(
  pages: { text: string }[],
  ocrLang?: string
): boolean {
  const checks = pages.map((page) => {
    const text = (page.text || "").trim();
    return { textLength: text.length, needs: needsOcr(text, ocrLang) };
  });
  const lowQuality = checks.filter((page) => page.needs);
  if (lowQuality.length === 0) return false;

  const readablePages = checks.filter((page) => !page.needs && page.textLength >= 40).length;
  if (readablePages === 0) return true;

  const substantiveLowQuality = lowQuality.filter((page) => page.textLength >= 40).length;
  return substantiveLowQuality >= Math.max(2, Math.ceil(checks.length * 0.2));
}

function blankUnusablePages(pages: { page: number; text: string }[], pageNumbers: number[]): void {
  const blank = new Set(pageNumbers);
  for (const page of pages) {
    if (blank.has(page.page)) page.text = "";
  }
}

const OCR_ONDEMAND_MAX = Number(process.env.OCR_ONDEMAND_MAX || 12);

/**
 * POST /api/pdf/ocr
 * body: { docToken, pages: number[], ocrLang? }
 * -> { pages: [{ page, text, confidence }] }
 *
 * OCRs specific pages of a previously uploaded document on demand (as the reader
 * scrolls to them). Paid feature; counts toward the monthly OCR-page quota.
 */
pdfRouter.post("/ocr", async (req, res) => {
  try {
    const ent = req.entitlement!;
    const { limits, features } = ent.tier;

    if (!features.ocr) {
      return res.status(402).json({ error: "upgrade_required", feature: "ocr" });
    }

    const { docToken, pages, ocrLang } = (req.body || {}) as {
      docToken?: string;
      pages?: number[];
      ocrLang?: string;
    };

    if (!docToken || typeof docToken !== "string") {
      return res.status(400).json({ error: "docToken is required." });
    }
    const buffer = getDoc(docToken);
    if (!buffer) {
      return res.status(410).json({ error: "doc_expired", message: "Reopen the document to OCR more pages." });
    }

    const wanted = Array.from(
      new Set((Array.isArray(pages) ? pages : []).filter((n) => Number.isInteger(n) && n > 0))
    ).slice(0, OCR_ONDEMAND_MAX);
    if (wanted.length === 0) {
      return res.status(400).json({ error: "pages must be a non-empty array of page numbers." });
    }

    // Cap to remaining monthly OCR quota.
    const ocrQuota = checkQuota(ent.appUserId, "ocrPages", limits.ocrPagesPerMonth, 0);
    const allowed = wanted.slice(0, Math.max(0, ocrQuota.remaining));
    if (allowed.length === 0) {
      return res.status(429).json({
        error: "quota_exceeded",
        feature: "ocrPages",
        message: "You've reached this month's OCR limit. It resets next month, or upgrade.",
      });
    }

    const lang = typeof ocrLang === "string" ? ocrLang : undefined;
    const ocr = await ocrPdfPages(buffer, allowed, lang);
    const out: { page: number; text: string; confidence?: number }[] = [];
    for (const page of allowed) {
      const r = ocr.get(page);
      if (r) out.push({ page, text: r.text, confidence: r.confidence });
    }
    if (out.length > 0) addUsage(ent.appUserId, "ocrPages", out.length);

    return res.json({ pages: out });
  } catch (err: any) {
    console.error("On-demand OCR failed:", err?.message);
    if (req.entitlement) addUsage(req.entitlement.appUserId, "failedRequests");
    return res.status(500).json({ error: "OCR failed." });
  }
});
