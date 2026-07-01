# readFlow Developer Handoff

Updated: 2026-07-01

Read this file first when taking over the project. It is the high-level map of
accounts, services, release status, and operational habits. Then use
`README.md` for local setup, `RELEASE_GUIDE.md` for Android builds,
`IOS_RELEASE_GUIDE.md` for iOS/TestFlight builds, `PAYMENT_SETUP.md` for
store billing/RevenueCat, `PLAY_RELEASE_PACKET.md` for Play submission text,
`APP_STORE_RELEASE_PACKET.md` for App Store submission text,
`PRIVACY_POLICY_DRAFT.md`, `TERMS_OF_USE_DRAFT.md`, and
`PLAY_DATA_SAFETY_DRAFT.md` for legal/app-content drafts,
`BACKEND_FEATURE_ENFORCEMENT.md` for paid-feature enforcement, and
`MARKETING_PLAY_STORE.md` for website/Play Store messaging. Use
`COST_MODEL.md` for pricing, OpenAI cost, free-tier limits, AI action limits,
and cloud voice allowance decisions.

## Product

readFlow is a phone-first PDF/Word reader. It extracts document text, removes
fixed PDF layout, reflows the content into a clean reading view, reads aloud,
and supports AI features such as summary, explain, Q&A, OCR, and natural cloud
voice.

Current shape:
- `mobile/`: Expo React Native app, TypeScript.
- `backend/`: Node + Express + TypeScript backend for PDF extraction, OCR, AI,
  cloud TTS, entitlement checks, and cost-bearing API protection.
- Android is the active release target. iOS release prep now exists, but no iOS
  EAS build has been started/tested yet.

## Current State

- Active release branch: `main`
- GitHub remote: `https://github.com/tmoradikh-png/readflow-app.git`
- GitHub account rule: always use `tmoradikh-png` for this project unless the
  owner explicitly changes the repository owner.
- Current source version: `1.0.24`
- Current source Android `versionCode`: `24`
- Current source iOS `buildNumber`: `24`
- Latest finished EAS build: `1.0.24` / code `24`
- Latest finished EAS build id: `e3bc6713-2277-404e-8b08-11f4f592f3ba`
- Latest finished AAB:
  `https://expo.dev/artifacts/eas/A99FL8SxYSoTpYukWz-9miu4EvjVluCOsLIprGqQUDo.aab`
- Latest finished AAB local copy:
  `artifacts/readflow-1.0.24-24.aab` (~142 MB).
- Latest iOS EAS build: none. `npx --yes eas-cli build:list --platform ios
  --limit 5 --json --non-interactive` returned `[]` on 2026-06-29.
- Next Android build should use code `25` unless another EAS
  build has already consumed it. Run the EAS `build:list` command in
  `RELEASE_GUIDE.md` immediately before spending build quota.
- Next iOS build can use buildNumber `24` unless an iOS EAS build has already
  consumed it. Run the EAS `build:list --platform ios` command in
  `IOS_RELEASE_GUIDE.md` immediately before spending build quota.

Changes included in the latest finished EAS build:
- RevenueCat SDK / Play Billing wiring was added in mobile source, with the
  explicit `com.android.vending.BILLING` permission.
- Upgrade paywalls can open purchase and restore flows when RevenueCat public
  SDK key plus offerings/products are configured.
- RevenueCat is configured with the same stable local `rf_...` app user id sent
  to the backend as `x-app-user-id`.
- Active line highlighting and the foreground-only reading policy were added.
- Cloud voice paragraph handoff was improved with wider prefetch, player reuse,
  and a shorter tail guard.
- Highlighting targets the active rendered line while keeping the same TTS audio
  chunk size for natural voice.
- Production backend points to the converted Render service at
  `https://readflow-backend-internal.onrender.com`; service name is
  `readflow-backend`, dev override is off, and `/api/entitlements` returns Free
  for the current app key.
- Android release config has no microphone permission and no background audio
  declaration. It now includes Play Billing permission for subscription builds.
- `npm run check:release` blocks stale generated `mobile/android/` directories
  so native Gradle values cannot override `app.json`.

Important: build `178c888f` / `1.0.18` was canceled because a stale generated
`mobile/android/` folder would have overridden `app.json` with versionCode `18`
and `RECORD_AUDIO`. The folder was moved to
`tmp/android-local-backup-20260629-1`, and the release checker now blocks this.

Current Play release prep in source `1.0.24`:
- `mobile/app.json` now points at the public backend host
  `https://readflow-backend-internal.onrender.com`. This is the converted
  production Render service: the service name is `readflow-backend`, but Render
  kept the old `readflow-backend-internal` subdomain after the service was
  renamed. It returned `{"ok":true,...}` and Free entitlements with the current
  mobile app key on 2026-06-29.
  The old `https://readflow-backend.onrender.com` URL still returns Render's
  `Service Suspended` owner-state page and must not be used by Play builds
  unless that old service is recovered or replaced.
- Android permissions are `INTERNET` and `com.android.vending.BILLING`;
  `expo-audio` is configured with `recordAudioAndroid: false` and
  `microphonePermission: false`.
- iOS background audio mode and Expo foreground/background playback flags are
  disabled for the current foreground-only product behavior.
- Mobile now creates a stable local `rf_...` install id and sends it as
  `x-app-user-id` so public free users do not all share the backend
  `"anonymous"` usage/quota bucket. RevenueCat is also configured with this same
  id, so store entitlements and backend quotas resolve to one customer identity
  without requiring login.
- Free is enforced as a limited manual-reading preview: page cap from
  `perDocPageCap`, no Listen/read-aloud, no OCR, no rF AI, no Cloud AI, and no
  AI questions. Reader Plus and higher unlock device read-aloud.
- `npm run check:release` now fails if the build points away from the converted
  production backend, asks for microphone permission, declares background audio,
  omits app-user-id support, or has public Render blueprints with
  `ENTITLEMENTS_DEV_OVERRIDE=true`.
- Paid subscriptions are not ready to sell until RevenueCat dashboard setup is
  complete and the production Render backend has `RC_SECRET_KEY` set. Build 24
  is billing-capable but was started with no EAS RevenueCat public SDK key, so
  purchase buttons stay disabled as "Setting up purchases" in that build.
