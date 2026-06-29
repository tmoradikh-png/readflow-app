# readFlow Release QA - 2026-06-29

This note records the multilingual/backend/phone smoke checks run before the
next Android build. It is intentionally practical: future developers should be
able to repeat the same checks without relying on chat history.

## Environment

- Branch: `codex/local-ai-voice-polish`
- Render backend: `https://readflow-backend-internal.onrender.com`
- Internal Render tier: `ai_pro` through `ENTITLEMENTS_DEV_OVERRIDE=true`
- Connected phone: Samsung `SM_G975F`, device id `R58M168KTSZ`
- Installed phone build during smoke test: `com.urmiaworks.readflow`
  `1.0.18` / Android `versionCode=18`
- Phone was kept awake while plugged in with ADB during long QA:
  `settings put global stay_on_while_plugged_in 3` and
  `svc power stayon true`

## Backend Changes Verified

- Clean Latin-script diacritics no longer trigger unnecessary OCR. German and
  Norwegian native text stayed native and preserved diacritics.
- Backend Docker image now copies committed Tesseract `.traineddata` files into
  `/app/tessdata`.
- OCR workers prefer local traineddata when present and use
  `/tmp/readflow-tessdata` for downloaded/cached packs.
- Health now reports `capabilities.cloudVoice` from effective cloud voice
  availability instead of only echoing `TTS_PROVIDER`.

Committed OCR packs currently present in the backend repo:

- `ara`, `chi_sim`, `deu`, `eng`, `fas`, `jpn`, `nor`, `rus`

Other OCR language codes exposed by the app can still download through
Tesseract.js at runtime, but those packs are not bundled yet. Before public
launch, either bundle the remaining promised packs or describe them as
download-on-first-use/server-cached.

## Synthetic Fixture Matrix

Fixtures live in `tmp/pdfs/release_qa_20260629` on the QA machine and were
posted to the live Render `/api/pdf/extract` endpoint with the app key from
`mobile/app.json`.

| Fixture | Kind | OCR lang | Result |
| --- | --- | --- | --- |
| `native_english.pdf` | Text-layer | `eng` | Pass, native, 0 OCR pages |
| `native_german_norwegian.pdf` | Text-layer | `deu` | Pass, native, 0 OCR pages |
| `native_russian.pdf` | Text-layer | `rus` | Pass, native, 0 OCR pages |
| `native_chinese.pdf` | Text-layer | `chi_sim` | Pass, native, 0 OCR pages |
| `native_japanese.pdf` | Text-layer | `jpn` | Pass, native, 0 OCR pages |
| `native_korean.pdf` | Text-layer | `kor` | Pass, native, 0 OCR pages |
| `scanned_english.pdf` | Image-only | `eng` | Pass, OCR page returned |
| `scanned_russian.pdf` | Image-only | `rus` | Pass, OCR page returned; OCR is readable but imperfect |
| `scanned_chinese.pdf` | Image-only | `chi_sim` | Pass, OCR page returned |

Main conclusion: proper text-layer PDFs can be read across Latin, Cyrillic,
Chinese, Japanese, and Korean without OCR cost. Scanned files route to OCR.

## Word / DOCX Smoke

Local backend smoke run on 2026-06-29 with `PORT=4051`,
`ENTITLEMENTS_DEV_OVERRIDE=true`, and `DEV_DEFAULT_TIER=reader_plus`.

Generated fixture: `tmp/readflow-word-smoke.docx`.

Endpoint tested:

```powershell
curl.exe -H "x-app-user-id: word-smoke" `
  -F "file=@tmp/readflow-word-smoke.docx;type=application/vnd.openxmlformats-officedocument.wordprocessingml.document" `
  http://localhost:4051/api/pdf/extract
```

Result:

- Returned `kind: docx`.
- Returned `pageCount: 1`, `pages: 1`.
- Returned `ocrPages: 0`, `needsPaidOcr: false`, `scanned: false`.
- Preserved plain paragraphs plus Spanish accents, Persian RTL text, Chinese
  text, and the final paragraph.

