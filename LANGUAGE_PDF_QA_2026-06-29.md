# Multilingual PDF QA - 2026-06-29

Test folder on the QA machine:

```text
C:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow\test-pdfs
```

The folder contains 21 OCR languages, 5 PDFs per language, plus
`generate_test_pdfs.py` and `README.md`. The generated PDFs are about 59 MB, so
do not add them to normal Git history without deciding between Git LFS, a
separate release-asset download, or regenerating them from the script.

## Test Set

Each language folder contains:

- `tier1_clean.pdf`: born-digital/selectable text. Should stay native, no OCR.
- `tier2_good_scan.pdf`: crisp image-only scan. Should OCR well.
- `tier3_medium.pdf`: copier-like scan. Useful stress test, not guaranteed.
- `tier4_poor.pdf`: low-resolution/noisy scan. Expected to route to OCR but
  not expected to be reliably readable.
- `tier5_very_bad.pdf`: bad phone-photo scan. Expected to route to OCR but not
  expected to be reliably readable.

Supported language folders tested:

```text
eng, spa, fra, deu, ita, por, nld, swe, nor, dan, fin, tur, ind, vie,
jpn, kor, chi_sim, hin, rus, ara, fas
```

## Method

- Phone was connected as Samsung `SM_G975F` / `R58M168KTSZ` and kept awake with
  ADB while tests ran.
- Full live Render testing was started, but Render Free was too slow for the
  whole 105-file grid: English `tier4_poor.pdf` took 217 seconds for one OCR
  page.
- Full baseline testing therefore used a local backend on port `4103`, built
  from the same source as Render.
- Results were written under:

```text
tmp\pdfs\language_matrix_20260629
```

Important result files:

- `baseline-results-v2.csv`
- `baseline-summary-v2.csv`
- `scorefix-cjk-rtl.csv`

## Baseline Result

Baseline means `tier1_clean.pdf` and `tier2_good_scan.pdf`.

After correcting the scorer for languages without word spaces and after the RTL
native-text fix below:

- All 21 languages routed correctly.
- All 21 clean PDFs stayed native.
- All 21 good-scan PDFs used OCR.
- OCR language packs loaded for all 21 OCR codes.
- Good-scan OCR was generally high quality.

Notable confidence values from local baseline:

- Latin/European good scans were usually `93-95`.
- Vietnamese good scan was `91`.
- Japanese and Chinese good scans were `89`.
- Korean good scan was `87`.
- Hindi good scan was `88`.
- Russian good scan was `84`.
- Arabic good scan was `74`.
- Persian good scan was `87`.

## Findings

### CJK Scoring

The first word-based scorer falsely failed Japanese and Chinese because those
languages do not use spaces between words. Manual samples and character-based
scoring showed the clean and good-scan PDFs are readable:

- Japanese clean: character hit ratio `1.0`.
- Japanese good scan: character hit ratio `1.0`, with some OCR noise.
- Chinese clean: character hit ratio `0.98`.
- Chinese good scan: character hit ratio `1.0`.

Future QA scripts must score CJK by characters or known substrings, not
space-separated words.

### Arabic/Persian Native Text

Clean Arabic/Persian PDFs were readable but had the wrong `ھ` glyph in places
before the fix, for example `الھادئ` and `صبحگاھی`.

Fix applied in `backend/src/services/pdfExtract.ts`:

- For RTL native extracted lines, replace U+06BE `ھ` with U+0647 `ه`.

Retest showed:

- Arabic clean sample now contains `الهادئ` / `بهدوء`.
- Persian clean sample now contains `صبحگاهی` / `به همراه`.
- The bad `ھ` character was no longer present.

### Medium/Poor Scan Stress

The harder tiers are useful stress tests but should not be promised as reliable
OCR quality:

- English `tier4_poor.pdf`: routed to OCR, confidence `20`, text score failed.
- English `tier5_very_bad.pdf`: routed to OCR, confidence `20`, text score
  failed.
- Spanish `tier3_medium.pdf`: routed to OCR, confidence `24`, text score failed.
- French `tier3_medium.pdf`: routed to OCR, confidence `19`, text still passed
  weakly but took about 82 seconds.
- Italian `tier3_medium.pdf`: routed to OCR, confidence `20`, text score failed.
- Portuguese `tier3_medium.pdf`: timed out at 180 seconds locally.

Product implication: readFlow can say OCR supports these languages for clean
text PDFs and good scans, but store/app copy must stay cautious for degraded
copies, low-resolution scans, skewed photos, heavy noise, and bad compression.

## Release Interpretation

Reader Plus:

- Good text-layer PDFs in all tested languages should work without OCR cost.
- Scanned/image PDFs should be AI Pro/Power only.

AI Pro / Power:

- Good scans in all 21 tested languages can enter the OCR path.
- Degraded scans need clear user messaging: OCR may take time and quality may
  vary heavily.

Backlog:

- Improve OCR preprocessing for medium/poor Latin scans if product wants to
  market copier-photo recovery.
- Add a permanent automated QA script that uses CJK character scoring and
  Arabic/Persian normalization.
- Decide how to store the 59 MB PDF test set: Git LFS, downloadable artifact,
  or regenerate from `test-pdfs/generate_test_pdfs.py`.