- Payment/legal release prep added on 2026-06-29:
  - `PAYMENT_SETUP.md` records product ids, RevenueCat/Play setup, backend env,
    and sandbox tests.
  - `PLAY_RELEASE_PACKET.md` records Play listing copy, review notes,
    subscription disclosure, and release gates.
  - `PRIVACY_POLICY_DRAFT.md`, `TERMS_OF_USE_DRAFT.md`, and
    `PLAY_DATA_SAFETY_DRAFT.md` are publication drafts that must be reviewed
    before going live.
  - The old local-AI label has been removed from tracked app source; the public
    customer-facing name is `rF AI`.

Current iOS release prep in source `1.0.24`:
- `mobile/app.json` uses iOS bundle id `com.urmiaworks.readflow`, buildNumber
  `24`, and `ITSAppUsesNonExemptEncryption=false`.
- `mobile/eas.json` now has explicit iOS settings for development/preview
  device builds and App Store/TestFlight archive builds.
- `npm run check:release` now checks iOS bundle id, build number, no generated
  `mobile/ios/` directory, no iOS microphone usage string, no background-audio
  mode, iOS export compliance, and EAS iOS archive profile settings.
- `IOS_RELEASE_GUIDE.md` records the iOS EAS build routine and TestFlight QA
  checklist. `APP_STORE_RELEASE_PACKET.md` records App Store listing text,
  review notes, subscription disclosure, and App Privacy worksheet notes.
- EAS had no iOS build history on 2026-06-29, so buildNumber `24` is currently
  free unless a later iOS build consumes it.
- Paid iOS subscriptions are not ready to sell until Apple in-app purchase /
  RevenueCat dashboard setup is complete and production Render has
  `RC_SECRET_KEY` set. The shared mobile paywall wiring is present, but no iOS
  sandbox purchase has been tested yet.

Current backend note:
- Production Render service name: `readflow-backend`.
- Current reachable production URL:
  `https://readflow-backend-internal.onrender.com`.
- Old suspended URL: `https://readflow-backend.onrender.com`.
- The current URL is acceptable for release only because the service was
  converted to production and verified to return Free entitlements. Prefer a
  future custom domain such as `https://api.urmiaworks.com` before broad launch.

Changes after the latest finished build and included in source `1.0.18`:
- Cloud AI voice is gated by `features.cloudVoice`, not generic AI.
- AI Pro includes 45k cloud voice characters/month; Power includes 100k.
- Direct AI vendor spend is capped by source guardrail at 20% of conservative
  net subscription revenue, calculated against the lower annual-plan revenue.
- Backend `/api/tts` checks monthly `cloudVoiceChars` before generating fresh
  OpenAI audio.
- Voice selection uses the public labels `Device voice`, `rF AI`, and
  `Cloud AI`. The shelf Voice sheet only shows the detailed settings for the
  currently selected mode so readers do not see raw Android voice clutter.
- The reader settings menu also includes a quick `Device` / `rF AI` /
  `Cloud AI` selector. Cloud AI acts as an upgrade prompt when the plan does
  not include `features.cloudVoice`; locked labels must say `AI Pro`/`Locked`,
  not `Soon`, because Cloud AI is a live paid feature once the backend grants a
  voice allowance.
- The shelf now has a `Book language` selector. The selected language is saved
  in preferences and drives import OCR (`ocrLang`), on-demand OCR, phone voice
  filtering, reader TTS locale, Cloud AI/AI answer language, and rF AI
  eligibility messaging. rF AI remains English-only until more local voice
  packs are added.
- App warnings and confirmations use `ThemedNotice` / `UpgradeSheet`, not native
  Android alerts, so upgrade, quota, delete, download, and validation messages
  stay in the readFlow visual style.
- OCR language options currently exposed from mobile:
  English, Spanish, French, German, Italian, Portuguese, Dutch, Swedish,
  Norwegian, Danish, Finnish, Turkish, Indonesian, Vietnamese, Japanese,
  Korean, Chinese (Simplified), Hindi, Russian, Arabic, and Persian. Backend
  Tesseract allow-list includes matching codes, including `fas` for Persian.
- Backend OCR quality detection is language-aware for non-Latin scripts. When
  the user selects Arabic/Persian, Russian/Cyrillic, Hindi/Devanagari, Thai,
  Korean, Japanese, or Chinese, corrupted native PDF text layers (for example
  repeated `AA`, Latin fragments embedded inside non-Latin words, Unicode
  replacement characters, or common mojibake sequences) are treated as OCR
  candidates instead of being accepted as readable text. CJK still allows normal
  adjacent Latin product names/titles to avoid wasting OCR on good bilingual
  PDFs.
- 2026-06-29 multilingual import fix: OCR now replaces pages that were explicitly
  marked low-quality even when the OCR text is shorter than the broken native
  text. This matters for Persian/Arabic PDFs where the corrupt text layer can be
  long but unreadable. The mobile parsed-text cache now stores `ocrLang`; a book
  cached under English/old extraction will be re-extracted when reopened with
  Persian/Arabic/etc. instead of silently showing stale corrupted text.
- 2026-06-29 cache invalidation follow-up: mobile parsed-document cache schema is
  now versioned (`cacheVersion: 2`). Existing caches without that version are
  discarded and re-parsed from the stored source file, so pre-fix Persian imports
  do not survive app updates.
- OCR detection was also relaxed for mixed-language non-Latin books. If a page
  already has meaningful native Chinese/Japanese/Russian/Persian/etc. characters,
  or clearly readable bilingual Latin text, readFlow keeps the native text
  instead of wasting OCR quota and risking worse OCR output.
- 2026-06-29 follow-up: native PDF extraction now rebuilds text from positioned
  PDF text items by rendered line. Lines with Persian/Arabic script are sorted
  right-to-left by X coordinate; left-to-right languages stay left-to-right. This
  fixes the case where Persian words were individually correct but the sentence
  order was meaningless. Future language QA must inspect readable line order,
  not only check that the expected script appears.
- Proper text-layer PDFs should not require OCR for Reader/free-style reading.
  A Free-tier local endpoint test returned Persian, Arabic, Russian, and Chinese
  proper PDFs with `ocrPages: 0` and `needsPaidOcr: false`. Paid OCR still worked
  on a scanned Persian sample (`ocrPages: 3`, no pending pages).
