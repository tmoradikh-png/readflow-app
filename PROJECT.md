# ReadFlow Developer Handoff

Updated: 2026-06-29

Read this file first when taking over the project. It is the high-level map of
accounts, services, release status, and operational habits. Then use
`README.md` for local setup, `RELEASE_GUIDE.md` for Android builds, and
`BACKEND_FEATURE_ENFORCEMENT.md` for paid-feature enforcement. Use
`COST_MODEL.md` for pricing, OpenAI cost, free-tier limits, and cloud voice
allowance decisions.

## Product

ReadFlow is a phone-first PDF/Word reader. It extracts document text, removes
fixed PDF layout, reflows the content into a clean reading view, reads aloud,
and supports AI features such as summary, explain, Q&A, OCR, and natural cloud
voice.

Current shape:
- `mobile/`: Expo React Native app, TypeScript.
- `backend/`: Node + Express + TypeScript backend for PDF extraction, OCR, AI,
  cloud TTS, entitlement checks, and cost-bearing API protection.
- Android is the active release target. iOS identifiers/config exist but iOS has
  not been the main tested release path yet.

## Current State

- Git branch: `main`
- GitHub remote: `https://github.com/tmoradikh-png/readflow-app.git`
- GitHub account rule: always use `tmoradikh-png` for this project unless the
  owner explicitly changes the repository owner.
- Current source version: `1.0.18`
- Current source Android `versionCode`: `18`
- Latest finished EAS build: `1.0.17` / code `17`
- Latest finished EAS build id: `2900d21c-48f4-42aa-9434-f3bd2dcb06a4`
- Latest finished AAB:
  `https://expo.dev/artifacts/eas/ePqSk5_ZdeSGG11pZ56jU91CZ0DgWpXb3fe6PuTaDJI.aab`
- Next Android build should use code `18` unless another EAS build has already
  consumed a higher code. Source is prepared for code `18`; latest finished
  build is still code `17`.

Changes included in the latest finished build:
- Paid/cloud audio background-mode support was added for lock-screen listening.
- Cloud voice paragraph handoff was improved with wider prefetch, player reuse,
  and a shorter tail guard.
- Highlighting now targets the active rendered line while keeping the same TTS
  audio chunk size for natural voice.

Important: code `17` has been built, but test phones still need that AAB
uploaded/installed before the source changes can be verified on-device.

Changes after the latest finished build and included in source `1.0.18`:
- Cloud AI voice is gated by `features.cloudVoice`, not generic AI.
- AI Pro includes 60k cloud voice characters/month; Power includes 180k.
- Backend `/api/tts` checks monthly `cloudVoiceChars` before generating fresh
  OpenAI audio.
- Voice selection uses the public labels `Device voice`, `Edge AI`, and
  `Cloud AI`. The shelf Voice sheet only shows the detailed settings for the
  currently selected mode so readers do not see raw Android voice clutter.
- The reader settings menu also includes a quick `Device` / `Edge AI` /
  `Cloud AI` selector. Cloud AI acts as an upgrade prompt when the plan does
  not include `features.cloudVoice`; locked labels must say `AI Pro`/`Locked`,
  not `Soon`, because Cloud AI is a live paid feature once the backend grants a
  voice allowance.
- The shelf now has a `Book language` selector. The selected language is saved
  in preferences and drives import OCR (`ocrLang`), on-demand OCR, phone voice
  filtering, reader TTS locale, Cloud AI/AI answer language, and Edge AI
  eligibility messaging. Edge AI remains English-only until more local voice
  packs are added.
- App warnings and confirmations use `ThemedNotice` / `UpgradeSheet`, not native
  Android alerts, so upgrade, quota, delete, download, and validation messages
  stay in the ReadFlow visual style.
- OCR language options currently exposed from mobile:
  English, Spanish, French, German, Italian, Portuguese, Dutch, Swedish,
  Norwegian, Danish, Finnish, Turkish, Indonesian, Vietnamese, Japanese,
  Korean, Chinese (Simplified), Hindi, Russian, Arabic, and Persian. Backend
  Tesseract allow-list includes matching codes, including `fas` for Persian.
- Backend OCR quality detection is language-aware for non-Latin scripts. When
  the user selects Persian/Arabic/etc., corrupted native PDF text layers (for
  example repeated `AA`/mojibake mixed into Persian) are treated as OCR
  candidates instead of being accepted as readable text.
- 2026-06-29 multilingual import fix: OCR now replaces pages that were explicitly
  marked low-quality even when the OCR text is shorter than the broken native
  text. This matters for Persian/Arabic PDFs where the corrupt text layer can be
  long but unreadable. The mobile parsed-text cache now stores `ocrLang`; a book
  cached under English/old extraction will be re-extracted when reopened with
  Persian/Arabic/etc. instead of silently showing stale corrupted text.
