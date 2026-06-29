# readFlow Android Release Guide (Play Store)

App: **readFlow** · Package: **com.urmiaworks.readflow**
Org: Urmia Works · Android package is permanent after first Play upload

EAS account: **tohid123** · Project: **tohid123/readflow**
(projectId `097b0b5a-db90-46b4-b434-60836687b429`)

For the full account map, service ownership, current build state, and takeover
notes, start with **[PROJECT.md](PROJECT.md)**.

For paid launch prep, also read **[PAYMENT_SETUP.md](PAYMENT_SETUP.md)** and
**[PLAY_RELEASE_PACKET.md](PLAY_RELEASE_PACKET.md)**. Legal/app-content drafts
are in **[PRIVACY_POLICY_DRAFT.md](PRIVACY_POLICY_DRAFT.md)**,
**[TERMS_OF_USE_DRAFT.md](TERMS_OF_USE_DRAFT.md)**, and
**[PLAY_DATA_SAFETY_DRAFT.md](PLAY_DATA_SAFETY_DRAFT.md)**.

> **Sections 0–5 below are the original first‑time setup guide.**
> **If you just want to ship a new version, read [TL;DR — Cut a NEW build](#tldr--cut-a-new-build-do-this-every-release) first.**

---

## Public Release Gate — 2026-06-29

Current source release candidate: **1.0.23 / Android versionCode 23**.

What is already prepared in source:
- `mobile/app.json` points at the public backend host
  `https://readflow-backend.onrender.com`.
- `npm run check:release` now blocks internal Render URLs, duplicate Android
  permissions, Android microphone permission, background-audio declarations,
  missing app-user-id support, stale version numbers, and unsafe public Render
  dev-override blueprints.
- Android permissions are intentionally minimal for Play review: `INTERNET`.
  `expo-audio` is configured with `recordAudioAndroid:false` and
  `microphonePermission:false`.
- Free tier is a limited manual-reading preview: 1 document/month, first 100
  pages of native-text documents, no Listen/read-aloud, no OCR, no rF AI, no
  Cloud AI, and no AI Q&A.
- The mobile app sends a locally generated `x-app-user-id` so free backend
  quotas are per install instead of one global `"anonymous"` bucket.

Do **not** upload a public production release until these account/server items
are complete:
- Production Render service `readflow-backend` is deployed and
  `https://readflow-backend.onrender.com/api/health` returns `200`.
  On 2026-06-29 it returned `503`; the internal service
  `readflow-backend-internal` was healthy but must not be used for public
  release because it grants dev paid access.
- Render production env has `ENTITLEMENTS_DEV_OVERRIDE=false`,
  production `APP_KEY`, production `OPENAI_API_KEY`, and production
  `RC_SECRET_KEY` if subscriptions are sold.
- Play Billing/RevenueCat mobile SDK is not wired yet. Until that is done, a
  public build can only be a free-preview app with paid features locked and
  purchase buttons unavailable. To sell Reader Plus / AI Pro / Power, add the
  SDK, configure Google Play products, RevenueCat offerings/entitlements, and
  send RevenueCat's app-user id to the backend.
- Privacy policy URL must be live and must explain document upload/extraction,
  OCR, AI requests, cloud voice, OpenAI processing, local rF AI downloads, and
  deletion/contact flow.
- Play Console App content must be complete: Data safety, privacy policy,
  target audience, ads declaration, content rating, and review access notes.
- Play Store listing, review notes, subscription disclosure, privacy/terms
  drafts, and Data Safety worksheet are now prepared in the release packet files
  linked at the top of this guide. Review them before submitting anything to
  Play.

For a real paid launch, the order is:
1. Deploy/fix production Render backend.
2. Wire Play Billing/RevenueCat in mobile and test sandbox purchases.
3. Run `npm run check:release`.
4. Run an EAS Android production/internal AAB build with a new versionCode.
5. Upload to Play internal testing first, then promote after phone QA.

---

## TL;DR — Cut a NEW build (do this EVERY release)

This is the recurring routine. Follow it in order. **Each EAS build costs paid
quota, so do not skip the version‑bump and check steps.**

All commands run from `ReadFlow/mobile` on Windows PowerShell:

```powershell
cd c:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow\mobile
```

### Step 1 — Find the next free versionCode (CRITICAL — money saver)

> 🛑 **The #1 mistake: reusing a versionCode.** A `versionCode` is consumed the
> moment a build is **made** (not just when uploaded to Play). If you build with a
> code that already has a build, that build is wasted and the bundle is rejected by
> Play ("Version code N has already been used"). **Always pick a code strictly
> higher than the highest EXISTING EAS build.**

Check the highest existing build code:

```powershell
npx --yes eas-cli build:list --platform android --limit 5 --json --non-interactive `
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{JSON.parse(s).forEach(b=>console.log(b.appVersion+'/'+b.appBuildVersion+' '+b.status+' '+b.id.slice(0,8)))})"
```

The first line is the most recent build. **Next free code = highest `appBuildVersion` + 1.**
(Also see the [Build ledger](#build-ledger) at the bottom of this file.)

### Step 2 — Bump the version in two files

Set `versionCode` to the next free code and bump the version name. Both must agree.

1. `mobile/app.json`:
  - `expo.version` → e.g. `"1.0.23"`
  - `expo.ios.buildNumber` → `"23"`
  - `expo.android.versionCode` → `23`
2. `mobile/scripts/check-release-config.mjs` — update the three expected values to
   match (it hard‑checks `versionCode` and `version` so a stale bump fails loudly):
   - `EXPECTED_VERSION_CODE`
   - `EXPECTED_VERSION`
   - and their two `fail(...)` message strings.

### Step 3 — (If the icon changed) regenerate icons from the CLEAN source

> 🛑 **Do NOT re‑render the icon from SVG by hand** — that has repeatedly produced
> broken/"terrible" icons. Always start from the designer's clean PNG.

```powershell
# back up the current icons first (timestamped)
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Force "assets\_backup_icons\build_$ts" | Out-Null
Copy-Item assets\icon.png,assets\adaptive-icon.png,assets\favicon.png,assets\splash.png "assets\_backup_icons\build_$ts\"

