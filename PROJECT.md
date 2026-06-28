# ReadFlow — PROJECT.md
Updated: 2026-06-28

What: Mobile PDF reader with AI natural-voice read-aloud (TTS) + OCR for scanned PDFs.
Expo (React Native) app + Node/TypeScript backend.
Status: in-dev → Play internal testing

Accounts:
- GitHub: tmoradikh-png — backend repo (see Hosting). App owner = tohid.moradi.kh@gmail.com.
- Expo / EAS: account `tohid123`, project `tohid123/readflow` (projectId 097b0b5a-db90-46b4-b434-60836687b429). Builds cost paid quota — see build ledger.
- Google Play Console: app id `com.urmiaworks.readflow` (under Urmia Works dev account = <verify email>).
- Apple: bundleIdentifier com.urmiaworks.readflow (<verify Apple Developer account>).
- Render: backend web service (Standard 2GB). Account = <verify>.
- OpenAI: TTS (tts-1-hd, voice nova) — API key set in Render env (APP_KEY / OPENAI key), NOT in repo.

GitHub: https://github.com/tmoradikh-png/readflow-app  (mobile + backend; render config in repo)
Hosting: Backend on Render (HTTPS). Mobile delivered via EAS build → Play internal track.
Local path: ReadFlow/  (own git repo)

Build/Run:
- Mobile dev: `cd ReadFlow/mobile; npx expo start`
- Pre-build gate: `cd ReadFlow/mobile; npm run check:release`
- Android build (PAID): `cd ReadFlow/mobile; npx --yes eas-cli build -p android --profile internal --non-interactive --no-wait`
- Backend dev: `cd ReadFlow/backend; npm start` (needs APP_KEY env)

Key files / subfolders:
- mobile/ — Expo app. app.json holds version/versionCode + icon config. assets/icon.png = app icon.
- mobile/scripts/check-release-config.mjs — release validator (must match app.json before building).
- backend/ — Node/TS API: PDF extract, OCR (tesseract.js), TTS proxy (OpenAI). render.yaml deploy config.
- backend/use-designer-png.js — regenerates app icons from the designer's app-icon-rF.png.

Notes:
- BUILDS COST MONEY. Before every build: bump app.json version/ios.buildNumber/android.versionCode to the next UNUSED Play code, update check-release-config.mjs, run check:release. Play permanently consumes a versionCode on upload — never reuse. Ledger lives in agent memory (/memories/repo/readflow-notes.md): codes 6–11 consumed; current build = 1.0.12 / code 12.
- OCR is memory-heavy; Render upgraded to Standard 2GB for safe default-quality OCR.
- After installing a new build on a phone, UNINSTALL the old app first (Android caches the launcher icon).
- No API keys in the repo — all secrets live in Render env vars.