- OCR detection was also relaxed for mixed-language non-Latin books. If a page
  already has meaningful native Chinese/Japanese/Russian/Persian/etc. characters,
  or clearly readable bilingual Latin text, ReadFlow keeps the native text
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
- Edge AI voice now uses `react-native-sherpa-onnx` plus an on-demand
  Supertonic local TTS model
  (`sherpa-onnx-supertonic-tts-int8-2026-03-06`). The model is not bundled into
  the app; the user downloads it from the Voice sheet. It is larger than the old
  Piper test voice (about 81 MB instead of 20 MB) because the 20 MB voice sounded
  too machine-like for book reading.
- Important: Edge AI voice is a native dependency. It needs a new EAS/native
  build to run on the phone; Expo Go or an older installed build will fall back
  to device voice.
- Playback policy is currently foreground-only for every voice engine. While a
  book is reading, ReadFlow keeps the screen awake; if the user locks the phone,
  presses Home, or app-switches away, audio stops instead of finishing the
  paragraph/chunk. A future lock-screen audiobook mode would need explicit
  native media-session controls and product approval.
- Reader jumps now land directly instead of animating through pages. Resume,
  page navigation, bookmark jumps, rotation re-anchors, and follow corrections
  should not visibly scroll through the book.
- Connected-phone dev test on 2026-06-29: a debug native build was installed on
  Samsung `SM_G975F` (`R58M168KTSZ`) from a short temp path. The first Piper
  experiment proved Sherpa playback worked; current source uses the larger
  Supertonic Reader/Edge AI model for better quality. No EAS quota was
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
  - Edge AI uses the optional Supertonic Reader model, reads short
    same-page chunks, prefetches sooner, and uses a shorter audio tail guard to
    reduce paragraph gaps.
  - Voice settings now use customer-facing names: Device voice, Edge AI
    (on-device), and Cloud AI (cloud allowance).
  - Library remove is visible on document cards and the Continue card, removes
    cached parsed text/bookmarks, and updates metadata before deleting the
    physical file so deletion does not feel stuck.
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
  (1,000 pages/month) and Power (3,000 pages/month). Do not put OCR back into
  Reader Plus unless the cost model is intentionally changed.
- 2026-06-29 Persian book check from the owner's Downloads: `zayesh-tragedy-az-jan`
  is a good Persian text-layer PDF and imports as native text. `Tabar_Shenasiye_Akhlagh`
  and `Dayeratol_Maaref_Sotoon_Panjom` are scanned/image PDFs; they must show an
  OCR-required path for Free/Reader Plus and run background OCR only for AI
  Pro/Power. Pending OCR pages are returned blank instead of showing watermark
  or garbage placeholder text.
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

## Account Map

Do not commit passwords, API keys, private tokens, Play signing keys, RevenueCat
secrets, or OpenAI keys. This repo may contain public identifiers and service
names only. Secrets live in the service dashboards or the owner's password
manager.

| Area | Account / owner | What it is used for | Notes |
| --- | --- | --- | --- |
| GitHub | `tmoradikh-png` | Source repository | Always use this account/repo owner for ReadFlow. Remote is `readflow-app`. User email given for account work: `t.moradi.kh@gmail.com`. |
| Expo / EAS | `tohid123` | Android builds and project ownership | Project is `tohid123/readflow`, projectId `097b0b5a-db90-46b4-b434-60836687b429`. User email given: `t.moradi.kh@gmail.com`. |
| Google Play Console | Urmia Works developer account | Internal testing and later production release | Android package is permanent: `com.urmiaworks.readflow`. Verify exact login email before release. |
| Render | `support@urmiaworks.com` | Hosted backend | Internal backend service currently targeted by the app: `readflow-backend-internal`. |
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
- Play service-account JSON, signing keys, EAS credentials: dashboards/secure
  storage only. EAS currently manages Android signing credentials remotely.

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
- If this temporary APK says it cannot reach the ReadFlow backend while the phone
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
- `mobile/eas.json`: EAS build profiles. Internal Android builds create `.aab`.
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
8. Upload the `.aab` to Google Play Console internal testing.
9. On the phone, uninstall the old app before reinstalling. Android launchers and
   Play cache icons/version metadata aggressively.

Local native smoke test without spending EAS quota:
1. Copy `mobile/` to a short physical path such as `C:\rf-mobile-test`, excluding
   `node_modules`, `.expo`, and generated `android/`.
2. Run `npm ci`.
3. Run `npx expo prebuild --platform android --clean`.
4. Run `.\android\gradlew.bat :app:assembleDebug -x lint -x test` or
   `npx expo run:android`.