# regenerate icon.png + adaptive-icon.png + favicon.png from the clean source
node gen-clean-icons.js
```

- Source PNG: `C:\Users\Greencom\Downloads\Icon cleanup request\uploads\PDF Reader App Design (1)\app-icon-rF-clean.png`
- `gen-clean-icons.js` produces:
  - `icon.png` — full‑bleed, red book‑spine flush to the **left edge** (for iOS/Play; no mask is applied there).
  - `adaptive-icon.png` — the **whole mark scaled to 0.66 and centered on transparent padding** so the
    red spine stays **inside the Android adaptive safe zone** and survives the launcher
    mask. (Earlier builds put the spine at the literal edge → Android cropped it off →
    the launcher showed only "rF". The 0.66 foreground scale fixes that.)
- **Verify before building** (Android launchers mask the icon to a circle or squircle):
  preview both masks and eyeball that the red spine survives. A quick check is to open
  `assets/adaptive-icon.png` and confirm the spine sits well inside the left margin, not at
  the pixel edge.
- `adaptiveIcon.backgroundColor` in `app.json` must stay cream `#F4ECD6` (matches the fill).

### Step 4 — Validate, then build (one paid build)

```powershell
npm run check:release    # must print "Release config check passed"
npx --yes eas-cli build -p android --profile internal --non-interactive --no-wait
```

`--no-wait` returns immediately with a build URL. Watch progress at
https://expo.dev/accounts/tohid123/projects/readflow/builds

### Step 5 — Record it & upload