- Device voice selector uses installed phone voices when available.
- Help/About sheet shows version, support contact, website, and button meanings.
- rF AI voice now uses `react-native-sherpa-onnx` plus an on-demand
  Supertonic local TTS model
  (`sherpa-onnx-supertonic-tts-int8-2026-03-06`). The model is not bundled into
  the app; the user downloads it from the Voice sheet. It is larger than the old
  Piper test voice (about 81 MB instead of 20 MB) because the 20 MB voice sounded
  too machine-like for book reading.
- Important: rF AI voice is a native dependency. It needs a new EAS/native
  build to run on the phone; Expo Go or an older installed build will fall back
  to device voice.
- Playback policy is currently foreground-only for every voice engine. While a
  book is reading, readFlow keeps the screen awake; if the user locks the phone,
  presses Home, or app-switches away, audio stops instead of finishing the
  paragraph/chunk. A future lock-screen audiobook mode would need explicit
  native media-session controls and product approval.
- Reader jumps now land directly instead of animating through pages. Resume,
  page navigation, bookmark jumps, rotation re-anchors, and follow corrections
  should not visibly scroll through the book.
- Connected-phone dev test on 2026-06-29: a debug native build was installed on
  Samsung `SM_G975F` (`R58M168KTSZ`) from a short temp path. The first Piper
  experiment proved Sherpa playback worked; current source uses the larger
  Supertonic Reader/rF AI model for better quality. No EAS quota was
  consumed for this test.
- Follow-up on 2026-06-29: installing the raw `assembleDebug` APK left the app
  stuck on the splash screen because it expected Metro and had no packaged JS
  bundle (`Unable to load script`). For standalone phone QA, build/install
  `assembleRelease` from the short temp path; debug installs must be launched
  through `npx expo run:android` or with Metro plus ADB port reverse on `8081`.
- Source now includes `mobile/plugins/withSherpaCodegenGradleFix.js`. Keep it:
  it makes clean native builds run Sherpa's React Native codegen before the app
  CMake/autolinking step. Without it, clean Gradle builds can fail with missing
  `react-native-sherpa-onnx/android/build/generated/source/codegen/jni`. It also
  normalizes Windows reparse-point `.so` outputs before native packaging because
  Gradle 8.14 can fail to snapshot those generated NDK files.
- Source after the 2026-06-29 phone/local-AI test also includes reader stability
  fixes that still need a fresh native build/on-device QA:
  - Reading keeps the phone screen awake while playback is active.
  - Reopening a book initializes at the saved sentence instead of visibly
    scrolling from the top.
  - Rotation clears stale line measurements, re-anchors by page/sentence
    position, and caps `FlatList` scroll retries so the highlight does not chase
    through the book forever.
  - rF AI uses the optional Supertonic Reader model, reads short
    same-page chunks, prefetches sooner, and uses a shorter audio tail guard to
    reduce paragraph gaps.
  - Voice settings now use customer-facing names: Device voice, rF AI
    (on-device), and Cloud AI (cloud allowance).
  - Library remove is visible on document cards and the Continue card, removes
    cached parsed text/bookmarks, and updates metadata before deleting the
    physical file so deletion does not feel stuck.
- 2026-06-29 local phone build `1.0.20` cleaned the shelf UI by removing the
  repeated voice status strip/card. rF AI/Phone/Cloud details now live in the
  Voice sheet instead of crowding the first screen.
- Multilingual PDF endpoint test on 2026-06-29 used downloaded public samples
  for Persian text, Persian scanned/image, Arabic, Russian, Japanese, and
  Chinese. Results against local backend `http://127.0.0.1:4000`: Persian text
  imported native with no mojibake; Persian scanned returned OCR text for all 3
  pages; Arabic returned usable Arabic with OCR only where needed; Russian
  imported with Cyrillic text and no pending OCR; Chinese Wikibook kept native
  mixed English/Chinese text with no OCR; Japanese content pages imported native
  text, while decorative cover/image pages OCR'd with expected lower quality.
- Stronger order/readability retest on 2026-06-29: Free-tier/native import
  confirmed readable line order for Persian, Arabic, Russian, and Chinese with
  no OCR spend. AI Pro scanned-Persian OCR was retested after the ordering patch.
- Reader page changes now show a very faded divider line only when moving from
  one PDF page to the next; it does not add text to the spoken content or AI
  context.
- 2026-06-29 product boundary update: Free is 1 native-text PDF/month with the
  first 100 pages returned; Reader Plus is full/ad-free native-text reading with
  device voice and no OCR/AI/cloud voice cost. OCR now starts at AI Pro
  (750 pages/month) and Power (2,500 pages/month). Do not put OCR back into
  Reader Plus unless the cost model is intentionally changed.
- 2026-06-29 Persian book check from the owner's Downloads: `zayesh-tragedy-az-jan`
  is a good Persian text-layer PDF and imports as native text. `Tabar_Shenasiye_Akhlagh`
  and `Dayeratol_Maaref_Sotoon_Panjom` are scanned/image PDFs; they must show an
  OCR-required path for Free/Reader Plus and run background OCR only for AI
  Pro/Power. Pending OCR pages are returned blank instead of showing watermark
  or garbage placeholder text.
- Non-Latin text-layer PDFs that visually look correct but extract with stray
  Latin artifacts inside words must be treated as low-quality native text and
  pushed to OCR for AI Pro/Power. Reader/free tiers should surface the
  OCR-required path rather than showing the broken native text. Persian is the
  first owner-reported example, not a special-case-only fix.
- 2026-06-29 exact Persian sample `G:\My Drive\Studies\Philosophy\book\____ _____._.pdf`:
  this is an old Word/Acrobat Distiller 5.0 PDF (`usul.doc`, 29 pages) whose
  hidden text layer uses Arabic Presentation Forms plus a bogus U+0467 glyph
  that Android displays as A-like noise. The page image is readable, but the
  text layer needs normalization/cleanup. Source now normalizes Arabic
  presentation forms, removes the U+0467 filler, strips footnote-star markers
  and page-bottom footnote blocks from reader flow, and bumps mobile parsed-text
  cache to version 3.
- The same sample proves that clean-looking native text can still be semantically
  wrong across a whole PDF because the hidden text layer interleaves body text
  and footnotes. Do not keep expanding one-off text repairs for this class.
  AI Pro/Power users now have a document action, `Fix text`, that reparses the
  stored PDF with `forceOcr=true`, uses the paid monthly OCR allowance, saves the
  OCR cache, and opens the rebuilt document while remaining pages continue via
  background OCR.