Scope note: Word support currently means modern `.docx` text extraction through
Mammoth. Legacy `.doc`, image-only Word pages, embedded images, footnotes,
tables, columns, and advanced formatting are not covered by this smoke test and
should not be promised as fully preserved.

## Real Document Checks

Temporary copies were created in `tmp/pdfs/real_qa_20260629` to avoid lock
issues with Google Drive/Downloads files.

| Case | Source behavior | Result |
| --- | --- | --- |
| Exact Persian sample `G:/My Drive/Studies/Philosophy/book/____ _____._.pdf` | Old Distiller text-layer PDF | Pass. 29 pages returned, no mojibake markers, readable Persian. One page used OCR; no pending OCR. |
| `zayesh-tragedy-az-jan_[www.ketabesabz.com].pdf` | Good Persian text-layer PDF | Pass. 101 pages returned, readable Persian, no paid OCR requirement. |
| `Tabar_Shenasiye_Akhlagh[www.VeyQ.ir].pdf` | Scanned/image Persian book | Pass as AI Pro behavior. First 4 pages OCR'd, remaining 212 pending for on-demand OCR. |
| `Dayeratol_Maaref_Sotoon_Panjom[ebook.VeyQ.ir].pdf` | Scanned/image Persian book | Pass as AI Pro behavior. First 4 pages OCR'd, remaining 198 pending for on-demand OCR. |
| `Why am I not a Christian.pdf` | Scanned/image English book | Correctly behaves like OCR-needed content, not cheap native text. |
| `learn-german-with-stories_-cafe-in-berlin.pdf` | German text-layer PDF | Pass. Native German text returned with no mojibake. |
| `__ ___ ____ ______ - ________ ____ ____ ____.pdf` | Encrypted/copy-disabled old Ghostscript Persian scan | Requires OCR. Native extraction is unreliable; Persian OCR was improved with `fas+ara`, Persian letter normalization, thresholding, cache-version bump, and OCR page-number cleanup. Local API test confirmed eager page 2 and on-demand page 5 return readable but imperfect OCR. |

Reader Plus guardrail was tested locally with `DEV_DEFAULT_TIER=reader_plus`:

- Good Persian text-layer PDF returned all text as native with `ocrPages=0`.
- Scanned Persian book returned `needsPaidOcr=true`, `ocrPages=0`, and blank
  unusable pages instead of spending OCR or showing garbage text.

## AI And Voice Smoke

- `/api/ai` Ask smoke returned an OpenAI answer from the internal Render
  backend.
- `/api/tts` English Cloud AI voice returned `audio/mpeg` successfully.
- Persian Cloud AI voice returned HTTP `422` with
  `cloud_voice_language_unsupported`, which is correct until Persian voice QA
  passes. Device voice remains the fallback for unsupported cloud languages.

## Phone Smoke

- Device detected by ADB as `R58M168KTSZ`.
- Installed package reported `versionName=1.0.18`, `versionCode=18`.
- Render-connected app launched with:
  `adb shell monkey -p com.urmiaworks.readflow 1`
- Recent logcat scan found no `FATAL EXCEPTION`, `AndroidRuntime`, or
  `ReactNativeJS` startup crash lines.

This was a startup/backend smoke, not a full manual UI import pass. Manual QA
should still import at least one good Persian text-layer PDF, one scanned
Persian PDF, one German/Norwegian PDF with diacritics, and one CJK text-layer
PDF inside the app before a public release.

## Remaining Release Risks

- OCR quality is readable but imperfect on scanned books. Keep cautious store
  wording: quality depends on scan, font, language, and page layout.
- UI exposes more OCR languages than are currently bundled in the Docker image.
  Missing packs can download at runtime through Tesseract.js, but first use may
  be slower and depends on network access from Render.
- rF AI voice is still English-only in this build. Other rF AI voice packs
  should be added as downloadable language packs after quality/size review.
- Public subscription enforcement still depends on final RevenueCat production
  setup. Internal Render uses dev override and must not be treated as public
  entitlement configuration.
- Manual phone import/delete/playback/rotation checks are still required before
  store rollout, especially after any fresh native build.
