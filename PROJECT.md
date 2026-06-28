# ReadFlow Developer Handoff

Updated: 2026-06-28

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
- Voice selection moved to the shelf/home screen with device, AI cloud, and
  future local AI voice options.
- Device voice selector uses installed phone voices when available.
- Help/About sheet shows version, support contact, website, and button meanings.
- Local AI voice path is documented in-app but the native Kokoro/ExecuTorch
  engine is not installed in this build.

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

## Local Workspace

Primary Windows workspace used during development:

```powershell
C:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow
```

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
- `mobile/src/components/Controls.tsx`: sound, play/pause, stop, reading
  settings. Voice selection now lives on the shelf screen, not inside a book.
- `mobile/src/services/Preferences.ts`: persists reading voice preferences
  across app launches.
- `mobile/src/services/LocalNeuralVoice.ts`: status/capability placeholder for
  a future offline neural TTS engine.
- `mobile/src/services/TextReflow.ts`: turns extracted page text into readable
  sentence units.
- `mobile/src/services/tts/*`: device voice and cloud natural voice providers.
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
- Free/device audio is foreground-only. The reader stops it when the app leaves
  the foreground, which covers screen lock, Home, and app switch.
- Paid natural/cloud voice is the only mode currently allowed to continue in the
  background for lock-screen listening.
- Natural/cloud voice registers an Expo Audio lock-screen media session with
  book/page metadata and native play/pause controls. Expo Audio does not expose
  a separate stop button in the current lock-screen API; pause is the supported
  lock-screen control.
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

Local neural voice:
- Best candidate is Kokoro TTS through `react-native-executorch`.
- Current source exposes the option and phone compatibility message on the shelf
  screen, but does not ship the native engine/model yet.
- When implemented, it should use the same `TTSProvider` interface and should
  be treated as unlimited from ReadFlow's billing perspective because it uses
  phone CPU/battery instead of OpenAI.

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
- Select AI cloud voice under an AI Pro/Power entitlement and verify `/api/tts`
  consumes cloud voice characters, not generic AI actions.
- Device voice reads in sync.
- Natural/cloud voice reads the same text, highlights the current line, and does
  not skip final words.
- Paragraph handoff feels acceptable.
- Lock screen while paid/natural voice is reading.
- Back out to Library and confirm playback stops.
- AI button opens, summary/explain/Q&A route works under internal paid override.
- Scanned PDF/OCR path shows correct paid messaging and progress.
- Offline/poor-network states do not crash.

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
- Current code unlocks natural voice from the AI flag in the mobile reader even
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