- Rebuilt books are visibly labeled `OCR rebuild` on the shelf and in the reader
  header. If that label is missing, the user is still looking at a native-text
  import, or an older backend ignored the rebuild request.
- Forced OCR documents must keep `forceOcr=true` in the parsed-text cache. If a
  rebuilt document is reopened while OCR is still pending, reopen must request a
  new forced-OCR server token and merge cached OCR pages into that forced result;
  otherwise the book silently falls back to the broken native text layer. The
  shelf also shows per-book rebuild progress and disables `Fix text` while a
  rebuild job is already active.
- Mobile refuses to save a `Fix text` result if the backend response does not
  echo `forceOcr=true`. This prevents false-positive OCR rebuilds when the phone
  has a new APK but Render is still serving an older backend deploy.
- Reader text cleanup now removes page-number-only lines, common URL/watermark
  lines, and repeated short headers/footers before building reader sentences.
  This affects display, TTS, and AI context so the app does not read page
  numbers or site watermarks aloud.
- Cloud AI voice is now language-quality gated. Persian and other unapproved
  non-Latin voice languages fall back to Phone voice until voice QA passes; AI
  text can still answer in those languages.
- Connected-phone test on 2026-06-29 after the multilingual fix: installed a
  standalone local release APK on Samsung `SM_G975F` (`R58M168KTSZ`) from
  `C:\rf-mobile-test-voice2\android\app\build\outputs\apk\release\app-release.apk`
  (about 212 MB). It points to the local backend through
  `EXPO_PUBLIC_API_URL=http://127.0.0.1:4000` plus
  `adb reverse tcp:4000 tcp:4000`, and launched without fatal startup logcat
  errors. This APK is for USB-connected QA only, not Play/internal distribution.
- 2026-06-29 OCR rebuild deployment check: the old Render backend ignored
  `forceOcr=true` and returned native Persian text, which made `Fix text` look
  unchanged on the phone. Commit `b1f6b79` was pushed to both
  `origin/codex/local-ai-voice-polish` and `origin/main`; after Render deployed,
  `https://readflow-backend-internal.onrender.com/api/health` returned
  `capabilities.forceOcr=true`. A direct Persian PDF request then returned
  `forceOcr=true`, `ocrPages=4`, and pending OCR for the remaining 25 pages.
- Latest phone install on Samsung `SM_G975F` (`R58M168KTSZ`) is the normal
  Render-connected APK:
  `C:\rf-mobile-test-voice2\android\app\build\outputs\apk\release\app-render.apk`.
  The USB/local-backend test APK was preserved beside it as `app-local-backend.apk`.
  When testing `Fix text`, the shelf/reader must show `OCR rebuild`; if not, the
  user is still viewing an old native import or an older backend response.
- 2026-06-29 release QA notes are in `RELEASE_QA_2026-06-29.md`. Synthetic
  fixtures passed native extraction for English, German/Norwegian, Russian,
  Chinese, Japanese, and Korean, and OCR extraction for scanned English,
  Russian, and Chinese. Real-document checks confirmed the exact Persian
  Distiller sample now opens as readable Persian text; good Persian text-layer
  books stay native; scanned Persian books route to OCR/pending pages for AI
  Pro and to `needsPaidOcr=true` for Reader Plus without spending OCR cost.
- Backend OCR workers now prefer local Tesseract language packs when present.
  The Docker image copies committed `.traineddata` files into `/app/tessdata`
  and uses `/tmp/readflow-tessdata` for downloaded/cached packs. Committed packs
  currently cover `ara`, `chi_sim`, `deu`, `eng`, `fas`, `jpn`, `nor`, and
  `rus`; other exposed OCR languages still depend on Tesseract.js runtime
  download/cache until packs are bundled or the UI copy marks them as first-use
  downloads.
- Phone smoke on Samsung `SM_G975F` after the backend QA launched installed
  app `1.0.18` / code `18` without fatal startup logcat lines. The phone was
  intentionally kept awake while plugged in for long QA with ADB stay-awake
  settings.
- 2026-06-29 owner-reported failed Persian PDF
  `G:\My Drive\Studies\Philosophy\book\__ ___ ____ ______ - ________ ____ ____ ____.pdf`:
  this is an encrypted/copy-disabled old Word/Ghostscript 7.04 PDF (`jafar.doc`,
  234 pages) whose pages are effectively scanned images. Native extraction is
  not a reliable path. Backend Persian OCR now uses `fas+ara` so Tesseract can
  borrow Arabic glyph statistics, normalizes Arabic `ك/ي/ى/ة` back toward
  Persian forms, thresholds Persian/Arabic OCR images for cleaner black text,
  strips standalone OCR page-number lines, and bumps the OCR cache version so
  old bad OCR pages are not reused. Local API test returned improved OCR for
  eager page 2 and on-demand page 5, but quality is still limited by the source
  scan; this is an AI Pro/Power OCR book, not a Reader Plus native-text book.
- 2026-06-29 multilingual generated-PDF QA is documented in
  `LANGUAGE_PDF_QA_2026-06-29.md`. The local folder `test-pdfs/` contains 21
  languages with clean/good/medium/poor/very-bad PDFs. Baseline clean and good
  scans passed for all 21 languages after correcting the scorer for CJK and
  normalizing RTL native text. Harder medium/poor scans are correctly routed to
  OCR but are not reliable enough to market as guaranteed recovery.
- 2026-06-29 English OCR cleanup: an owner report from a clean English book
  showed Tesseract spacing artifacts such as `snip er`, `Ap ache`, and
  `helicop ter`. Backend OCR now disables preserved inter-word spaces for
  Latin-script workers, keeps preserved spacing only for scripts where it helps
  readability, bumps the OCR cache version to `2026-06-29-latin-spacing-v5`,
  and runs a conservative Latin OCR word-break repair. Mobile `TextReflow` runs
  the same repair on saved OCR text so already-cached documents display better
  after an app update.

## Account Map

Do not commit passwords, API keys, private tokens, Play signing keys, Apple
certificates/profiles/API keys, RevenueCat secrets, or OpenAI keys. This repo
may contain public identifiers and service names only. Secrets live in the
service dashboards or the owner's password manager.