5. If testing Edge AI, open Voice, download/select Edge AI, tap Listen,
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
git -c safe.directory=C:/Users/Greencom/OneDrive/Documents/aiChat/ReadFlow push origin main
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
- Blueprint: `render.yaml`
- `ENTITLEMENTS_DEV_OVERRIDE=false`
- `RC_SECRET_KEY` must be set to the production RevenueCat secret.
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
- AI Pro: 60,000 characters/month.
- Power: 180,000 characters/month.
See `COST_MODEL.md` before changing cloud voice allowances; unlimited cloud
voice is not economically safe at the current paid prices.

## Audio and Highlighting Notes

Cloud voice:
- `mobile/src/services/tts/CloudTTSProvider.ts`
- Uses backend `/api/tts`.
- Caches audio in app cache.
- Prefetches upcoming text from the reader to reduce paragraph gaps.
- Uses the selected cloud voice from shelf preferences.
- Falls back to the selected device voice if cloud voice is offline or over
  quota, and shows a one-time allowance message.
- Uses `expo-audio` with `shouldPlayInBackground: true` for paid/natural voice
  lock-screen listening.
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

Edge AI voice:
- Current implementation uses `react-native-sherpa-onnx` and
  `@dr.pogodin/react-native-fs`.
- Current model: `sherpa-onnx-supertonic-tts-int8-2026-03-06` (Supertonic
  Reader/Edge AI), downloaded on demand from the Sherpa model release.
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
- If native support/model download is missing, the provider falls back to the
  selected device voice and shows a one-time "Edge AI not ready" message.
- Treat Edge AI as unlimited from ReadFlow's billing perspective because it uses
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
  voices for that language, AI answers use that language, and Edge AI explains
  that only English is available for now.
- For Persian/Arabic specifically, select the language before import/reopen.
  If a book was cached from an older broken extraction, reopening with Persian
  should re-extract instead of using the old English/unknown cache. If the
  source file itself has been deleted, remove and reimport the book.
- In the reader settings menu, switch between Device, Edge AI, and Cloud AI.
  Cloud AI should upsell cleanly when the plan is not AI Pro/Power.
- Select Cloud AI under an AI Pro/Power entitlement and verify `/api/tts`
  consumes cloud voice characters, not generic AI actions.
- Open Voice, download Edge AI, select it, and verify the first
  paragraph generates locally, then subsequent/repeated paragraphs play from
  cache.
- Device voice reads in sync.
- Natural/cloud voice reads the same text, highlights the current line, and does
  not skip final words.
- Edge AI reads the same text, highlights the current line, and falls
  back to the selected device voice if the model is missing.
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
- Server-driven Edge AI model catalog with language, model id, size, quality,
  and download URL so new language packs do not require an app rebuild.
- Edge AI voice packs for priority markets after quality/size review. Start
  with Spanish, French, German, Arabic, Turkish, and Persian if good compact
  models are available.
- Language auto-detect from the first native-text/OCR pages, with user
  confirmation before spending OCR quota.
- Mixed-language books and per-section language switching.
- Local/Edge OCR on strong phones. This is separate from Edge AI voice and needs
  a different OCR engine/model.

## Known Risks / Follow-ups

- `mobile/app.json` currently contains duplicate Android permission strings for
  `INTERNET`, `RECORD_AUDIO`, and `MODIFY_AUDIO_SETTINGS`; cleanup is safe but
  should be tested in the next native build.
- Public paid subscriptions are not fully wired until RevenueCat production
  setup and mobile RevenueCat SDK/user id headers are complete.
- The internal backend uses paid-feature dev override. Do not point a public app
  build at that service unless intentionally doing internal testing.
- `APP_KEY` in mobile config is visible to anyone who decompiles the app. It is a
  basic app gate, not strong user authentication.
- OCR can be memory-heavy. If using public production traffic, prefer Render
  Starter/Standard over Free.
- OpenAI usage costs money. Monitor backend logs and rate limits when broadening
  testing.
- AI voice packs/top-ups are only a product path today. Play Billing/RevenueCat
  purchases are not wired in this build, so the app must not present a fake
  paid purchase button.
- Current free-tier code/config does not yet match the latest product intent of
  1 free book and about 100 pages. See `COST_MODEL.md`.

## Release Notes Template

Use this compact format for Play internal testing:

```text
ReadFlow X.Y.Z
- Main user-visible fix or improvement.
- Voice/highlight/import/OCR changes.
- Icon/build/backend note if relevant.
```

## Documentation Rule

When a developer changes accounts, service URLs, build codes, entitlement
behavior, pricing/cost assumptions, icon process, release process, or any
production-impacting workflow, update this file and any specialized guide
(`RELEASE_GUIDE.md`, `BACKEND_FEATURE_ENFORCEMENT.md`, or `COST_MODEL.md`) in
the same commit.
