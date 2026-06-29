# ReadFlow

Upload a clean PDF -> it reflows to your phone screen -> phone voice or capped
AI voice reads it with **synchronized highlighting** -> adjust **font size /
spacing / speed** ->
tap **AI** to summarize, explain, simplify, extract key points, or ask questions.

This repo is the MVP prototype. It is structured cleanly so each part can be
upgraded independently later (OCR quality, accounts, subscriptions, etc.).

```
ReadFlow/
├── backend/   Node + Express + TypeScript  (PDF text extraction + AI via OpenAI)
└── mobile/    Expo React Native + TypeScript (reader UI + device/cloud/local voice)
```

## Architecture at a glance

| Concern        | Where                                   | Swappable later                       |
| -------------- | --------------------------------------- | ------------------------------------- |
| PDF → text     | `backend/src/services/pdfExtract.ts`    | add OCR for scanned PDFs              |
| Reflow/sentences | `mobile/src/services/TextReflow.ts`   | tune splitting, paragraphs           |
| Voice (TTS)    | `mobile/src/services/tts/*`             | device/cloud providers                |
| AI             | `backend/src/providers/*`               | `openai` → `claude`/`ollama`          |
| Reader UI      | `mobile/src/components/Reader.tsx`      | —                                     |

## Developer handoff

Start with **[PROJECT.md](PROJECT.md)** when taking over the project. It records
the service accounts, public URLs/IDs, current build state, icon process,
backend deployment notes, paid-feature enforcement, pricing/cost notes, and
release habits. Use **[COST_MODEL.md](COST_MODEL.md)** before changing paid
tiers, free limits, AI features, or cloud voice allowances. Keep the docs updated
whenever accounts, build codes, backend URLs, costs, or production workflows
change.

**Why a backend?** The OpenAI key must never ship inside the phone app. The app
talks only to our backend; the backend talks to OpenAI. The backend also caches
AI answers per page/section to keep costs near zero on repeat taps.

## Run it (≈5 minutes)

### 1) Backend
```pwsh
cd backend
copy .env.example .env      # then paste your OpenAI key into .env
npm install
npm run dev                 # http://localhost:4000
```

### 2) Mobile (Expo)
```pwsh
cd mobile
npm install
npm start                   # press the QR with Expo Go on your phone
```
The app auto-detects your computer's LAN IP and calls the backend on port 4000,
so your phone and computer must be on the **same Wi‑Fi**.

Expo Go is enough for normal JS/UI work and device voice. Edge AI voice needs
the native Sherpa module, so use a development/native build:

```pwsh
cd mobile
npm run android             # runs expo run:android for a connected Android phone
```

On Windows, local native builds are more reliable from a short physical path
such as `C:\rf-mobile-test`; see `RELEASE_GUIDE.md` for the no-EAS local test
workflow.

> Reading aloud can use **Device voice** (works offline after import, no
> ReadFlow voice cost), capped backend-powered **Cloud AI**, or downloaded
> **Edge AI** in a native build. Cloud AI requires the backend and OpenAI key;
> Edge AI uses phone CPU/battery instead.

## Shipping a new Android build
See **[RELEASE_GUIDE.md](RELEASE_GUIDE.md)** → the **"TL;DR — Cut a NEW build"** section
at the top is the step‑by‑step routine (bump `versionCode`, regenerate the icon, run
`npm run check:release`, build the `.aab`, upload to Play **Internal testing**). A
**Build ledger** at the bottom tracks every build and the next free `versionCode`.

> 🛑 Never reuse a `versionCode` — a code is consumed the moment a build is made, and
> reusing one wastes a paid EAS build. Always pick the next free code (see the guide).

## Voice

Device voice is implemented through `expo-speech` and now supports choosing an
installed phone voice from the shelf screen.

Premium Cloud AI voice is implemented through
`mobile/src/services/tts/CloudTTSProvider.ts` and backend `POST /api/tts`.
The mobile app never stores the OpenAI key; it sends text to the backend and
plays the returned MP3. The reader keeps natural audio chunks intact while the
UI highlights the active rendered line. Cloud voice is not unlimited:

- AI Pro: 60k generated characters/month.
- Power: 180k generated characters/month.

Edge AI voice is implemented through `react-native-sherpa-onnx` with the
on-demand Supertonic Reader model
(`sherpa-onnx-supertonic-tts-int8-2026-03-06`, about 81 MB download). It
requires a fresh native/EAS build and will not run in Expo Go or older installed
builds. If the model is missing, the reader falls back to the selected device
voice.

## Roadmap (after the prototype feels right)
- RevenueCat mobile SDK + production subscriptions
- OCR quality/performance tuning for scanned/image PDFs
- Per-document AI cache in a real DB/Redis
- Exact word-level highlighting if the TTS provider returns timestamps
- Multi-language voice picker and richer audiobook controls