| Area | Account / owner | What it is used for | Notes |
| --- | --- | --- | --- |
| GitHub | `tmoradikh-png` | Source repository | Always use this account/repo owner for readFlow. Remote is `readflow-app`. User email given for account work: `t.moradi.kh@gmail.com`. |
| Expo / EAS | `tohid123` | Android builds and project ownership | Project is `tohid123/readflow`, projectId `097b0b5a-db90-46b4-b434-60836687b429`. User email given: `t.moradi.kh@gmail.com`. |
| Google Play Console | Urmia Works developer account | Internal testing and later production release | Android package is permanent: `com.urmiaworks.readflow`. Verify exact login email before release. |
| Apple Developer / App Store Connect | Urmia Works developer account (verify) | TestFlight and later App Store release | iOS bundle id is `com.urmiaworks.readflow`. App Store Connect app record and signing credentials still need owner verification before the first iOS build/submit. |
| Render | `support@urmiaworks.com` | Hosted backend | Production service name is `readflow-backend`; current reachable URL is the legacy subdomain `readflow-backend-internal.onrender.com`. |
| OpenAI | Owner-held account | AI, OCR assistance where applicable, and natural TTS | `OPENAI_API_KEY` must be set only in Render/local `.env`, never in mobile code. |
| RevenueCat | Planned / verify account | Production subscription entitlement source | Backend code supports `RC_SECRET_KEY`, but public subscription flow still needs final setup. |
| Urmia Works web | `urmiaworks.com` | Privacy/support URLs | App config points to `https://urmiaworks.com/readflow/privacy` and support email `support@urmiaworks.com`. |
| Codex | Owner's Codex account | Development assistant usage only | Codex subscription/account state is not part of app runtime and should not be stored in repo. |

Known public URLs and IDs:
- Expo build dashboard:
  `https://expo.dev/accounts/tohid123/projects/readflow/builds`
- EAS project id:
  `097b0b5a-db90-46b4-b434-60836687b429`
- Android package:
  `com.urmiaworks.readflow`
- iOS bundle id:
  `com.urmiaworks.readflow`
- Current backend URL in mobile config:
  `https://readflow-backend-internal.onrender.com`
- Privacy policy URL in mobile config:
  `https://urmiaworks.com/readflow/privacy`

## Secret Handling

Never add real secret values to documentation or source commits.

Secrets and where they belong:
- `OPENAI_API_KEY`: Render environment variable and local `backend/.env` only.
- `APP_KEY`: Render environment variable and mobile config/build env. The current
  mobile `extra.appKey` is present in `mobile/app.json`; treat it as a shared app
  gate, not a user secret. Rotate before public release if it has been exposed.
- `RC_SECRET_KEY`: Render environment variable only, when RevenueCat production
  entitlements are enabled.
- Play service-account JSON, Apple certificates/profiles/API keys, signing
  keys, EAS credentials: dashboards/secure storage only. EAS currently manages
  Android signing credentials remotely; iOS credentials are not verified yet.

If a developer needs access, invite them to the account/dashboard or give them
credentials through a password manager, not through Git.

Internal backend QA note from 2026-06-29: the source plan config grants
`cloudVoice: true` and `cloudVoiceCharsPerMonth: 60000` for `ai_pro`, but the
live `https://readflow-backend-internal.onrender.com` response returned
`features.cloudVoice: false` and `/api/health` returned `ttsProvider: device`.
Before testing Cloud AI on a phone, redeploy the internal Render service from the
current backend and verify:

```powershell
Invoke-RestMethod https://readflow-backend-internal.onrender.com/api/health
Invoke-RestMethod https://readflow-backend-internal.onrender.com/api/entitlements -Headers @{ 'x-app-key' = '<APP_KEY>' }
```

Expected internal results are `ttsProvider: cloud`, `tier: ai_pro`,
`features.cloudVoice: true`, and a non-zero `limits.cloudVoiceCharsPerMonth`.

Temporary connected-phone Cloud AI test used on 2026-06-29:
- Run local backend from `backend/dist/index.js` with
  `ENTITLEMENTS_DEV_OVERRIDE=true`, `DEV_DEFAULT_TIER=ai_pro`, `TTS_PROVIDER=cloud`,
  and the same `APP_KEY` as mobile.
- Verify `http://127.0.0.1:4000/api/tts` returns `audio/mpeg`.
- Run `adb reverse tcp:4000 tcp:4000`.
- Build/install a temporary APK with `EXPO_PUBLIC_API_URL=http://127.0.0.1:4000`.
  This APK is for USB-connected QA only; public/internal Render builds should use
  HTTPS Render URLs and should not enable cleartext traffic.
- If this temporary APK says it cannot reach the readFlow backend while the phone
  has internet, check the PC first: `GET http://127.0.0.1:4000/api/health` must
  return `ok: true`, and `adb reverse --list` must include `tcp:4000 tcp:4000`.
  In this setup, "server unreachable" usually means the local backend process
  stopped, not that the phone's Wi-Fi/mobile data is off.

## Local Workspace

Primary Windows workspace used during development:

```powershell
C:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow
```

Local Android tooling installed during the 2026-06-29 phone test:

```powershell
C:\Users\Greencom\android-sdk
C:\Users\Greencom\android-sdk\platform-tools\adb.exe
C:\Users\Greencom\android-platform-tools\platform-tools\adb.exe
C:\Users\Greencom\.cache\readflow-jdk17\jdk-17.0.19+10
```

Use these env vars for local native Android commands on this machine:

```powershell
$env:JAVA_HOME='C:\Users\Greencom\.cache\readflow-jdk17\jdk-17.0.19+10'
$env:ANDROID_HOME='C:\Users\Greencom\android-sdk'
$env:ANDROID_SDK_ROOT='C:\Users\Greencom\android-sdk'
$env:PATH="$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
```

If Java disappears from PATH, use the portable JDK above. It was downloaded from
Adoptium's official API because Android Gradle Plugin requires Java 17; the
older bundled `Common Files\i4j_jres` runtime is Java 11 and will fail native
builds.

Windows path warning: native builds from the OneDrive path hit long-path/CMake
problems. For local phone testing, use a short physical temp copy such as
`C:\rf-mobile-test`; mapping the mobile folder itself to a `subst` drive caused
Expo/Gradle mixed-root errors.

Important local design source for icons:

