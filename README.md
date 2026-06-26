# ReadFlow

Upload a clean PDF → it reflows to your phone screen → a natural voice reads it
with **synchronized highlighting** → adjust **font size / spacing / speed** →
tap **AI** to summarize, explain, simplify, extract key points, or ask questions.

This repo is the MVP prototype. It is structured cleanly so each part can be
upgraded independently later (cloud voice, OCR, accounts, etc.).

```
ReadFlow/
├── backend/   Node + Express + TypeScript  (PDF text extraction + AI via OpenAI)
└── mobile/    Expo React Native + TypeScript (reader UI, free on-device voice)
```

## Architecture at a glance

| Concern        | Where                                   | Swappable later                       |
| -------------- | --------------------------------------- | ------------------------------------- |
| PDF → text     | `backend/src/services/pdfExtract.ts`    | add OCR for scanned PDFs              |
| Reflow/sentences | `mobile/src/services/TextReflow.ts`   | tune splitting, paragraphs           |
| Voice (TTS)    | `mobile/src/services/tts/*`             | `device` → `cloud` is one line        |
| AI             | `backend/src/providers/*`               | `openai` → `claude`/`ollama`          |
| Reader UI      | `mobile/src/components/Reader.tsx`      | —                                     |

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

> Reading aloud uses the **free on-device voice** (works offline, no cost).
> The AI buttons require the backend + an OpenAI key.

## Switching to premium cloud voice later
Implement `mobile/src/services/tts/CloudTTSProvider.ts`, add a `POST /api/tts`
route on the backend, then change `ACTIVE_TTS` in
`mobile/src/services/tts/index.ts` from `"device"` to `"cloud"`. No Reader/UI
changes needed.

## Roadmap (after the prototype feels right)
- Cloud TTS (OpenAI/ElevenLabs/Azure) for premium natural voices
- OCR: scanned/image PDFs → clean text
- Accounts + subscriptions (RevenueCat) replacing the test paywall
- Per-document AI cache in a real DB/Redis
- Word-level highlighting (iOS boundary events) and gaze pause/resume
- Bookmarks, reading position memory, multi-language voice picker