1. Add a row to the [Build ledger](#build-ledger) (build id, version/code, what changed).
2. When the build finishes, **download the `.aab`** from the EAS build page.
3. Play Console → readFlow → **Testing → Internal testing → Create new release** →
   upload the `.aab` → Save → Review → **Roll out**.
4. Wait until the release shows **Available** to testers.

### Step 6 — Test on the phone (icon/version cache)

> The Android launcher caches the old icon and Play caches the old version. To see a
> new icon or version: **uninstall** the old readFlow from the phone, then **reinstall**
> from the Play internal‑testing link. A plain in‑place update may keep the old icon.

If the build includes rF AI voice, test it only in the fresh native build:
open Voice, download the Supertonic Reader/rF AI voice, select it, and
verify local reading/highlighting. Expo Go and older installed builds cannot
test the Sherpa native module.

Current readFlow QA checklist for any build that changes reading/voice:
- Fresh-install the app and verify the launcher icon shows the full clean book
  mark, including the red spine.
- Open Voice and confirm the choices read as Device voice, rF AI, and Cloud
  AI; Android raw voice ids should not dominate the UI.
- Tap locked/limited Voice options and invalid navigation inputs; warnings
  should use the readFlow themed notice, not a dark native Android alert.
- For Cloud AI phone QA, verify the backend first: internal testing should
  return `tier: ai_pro`, `features.cloudVoice: true`, non-zero
  `cloudVoiceCharsPerMonth`, and `/api/health` should report
  `ttsProvider: cloud`.
- Open Book language, choose a non-English language, then reopen Voice. Phone
  voices should filter to that language, rF AI should say English-only for
  now, and new scanned imports should use the matching OCR language.
- For Persian/Arabic, import both a native-text PDF and a scanned/image PDF.
  Reopen any previously cached broken Persian book after selecting Persian; it
  should re-extract instead of showing stale mojibake text.
- For Persian/Arabic and at least one other non-Latin script (Russian, Hindi,
  Thai, Korean, Japanese, or Chinese), also test a PDF whose extracted text
  contains mojibake or Latin artifacts inside non-Latin words. It should be
  classified as OCR-needed, not as a good text-layer book. Persian is only the
  example that exposed the bug.
- Regression sample: `G:\My Drive\Studies\Philosophy\book\____ _____._.pdf`
  should render/read without the old A-like `ѧ` artifacts and without inline
  footnote-star clutter or page-bottom footnote blocks. It should stay a
  native-text repair case by default, and AI Pro/Power should offer `Fix text`
  to rebuild the saved PDF with OCR when the visual PDF and imported text do not
  match.
- While `Fix text` is running, the same book must show visible progress and must
  not allow a second OCR rebuild to start. Reopen the book after leaving the
  reader and verify it stays on the forced-OCR cache/token path instead of
  falling back to the native text layer.
- For multilingual native-text PDFs, verify line/sentence order by reading a few
  paragraphs aloud visually. Do not accept a test that only proves the letters or
  words exist; Persian/Arabic can have correct words in the wrong order if PDF
  item sorting regresses.
- For Persian specifically, test both a text-layer book and a scanned book. A
  text-layer book such as `zayesh-tragedy-az-jan` should import without OCR.
  Scanned books such as `Tabar_Shenasiye_Akhlagh` should show OCR-required
  messaging on Free/Reader Plus and should not show watermark/garbage placeholder
  lines while AI Pro/Power OCR is pending.
- Start playback on a multilingual book and confirm the voice does not read page
  numbers, repeated headers/footers, or URL watermarks such as `www...`.
- Proper text-layer PDFs in Reader/free-style testing should not consume OCR and
  should not show an OCR upsell just because the file has one blank or decorative
  page.
- Open the reader settings menu and confirm the quick selector reads Device,
  rF AI, and Cloud AI. Locked Cloud AI should open a clean upgrade prompt.
- Download/select rF AI, play several paragraphs, and check for natural
  enough voice quality, short paragraph gaps, and line highlight following the
  spoken text.
- For Persian, Cloud AI voice should be unavailable/QA-labeled and the app
  should recommend Phone voice until a Persian voice passes quality testing.
- Rotate the phone while reading; the current line should re-anchor instead of
  scrolling through the book.
- Open a saved book, jump to a bookmark, and use page navigation; each should
  land directly without visibly traveling through pages.
- Let playback run long enough that Android would normally dim/lock; the screen
  should stay awake while playback is active.
- Press Home/app-switch/lock while any voice is reading; playback should stop
  promptly instead of finishing the paragraph.
- Remove the current/continue book and a normal library book; both should
  disappear and remain gone after restart.

Local AI build note: `mobile/plugins/withSherpaCodegenGradleFix.js` is required.
It patches generated `android/app/build.gradle` during Expo prebuild so the app
CMake task waits for `react-native-sherpa-onnx` codegen. Without that plugin, a
clean native build can fail because
`react-native-sherpa-onnx/android/build/generated/source/codegen/jni` does not
exist yet. It also adds a Windows-only normalizer for generated `.so` outputs so
Gradle can package local debug builds from a short temp path.

To test a native build locally before spending EAS quota, use a short physical
path on Windows:

```powershell
# example temp workflow
$env:JAVA_HOME='C:\Users\Greencom\.cache\readflow-jdk17\jdk-17.0.19+10'
$env:ANDROID_HOME='C:\Users\Greencom\android-sdk'
$env:ANDROID_SDK_ROOT='C:\Users\Greencom\android-sdk'
$env:PATH="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

robocopy C:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow\mobile C:\rf-mobile-test /E /XD node_modules android .expo
cd C:\rf-mobile-test
npm ci
npx expo prebuild --platform android --clean

# Standalone phone QA: bundles JavaScript into the APK, so the app opens without Metro.
$env:NODE_ENV='production'
.\android\gradlew.bat -p android :app:assembleRelease -x lint -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease
adb install -r .\android\app\build\outputs\apk\release\app-release.apk

# Debug/dev QA: starts Metro. Do not install a raw assembleDebug APK unless Metro
# is running and adb reverse tcp:8081 tcp:8081 is configured.
npx expo run:android
```

The OneDrive workspace path can exceed Windows/CMake path limits. A `subst` drive
mapped too deep also caused mixed-root errors, so prefer a real short temp copy.
If Gradle fails on Windows with `Cannot snapshot ... .so: not a regular file`,
normalize reparse-point `.so` files under the named Gradle cache/build path and
rerun the same command. This is a local Windows/OneDrive/Gradle issue, not an app
runtime issue.

### Icon troubleshooting note — if a fresh install still shows cropped `rF`

Symptom: the launcher icon shows only `rF`, the red book spine is missing, or the
right side of `F` is clipped even after uninstalling and reinstalling.

Cause: Android adaptive icons are not the same as the normal app icon. Android
takes `assets/adaptive-icon.png` as a foreground layer and then applies a launcher
mask/zoom. If the approved icon is used edge-to-edge as the adaptive foreground,
some launchers crop the spine and outer letters.

Fix:
1. Keep `assets/icon.png` and `assets/splash.png` as the exact clean PNG.
2. In `mobile/gen-clean-icons.js`, reduce `ADAPTIVE_SCALE` slightly (current
   value: `0.66`; try `0.60` if a launcher still crops it).
3. Run `node gen-clean-icons.js` from `ReadFlow/mobile`.
4. Open `assets/adaptive-icon.png` and confirm the whole book mark sits well
   inside the transparent padding.
5. Bump to a new Android `versionCode`, rebuild, uninstall the old app, then
   reinstall from the Play internal-testing link.

---

## 0) CRITICAL — Deploy the backend first (the app cannot work without it)

PDF text extraction, OCR, AI, and the natural voice **all run on your backend**. A released
`.aab` has no Expo dev server, so it will try `localhost` and do nothing.

**You must:**
1. Deploy `ReadFlow/backend` to a public **HTTPS** URL.
   - Render-ready files are included now: `backend/Dockerfile`, `backend/.dockerignore`,
  and split Blueprint files:
  - `render.internal.yaml` for internal testing on Render Free (dev override on)
  - `render.yaml` for public release (dev override off, production-safe default)
  - fallback equivalents for parent-repo roots: `backend/render.internal.yaml`, `backend/render.yaml`
   - In Render, create from Blueprint (or manual Docker service) and set secret env vars:
     `OPENAI_API_KEY` and `APP_KEY`.
   - Non-secret env is already documented in `render.yaml` (`AI_PROVIDER`, `OPENAI_MODEL`,
     `TTS_PROVIDER`, `TTS_MODEL`, `TTS_VOICE`, `OCR_ENABLED`, `RATE_*`, etc.).
   - **IMPORTANT: AI feature enforcement.** See `BACKEND_FEATURE_ENFORCEMENT.md` for complete details.
     - For internal testing: Use `ENTITLEMENTS_DEV_OVERRIDE=true, DEV_DEFAULT_TIER=ai_pro`
       (all testers get paid features, no RevenueCat needed).
     - For public v1: Set `ENTITLEMENTS_DEV_OVERRIDE=false` and `RC_SECRET_KEY` to your RevenueCat 
       production secret (free users cannot access AI/OCR/TTS).

2. Put the deployed backend URL and app key in `mobile/app.json`:
   - `expo.extra.apiUrl` = `https://<your-render-host>.onrender.com`
   - `expo.extra.appKey` = same value as backend `APP_KEY`
   - Both can also be supplied via `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_APP_KEY`.
3. Rebuild the `.aab` (below).

> For internal testing only, you *can* run the backend on your PC and use a tunnel
> (e.g. `cloudflared tunnel --url http://localhost:4000`) and paste that HTTPS URL into
> `extra.apiUrl` (and set `extra.appKey` if APP_KEY is enabled). Fine for testing,
> not for production.

### Render quick setup (Internal Testing on Free tier)
1. Push this repo to GitHub (if not already).
2. Render dashboard → **New +** → **Blueprint** → connect repo.
3. Choose `render.internal.yaml` (or `backend/render.internal.yaml` if repo root is parent workspace).
4. Confirm service builds Docker image and uses Free plan.
5. Add secret env vars in Render service settings:
   - `OPENAI_API_KEY`: your OpenAI key
   - `APP_KEY`: random long secret string (same one you put in mobile `extra.appKey`)
   - **Do NOT set `RC_SECRET_KEY` yet** (internal testing uses dev override)
6. Wait for deploy success, then verify:
   - `GET https://<service>.onrender.com/api/health` returns `{ ok: true, ... }`
7. Test the enforcement:
   - Free user (no auth) accessing AI should get 402: `curl -X POST https://<service>.onrender.com/api/ai -H "Content-Type: application/json" -d '{"task":"summary","text":"test","language":"en"}'`
   - See `BACKEND_FEATURE_ENFORCEMENT.md` for full testing suite.

### Render upgrade for public v1 (Starter/Standard tier)
Before public release, upgrade the Render plan and disable dev override:
1. Deploy with `render.yaml` (or `backend/render.yaml` if repo root is parent workspace).
2. Confirm `ENTITLEMENTS_DEV_OVERRIDE=false`.
3. Set `RC_SECRET_KEY` to your RevenueCat production secret.
4. Use Starter or Standard plan for production reliability.
5. Re-deploy. Now only users with active RevenueCat subscriptions can access AI/OCR/TTS.

---

## 1) Build the Android App Bundle (.aab)

Already configured in `mobile/eas.json` (profile `internal` → `app-bundle`, release build).

```powershell
cd ReadFlow/mobile
npm install -g eas-cli      # if not installed
eas login                   # your Expo account
eas build:configure         # first time only, links the project
eas build -p android --profile internal
```

- EAS creates and stores a **release keystore** for you (recommended). Say **yes** to let EAS
  manage signing. Back it up later via `eas credentials`.
- The result is a downloadable **.aab** (release, signed). No debug build is produced.

Confirmations (all already set in `app.json`):
- ✅ applicationId / package: `com.urmiaworks.readflow` (permanent once uploaded)
- ✅ versionCode: `1` · versionName: `1.0.0`
- ✅ Release signing: EAS‑managed keystore (or Play App Signing)
- ✅ Target SDK: Expo SDK 54 → targetSdk 35 (Play‑accepted)
- ✅ Permissions: `INTERNET` only (no location / contacts / SMS)
- ✅ No debug build (internal profile is a release app‑bundle)

---

## 2) Upload to Internal Testing

Play Console → your app → **Testing → Internal testing → Create new release**.
- Upload the `.aab`.
- Add testers (an email list or a Google Group). Save → Review → **Roll out**.
- Share the opt‑in link with your testers; they install via Play.

(Optional CLI submit: `eas submit -p android --profile internal` after configuring a Google
service‑account key in Play Console → Setup → API access.)

---

## 3) Fill out the required Play Console sections

### Store listing  (Main store listing)
- Use the current copy in **[PLAY_RELEASE_PACKET.md](PLAY_RELEASE_PACKET.md)**.
- **App name:** readFlow
- **Short description:** keep under 80 characters and mention PDFs/Word,
  phone reading, voice, and AI without promising perfection.
- **Full description:** mention supported PDFs, text-based Word `.docx`, Phone
  voice, rF AI, capped Cloud AI, OCR on AI plans, bookmarks, and AI help.
  Do **not** promise "free AI forever", unlimited cloud voice, perfect OCR, or
  every language/document.
- **App icon:** 512×512 PNG (export from `assets/icon.png`).
- **Feature graphic:** 1024×500 PNG.
- **Phone screenshots:** 2–8, 16:9 or 9:16 (use the app on your S10).
- **Category:** Books & Reference. **Tags:** reading, audiobook, accessibility.
- **Contact email:** support@urmiaworks.com.

### App content (Policy → App content) — complete every item:

**Privacy policy**
- Provide a public URL: `https://urmiaworks.com/readflow/privacy` (must be live before review).
- It must state what you collect (PDF text is sent to your server for processing & to OpenAI
  for AI/voice), that you don't sell data, and how to contact you.

**Data safety** (Play form)
- Data collected/shared: declare **Files/Docs** — the PDF content is sent to your server and to
  OpenAI to generate text/audio. Mark it as **processed**, not sold.
- If you log nothing personal and store no accounts, say so. Be honest and minimal.
- Security: data encrypted in transit (HTTPS) ✓. Provide a way to request deletion (email).

**Content rating** (questionnaire)
- Category: Reference/Books. Answer "No" to violence/sexual/gambling/etc. → likely **Everyone**.

**Target audience and content**
- Target age: **18+** (or 13+) to avoid the stricter Families policy for v1. Do **not** target
  children. Confirm the app isn't designed for kids.

**Ads**
- Declare **No, my app does not contain ads** (you're not shipping ads in v1).

**App access**
- If all features are usable without login (they are), choose **"All functionality is available
  without special access"**. If anything were gated, you'd provide test credentials here.

**Government apps / Financial / Health:** No to all (no medical/health claims).

**News app:** No.

### Production countries / availability
- For internal testing, pick the countries where testers live. For later production, select
  the countries you want to distribute in.

---

## 4) Policy‑safe checklist for v1 (intentionally minimal)

For a paid release, this older minimal checklist is superseded by
`PAYMENT_SETUP.md` and `PLAY_RELEASE_PACKET.md`. Keep this section only for a
free/internal preview build where purchases are not live.

- ✅ No subscriptions / no in‑app purchases yet.
- ✅ No AI paid limits / paywall (paywall code is inert; `ENFORCE_FREE_LIMIT=false`).
- ✅ Permissions: INTERNET only. No microphone, background location, contacts, SMS, call log.
- ✅ No medical/health claims. No misleading "free AI" wording in the listing.
- ✅ Core features shipped: PDF import · read‑aloud (device + natural voice) · OCR fallback ·
  remembers reading position · font/spacing/speed settings · privacy policy · support contact.

Add payments + AI usage limits **after** this first stable release and after the backend
billing/rate‑limiting is proven in production.

---

## 5) Quick command reference

```powershell
# regenerate the rF icon from the clean source PNG (NOT from SVG)
cd ReadFlow/mobile; node gen-clean-icons.js

# show the highest existing Android build code (next free code = that + 1)
npx --yes eas-cli build:list --platform android --limit 5 --json --non-interactive

# validate public release config before building (checks versionCode/version/apiUrl/appKey)
npm run check:release

# build the release .aab for internal testing (one paid build)
npx --yes eas-cli build -p android --profile internal --non-interactive --no-wait

# (optional) submit straight to the Play internal track
eas submit -p android --profile internal
```

```powershell
# backend local smoke test (with app key enforcement enabled)
cd ReadFlow/backend
$env:APP_KEY = "your-secret"
npm run dev
# then call /api/health and verify protected routes need x-app-key
```

---

## Build ledger

Append a row **every** time you start a build. `versionCode` must always increase and
must never be reused (a code is consumed the moment a build is made — see Step 1).

| versionCode | versionName | EAS build id | Status | What changed |
| ----------- | ----------- | ------------ | ------ | ------------ |
| 9  | 1.0.9  | c5842302 | finished (code rejected by Play, already used) | bold icon |
| 10 | 1.0.10 | a24eb33c | finished (code rejected by Play, already used) | bold icon |
| 11 | 1.0.11 | c1e1f64e | finished | bold icon |
| 12 | 1.0.12 | 47e0e2d5 | finished | designer's exact `app-icon-rF.png` |
| 13 | 1.0.13 | 8f8723ce | finished | controls redesign + import progress |
| 13 | 1.0.13 | f2511def | ⚠ **wasted** — code 13 reused | settings ▴ always visible + AI voice spotlight/promo |
| 14 | 1.0.14 | 929c203d | finished | clean‑source icon fix (spine survives mask) + the above UX |
| 15 | 1.0.15 | 34cd381c | finished | finished reader design + AI voice sync/tail fix + exact clean icon |
| 16 | 1.0.16 | 7b4d5904 | finished | Android adaptive icon safe-zone fix (0.66 foreground scale) |
| 17 | 1.0.17 | 2900d21c | finished | active line highlight + free audio foreground-only + natural voice lock-screen controls. AAB: https://expo.dev/artifacts/eas/ePqSk5_ZdeSGG11pZ56jU91CZ0DgWpXb3fe6PuTaDJI.aab |
| 18-22 | 1.0.18-1.0.22 | local only / no EAS id recorded | phone QA builds | rF AI, multilingual OCR/text repair, OCR controls, scroll/audio fixes installed via local APKs |
| 23 | 1.0.23 | pending | source release candidate | Play release prep: public backend URL, no mic/background audio, per-install app-user id, Free no Listen, release checker hardened |

**Source candidate versionCode: 23.** Before spending EAS quota, still run
`eas build:list` and pick a higher code if any account build has consumed 23 or
above.

### Lessons baked into this guide (do not relearn the hard way)
- **Never reuse a versionCode.** Build `f2511def` reused code 13 → a paid build was
  wasted and the bundle was unusable. Always run the `build:list` check (Step 1) and pick
  highest + 1.
- **Bump in BOTH `app.json` and `check-release-config.mjs`**, then run `npm run check:release`
  before building — it fails loudly if they disagree.
- **Icons come from the clean source PNG via `gen-clean-icons.js`**, never hand‑rendered from
  SVG. The Android adaptive icon must keep the red spine inside the safe zone (0.66 scale),
  or the launcher mask crops it off and you see only "rF".
- **To see a new icon/version on the phone, uninstall then reinstall** — the launcher and Play
  both cache aggressively.
- **Local AI needs the Sherpa codegen plugin.** Keep
  `plugins/withSherpaCodegenGradleFix.js` in `app.json`; it was verified by
  running a clean debug assemble with the Windows native-output normalizer.