```powershell
C:\Users\Greencom\Downloads\Icon cleanup request\uploads\PDF Reader App Design (1)\app-icon-rF-clean.png
```

The source PNG is not merely decorative. The release icon pipeline depends on
that clean PNG because prior SVG/font re-renders produced bad icons.

## Architecture Map

Mobile:
- `mobile/App.tsx`: app shell, loads fonts, fetches entitlement snapshot, switches
  between library and reader.
- `mobile/app.json`: app version, package ids, icon/splash config, backend URL,
  EAS project id.
- `mobile/eas.json`: EAS build profiles. Internal Android builds create `.aab`;
  internal iOS builds create App Store/TestFlight archives.
- `mobile/src/components/Reader.tsx`: main reader, highlighting, controls,
  navigation, playback sequencing, OCR progress, AI entry point.
  It also controls screen keep-awake during playback, rotation re-anchoring,
  line-level highlight measurement, and TTS chunk/prefetch sequencing.
- `mobile/src/components/Controls.tsx`: sound, play/pause, stop, reading
  settings. Voice selection now lives on the shelf screen, not inside a book.
- `mobile/src/services/Preferences.ts`: persists reading voice preferences
  across app launches.
- `mobile/src/services/LocalNeuralVoice.ts`: Sherpa/Supertonic local voice status,
  model download, and local model path lookup.
- `mobile/plugins/withSherpaCodegenGradleFix.js`: Expo config plugin that patches
  generated `android/app/build.gradle` so Sherpa codegen runs before app CMake.
- `mobile/src/services/TextReflow.ts`: turns extracted page text into readable
  sentence units.
- `mobile/src/services/tts/*`: device, cloud natural voice, and local neural
  voice providers.
- `mobile/src/services/Entitlements.ts`: reads backend entitlement response and
  exposes feature flags to the app.
- `mobile/gen-clean-icons.js`: regenerates mobile icon assets from the clean
  source PNG.

Backend:
- `backend/src/index.ts`: Express app and route wiring.
- `backend/src/routes/pdf.ts`: PDF extraction/OCR route.
- `backend/src/routes/ai.ts`: AI summary/explain/Q&A route.
- `backend/src/routes/tts.ts`: cloud TTS proxy route.
- `backend/src/middleware/gate.ts`: entitlement resolution and feature gating.
- `backend/src/config/plans.ts`: tier definitions, features, and limits.
- `render.internal.yaml`: internal-test Render blueprint, dev override on.
- `render.yaml`: public-safe Render blueprint, dev override off.

## Build and Release Routine

The authoritative build process is in `RELEASE_GUIDE.md`. Always follow it.

Short version:
1. Check latest consumed Android build code:
   ```powershell
   cd C:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow\mobile
   npx --yes eas-cli build:list --platform android --limit 5 --json --non-interactive
   ```
2. Pick `highest appBuildVersion + 1`.
3. Update both:
   - `mobile/app.json`
   - `mobile/scripts/check-release-config.mjs`
4. Run:
   ```powershell
   npm run check:release
   npx tsc --noEmit
   ```
5. Commit and push the exact source to GitHub.
6. Start one paid EAS build:
   ```powershell
   npx --yes eas-cli build -p android --profile internal --non-interactive --no-wait
   ```
7. Add a row to the build ledger in `RELEASE_GUIDE.md` as soon as a build is
   started. Mark it finished and add the artifact URL once EAS finishes.
8. Upload the `.aab` to Google Play Console internal testing. Latest finished
   build 24 artifact:
   `https://expo.dev/artifacts/eas/A99FL8SxYSoTpYukWz-9miu4EvjVluCOsLIprGqQUDo.aab`.
   EAS submit is not automated yet because the Expo project does not have a
   Google Service Account JSON configured for Play upload.
9. On the phone, uninstall the old app before reinstalling. Android launchers and
   Play cache icons/version metadata aggressively.

iOS/TestFlight release prep is in `IOS_RELEASE_GUIDE.md`. Short version:
1. Check latest consumed iOS build number:
   ```powershell
   cd C:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow\mobile
   npx --yes eas-cli build:list --platform ios --limit 5 --json --non-interactive
   ```
2. If buildNumber `24` is still unused, keep `mobile/app.json` as
   `1.0.24` / `ios.buildNumber` `24`; otherwise bump only the iOS build number
   and `EXPECTED_IOS_BUILD_NUMBER`.
3. Run:
   ```powershell
   npm run check:release
   npx tsc --noEmit
   ```
4. Commit and push the exact source to GitHub.
5. Start one EAS iOS archive build only after Apple Developer/App Store Connect
   access is verified:
   ```powershell
   npx --yes eas-cli build -p ios --profile internal --non-interactive --no-wait
   ```
6. Add a row to the iOS build ledger in `IOS_RELEASE_GUIDE.md` and submit the
   finished build to App Store Connect/TestFlight when credentials are ready.

Local native smoke test without spending EAS quota:
1. Copy `mobile/` to a short physical path such as `C:\rf-mobile-test`, excluding
   `node_modules`, `.expo`, and generated `android/`.
2. Run `npm ci`.
3. Run `npx expo prebuild --platform android --clean`.
4. Run `.\android\gradlew.bat :app:assembleDebug -x lint -x test` or
   `npx expo run:android`.
5. If testing rF AI, open Voice, download/select rF AI, tap Listen,
   and watch logs for Sherpa model resolution and Android media-session playback.

Critical rule: never reuse an Android `versionCode`. EAS/Play consume codes even
when a build is only for testing or later rejected.

## Git Workflow

Default branch is `main`. The current working pattern has been:
- Make focused changes.
- Run release check and TypeScript.
- Commit with a short descriptive message.
- Push to GitHub before starting EAS builds.

Useful commands:

```powershell
git -c safe.directory=C:/Users/Greencom/OneDrive/Documents/aiChat/ReadFlow status --short --branch
git -c safe.directory=C:/Users/Greencom/OneDrive/Documents/aiChat/ReadFlow log --oneline -8
git -c safe.directory=C:/Users/Greencom/OneDrive/Documents/aiChat/ReadFlow push origin codex/local-ai-voice-polish
```

On this Windows machine, `git push` has occasionally hung inside Git Credential
Manager. If it hangs for a long time:
1. Check processes with `tasklist | findstr /I "git"`.
2. Kill only the stuck Git/Credential Manager PIDs with `taskkill /PID <pid> /F`.
3. Retry the push.

OneDrive note: `RELEASE_GUIDE.md` has sometimes appeared as modified with an
empty `git diff` because it is on OneDrive/reparse storage. Check `git diff
--name-only`; if it is empty, do not invent a docs change just to clear the
status.

## Icon Process

Read `RELEASE_GUIDE.md` first; it contains the detailed icon fix note.

Important facts:
- Use the designer clean PNG:
  `C:\Users\Greencom\Downloads\Icon cleanup request\uploads\PDF Reader App Design (1)\app-icon-rF-clean.png`
- Do not hand-render from SVG unless explicitly redesigning the brand.
- `icon.png` and `splash.png` should preserve the clean PNG.
- `adaptive-icon.png` is intentionally different: Android treats it as a
  foreground layer and crops/masks it, so the full artwork is scaled to `0.66`
  and centered with transparent padding.
- If a fresh install shows only cropped `rF`, reduce `ADAPTIVE_SCALE` in
  `mobile/gen-clean-icons.js` to something like `0.60`, regenerate icons, bump
  versionCode, rebuild, uninstall, and reinstall.

Regenerate icons:

```powershell
cd C:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow\mobile
node gen-clean-icons.js
```

## Backend and Entitlements

The backend is the source of truth for paid features. The mobile app should only
use feature flags for UI; cost-bearing routes must be protected on the backend.

Internal testing:
- Render service: `readflow-backend-internal`
- Blueprint: `render.internal.yaml`
- `ENTITLEMENTS_DEV_OVERRIDE=true`
- `DEV_DEFAULT_TIER=ai_pro`
- Everyone can test paid features. Do not use this config for public release.

Public release:
- Render service name: `readflow-backend`
- Current URL: `https://readflow-backend-internal.onrender.com`
- Blueprint: `render.yaml`
- `ENTITLEMENTS_DEV_OVERRIDE=false`
- `RC_SECRET_KEY` must be set to the production RevenueCat secret before paid
  subscriptions are sold.
- Backend fails closed to free tier if RevenueCat is unavailable or no valid user
  id is present.

Important backend routes:
- `GET /api/health`
- `GET /api/entitlements`
- `POST /api/pdf/extract`
- `POST /api/ai`
- `POST /api/tts`

Natural voice currently calls backend `/api/tts`, which calls OpenAI TTS using
server-only `OPENAI_API_KEY`. The mobile app never receives the OpenAI key.
Cloud AI voice is capped by plan:
- AI Pro: 45,000 characters/month.
- Power: 100,000 characters/month.
See `COST_MODEL.md` before changing cloud voice allowances; unlimited cloud
voice is not economically safe at the current paid prices.

AI text actions:
- `POST /api/ai` handles Summary, Explain, Simplify, Key points, and Ask.
- Each non-cached AI action can spend OpenAI text-model tokens.
- AI Pro includes 150 AI actions/month; Power includes 400/month.
- Free and Reader Plus must not call the AI route.

## Audio and Highlighting Notes

Cloud voice:
- `mobile/src/services/tts/CloudTTSProvider.ts`
- Uses backend `/api/tts`.
- Caches audio in app cache.
- Prefetches upcoming text from the reader to reduce paragraph gaps.
- Uses the selected cloud voice from shelf preferences.
- Falls back to the selected device voice if cloud voice is offline or over
  quota, and shows a one-time allowance message.
- Uses `expo-audio` with `shouldPlayInBackground: false`; all reading audio is
  foreground-only in the current product.
- Keeps the native player alive between clips to avoid unnecessary handoff
  pauses.
- Has a short tail guard to avoid cutting off final words.

Leaving the app/reader:
- The reader explicitly stops playback on back/unmount so voice does not keep
  reading after returning to the library.
- Current source treats all reading audio as foreground-only. The reader keeps
  the screen awake while playback is active, and stops playback when the app
  leaves the foreground, which covers screen lock, Home, and app switch.
- Lock-screen audiobook mode is intentionally not active right now. If product
  later allows lock-screen playback, add explicit native media-session controls
  and QA the distinction between lock, Home, and app switch.
- Large scanned books can continue OCR across multiple months: the app keeps the
  original file in local library storage, caches OCR'd pages, saves pending OCR
  pages, pauses with an explanation when monthly OCR quota is reached, and can
  re-upload the local file later to mint a fresh OCR token after quota reset.
- Background OCR can now be paused/resumed/stopped by the user.
  `OcrLoader.pause()` stops new OCR page requests after the current batch, keeps
  completed pages saved in `DocCache`, and `OcrLoader.resume()` continues from
  the remaining pending pages. `OcrLoader.stop()` cancels the background job,
  keeps completed cached pages, and lets the user start `Fix text` again later.
  Reader and Library both expose OCR controls while a job is active.
- React Native cannot always distinguish phone lock from Home/app switch in JS.
  If exact "paid lock continues, Home/app switch stops" behavior becomes
  mandatory for natural voice too, add a small native Android signal/module
  later.

Highlighting:
- TTS still reads natural chunks. Do not reduce chunk/buffer size just to make
  the highlight smaller.
- Current source maps playback progress to the active rendered line, so the UI
  highlights one line while the voice keeps natural audio.
- Exact word-level sync would require timestamp data from the TTS provider. The
  current backend returns MP3 audio only, not word timings.

rF AI voice:
- Current implementation uses `react-native-sherpa-onnx` and
  `@dr.pogodin/react-native-fs`.
- Current model: `sherpa-onnx-supertonic-tts-int8-2026-03-06` (Supertonic
  Reader/rF AI), downloaded on demand from the Sherpa model release.
  Compressed download is about 81 MB; the model is not bundled in the app
  package.
- Playback uses `LocalNeuralTTSProvider`, which generates WAV clips on-device,
  caches them in app cache, and reports progress through the same line-highlighter
  path as cloud voice.
- The dev-only warning
  `SherpaOnnxModelList: Unsupported model espeak-ng-data` is from Sherpa's model
  catalog seeing a support-data folder in the downloaded local model. It is not a
  playback failure. The app suppresses that warning in LogBox and avoids refreshing the
  full model catalog during ordinary status checks.
- If native support/model download is missing, the provider stops rF AI playback
  and shows a one-time "rF AI not ready" message instead of silently switching
  to Phone voice.
- Treat rF AI as unlimited from readFlow's billing perspective because it uses
  phone CPU/battery instead of OpenAI. Product can still decide to make it a paid
  perk, but it has no per-character vendor bill.
- Kokoro/ExecuTorch remains a possible higher-quality future option, but it is
  too large/heavy for this first lightweight implementation.

## Validation Checklist Before a Build

Always run:

```powershell
cd C:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow\mobile
npm run check:release
npx tsc --noEmit
```

Recommended manual phone tests after installing a new build:
- Fresh install icon: red spine visible, no cropped `F`.
- Import a normal PDF and verify reflowed reading.
- Toggle Sound on/off.
- Open Voice on the shelf, select a device voice, and verify the reader uses it.
- Open the language selector, choose a non-English language, and verify:
  new imports send the matching OCR language, the Voice sheet filters phone
  voices for that language, AI answers use that language, and rF AI explains
  that only English is available for now.
- For Persian/Arabic specifically, select the language before import/reopen.
  If a book was cached from an older broken extraction, reopening with Persian
  should re-extract instead of using the old English/unknown cache. If the
  source file itself has been deleted, remove and reimport the book.
- In the reader settings menu, switch between Device, rF AI, and Cloud AI.
  Cloud AI should upsell cleanly when the plan is not AI Pro/Power.
- Select Cloud AI under an AI Pro/Power entitlement and verify `/api/tts`
  consumes cloud voice characters, not generic AI actions.
- Open Voice, download rF AI, select it, and verify the first
  paragraph generates locally, then subsequent/repeated paragraphs play from
  cache.
- rF AI currently keeps six upcoming chunks warm and normalizes speech-only
  text before synthesis (ligatures, hidden soft hyphens, typographic quotes,
  and obvious app/document acronyms). Keep this conservative; broader word
  rewrites can create new mispronunciations.
- AI voice modes must never silently downgrade to Device voice. If rF AI is
  not in the plan, not downloaded, or not supported for the language, show the
  themed upgrade/download explanation. If Cloud AI is not in the plan or
  allowance, show the plan/allowance sheet. Device voice is the only silent
  fallback users should ever hear.
- Reader manual scrolling disables Follow and ignores word taps until the drag
  settles. This prevents accidental chrome/padding changes while scrolling,
  which can look like the page jumps backward.
- Device voice reads in sync.
- Natural/cloud voice reads the same text, highlights the current line, and does
  not skip final words.
- rF AI reads the same text and highlights the current line. If the model is
  missing or unsupported, it stops and shows the download/upgrade explanation.
- Paragraph handoff feels acceptable.
- Let playback continue in the foreground and confirm the screen stays awake.
- Press Home/app-switch/lock while any voice is reading and confirm playback
  stops promptly.
- Open a saved book, rotate while reading, use page navigation, and jump to a
  bookmark; each should land directly without visibly scrolling through pages.
- Back out to Library and confirm playback stops.
- AI button opens, summary/explain/Q&A route works under internal paid override.
- Scanned PDF/OCR path shows correct paid messaging and progress.
- Offline/poor-network states do not crash.

Later multilingual backlog:
- Per-book language memory instead of one global `bookLanguage` preference.
- Server-driven rF AI model catalog with language, model id, size, quality,
  and download URL so new language packs do not require an app rebuild.
- rF AI voice packs for priority markets after quality/size review. Start
  with Spanish, French, German, Arabic, Turkish, and Persian if good compact
  models are available.
- Language auto-detect from the first native-text/OCR pages, with user
  confirmation before spending OCR quota.
- Mixed-language books and per-section language switching.
- Local/Edge OCR on strong phones. This is separate from rF AI voice and needs
  a different OCR engine/model.

## Known Risks / Follow-ups

- Free-limit and file-limit errors currently can read like a hard stop, for
  example "quota used" or "file too long". Next UX pass should route these
  states to a themed upgrade/paywall prompt with a short explanation, plan
  comparison, and retry action after purchase/restore.
- The release app now requests only `INTERNET`, but keep `npm run check:release`
  as a hard gate because a generated native `mobile/android/` folder can
  reintroduce stale permissions or version codes.
- Public paid subscriptions are not fully wired until RevenueCat production
  setup and mobile RevenueCat SDK/user id headers are complete.
- iOS/TestFlight is prepared in config/docs but not built or device-tested yet.
  Verify Apple Developer/App Store Connect access, EAS iOS credentials, and
  rF AI/Sherpa behavior on a real iPhone before any public App Store submission.
- The current production Render service is named `readflow-backend`, but its
  legacy URL still contains `readflow-backend-internal`. Dev override is off and
  Free entitlements were verified; prefer moving to a custom API domain before
  broad public launch to avoid confusion.
- `APP_KEY` in mobile config is visible to anyone who decompiles the app. It is a
  basic app gate, not strong user authentication.
- OCR can be memory-heavy. If using public production traffic, prefer Render
  Starter/Standard over Free.
- OpenAI usage costs money. Monitor backend logs and rate limits when broadening
  testing.
- AI voice packs/top-ups are only a product path today. Store billing/RevenueCat
  purchases are not wired in this build, so the app must not present a fake paid
  purchase button.
- Current free-tier code/config does not yet match the latest product intent of
  1 free book and about 100 pages. See `COST_MODEL.md`.
- UI exposes OCR languages beyond the `.traineddata` packs committed into the
  backend image. Missing packs can download at runtime through Tesseract.js, but
  this adds first-use latency and a Render network dependency. Before public
  launch, either bundle all advertised OCR packs during the Docker build or make
  the product copy explicit that some OCR languages are server-downloaded on
  first use.

## Release Notes Template

Use this compact format for Play internal testing:

```text
readFlow X.Y.Z
- Main user-visible fix or improvement.
- Voice/highlight/import/OCR changes.
- Icon/build/backend note if relevant.
```

## Documentation Rule

When a developer changes accounts, service URLs, build codes, entitlement
behavior, pricing/cost assumptions, icon process, release process, or any
production-impacting workflow, update this file and any specialized guide
(`RELEASE_GUIDE.md`, `IOS_RELEASE_GUIDE.md`,
`BACKEND_FEATURE_ENFORCEMENT.md`, or `COST_MODEL.md`) in the same commit.
