# readFlow Pricing and Cost Model

Updated: 2026-06-28

This file records the business model assumptions for readFlow so another
developer can continue without guessing. Re-check vendor prices before launch
or whenever plans change; OpenAI, Google Play, Render, and RevenueCat pricing
can change.

## Sources Checked

- OpenAI API pricing: https://developers.openai.com/api/docs/pricing
- OpenAI TTS-1 pricing: https://developers.openai.com/api/docs/models/tts-1
- OpenAI text-to-speech guide: https://developers.openai.com/api/docs/guides/text-to-speech
- OpenAI production/billing guidance:
  https://developers.openai.com/api/docs/guides/production-best-practices
- OpenAI prepaid billing:
  https://help.openai.com/en/articles/8264778-what-is-prepaid-billing
- Render pricing: https://render.com/pricing
- RevenueCat pricing: https://www.revenuecat.com/pricing
- Google Play service fees:
  https://support.google.com/googleplay/android-developer/answer/10632485
- Google Play lower service fee rollout:
  https://support.google.com/googleplay/android-developer/answer/16954621
- React Native ExecuTorch TTS docs:
  https://docs.swmansion.com/react-native-executorch/docs/hooks/natural-language-processing/useTextToSpeech
- React Native ExecuTorch / Kokoro cost article:
  https://swmansion.com/blog/on-device-ai-beats-cloud-for-tts-heres-why/
- React Native Sherpa-ONNX installation:
  https://xdcobra-react-native-sherpa-onnx-99.mintlify.app/installation
- React Native Sherpa-ONNX text-to-speech:
  https://xdcobra-react-native-sherpa-onnx-99.mintlify.app/features/text-to-speech
- React Native Sherpa-ONNX TTS model guidance:
  https://xdcobra-react-native-sherpa-onnx-99.mintlify.app/models/tts/overview
- React Native Sherpa-ONNX VITS/Piper models:
  https://xdcobra-react-native-sherpa-onnx-99.mintlify.app/models/tts/vits

## Current Implementation Warning

Current cloud voice implementation:

- Free and Reader Plus cannot call `/api/tts`.
- AI Pro includes `60,000` Cloud AI voice characters/month.
- Power includes `180,000` Cloud AI voice characters/month.
- The mobile reader now gates Cloud AI voice from `features.cloudVoice`, not the
  generic AI text feature.
- The backend gates `/api/tts` with `ensureFeature(req, res, "cloudVoice")` and
  checks `cloudVoiceChars` before generating fresh OpenAI audio.
- Cache hits do not burn cloud voice allowance because they do not create a new
  OpenAI TTS bill.
- `backend/src/routes/tts.ts` defaults to `tts-1-hd`, and `render.yaml` also
  sets `TTS_MODEL=tts-1-hd`. This is the more expensive legacy TTS model, so the
  current allowances are deliberately small.
- Source `1.0.18` adds a real rF AI voice path with `react-native-sherpa-onnx`
  and an on-demand Supertonic Reader model. It has no OpenAI per-character bill,
  but it requires a new native/EAS build and consumes the user's phone CPU,
  storage, and battery.
- The app now presents voice choices as Device voice, rF AI, and Cloud AI.
  rF AI is the local Sherpa/Supertonic path and should be marketed as
  no-cloud, battery/CPU-based reading. Cloud AI is the OpenAI-backed path and
  must remain paid/capped by `cloudVoiceChars`.
- rF AI currently downloads `sherpa-onnx-supertonic-tts-int8-2026-03-06` on
  demand (about 81 MB) instead of bundling it in the app, so APK/AAB size does
  not grow by the model size until the user chooses to download it. This replaced
  the first 20 MB Piper test voice because the smaller model sounded too robotic
  and paused too noticeably for book reading.
- Free-tier source now follows the latest product decision: 1 imported PDF per
  month and the first 100 pages of a native-text document. The backend returns
  `truncated/pageCap` so the reader can show a page-limit message instead of
  mistaking page 101 for a scanned page. Source `1.0.23` also blocks
  Listen/read-aloud for Free and routes it to a Reader Plus upgrade prompt.
- Reader Plus is now intentionally non-OCR: ad-free/full native-text reading,
  larger imports, and device voice. Scanned/image PDFs require AI Pro or Power.
- Cloud AI voice is language-quality gated. Persian, Arabic, Russian, Hindi,
  Chinese, Japanese, and Korean are blocked from Cloud AI voice until voice QA
  passes; the app falls back to Phone voice instead of letting paid users hear a
  bad cloud result.

Do not launch public subscriptions until RevenueCat/Play Billing identity is
wired. Source `1.0.23` adds a local install id for `x-app-user-id`, which is good
enough to avoid one shared anonymous quota bucket, but it is not a purchase
identity and can be reset by reinstalling.

## Key Principle

The free tier must have no marginal API cost to us.

Allowed in free:
- Native text preview for a small number of pages/books.
- Local reading, bookmarks, and basic settings.
- Ads if the product uses ads later.

Not allowed in free:
- Read-aloud / Listen mode.
- OpenAI AI calls.
- OpenAI cloud TTS.
- OCR for scanned PDFs unless it is fully local and proven cheap enough.
- Unlimited server extraction.

The only expected free-tier business cost should be shared Render hosting and
small bandwidth/CPU overhead.

## Reader Plus Cost When Users Read A Lot

Reader Plus can be generous as long as it stays non-AI and non-cloud-voice.

The important distinction:

- Reading an already-imported book costs us nothing per hour. The text, reading
  position, highlighting, typography, and device TTS playback run on the phone.
- Device voice costs us nothing per hour. It uses the user's phone TTS engine.
- Render is used when the user imports/extracts a PDF or DOCX. AI Pro/Power OCR
  also uses Render CPU and memory for scanned/image pages.
- OCR has no OpenAI/API cost in the current backend, but it consumes Render CPU
  and memory. This is why OCR starts at AI Pro and stays capped.

Current Reader Plus config:

- Price: $4.99/month or $39.99/year.
- OCR: not included.
- Server document extractions: 100/month.
- Max file size: 100 MB.
- Max processed pages per document: 2,000.
- AI: off.
- Cloud voice: off.

Rough margin:

- $4.99/month nets about $4.19 after a conservative 15% Play fee plus 1%
  RevenueCat.
- $39.99/year nets about $2.80/month on the same conservative basis.
- Render Standard web service compute is currently listed at $25/month. If using
  a Pro workspace plus Standard compute, budget closer to $50/month before
  bandwidth/Redis/database additions.
- That means roughly 6 monthly Reader Plus users cover a $25/month server, or
  roughly 12 monthly users cover a $50/month setup. Annual users need roughly
  9 users for $25/month or 18 users for $50/month.

Conclusion: heavy Reader Plus reading is safe if it means many listening hours
with device voice on native-text PDFs. The risky part is scanned/OCR-heavy books,
so those are AI Pro/Power features with monthly OCR caps.

## OCR Cost Per Page

Reader Plus currently has no OCR allowance. OCR starts at AI Pro because scanned
books consume shared backend CPU/memory and should be paid/capped. A normal text
PDF can be read and listened to with device voice for no per-hour vendor cost
after import.

OCR page cash cost:

- OpenAI/API cost: $0/page in the current implementation.
- Render billing: no direct per-page charge; it is fixed monthly compute plus
  bandwidth/storage overages.
- Practical cost: CPU time, memory pressure, latency, and whether we need a
  larger Render instance as usage grows.

CPU-time estimate if a Render instance is already running:

| Render compute | Monthly cost | 5 sec/page | 15 sec/page | 60 sec/page |
| --- | ---: | ---: | ---: | ---: |
| Standard web service | $25/mo | $0.005 / 100 pages | $0.014 / 100 pages | $0.057 / 100 pages |
| Pro web service | $85/mo | $0.016 / 100 pages | $0.048 / 100 pages | $0.192 / 100 pages |

Those numbers are the theoretical compute value of the CPU seconds, not an
extra bill from Render. The fixed monthly allocation matters more:

| Monthly OCR volume | $25 compute effective cost | $85 compute effective cost |
| ---: | ---: | ---: |
| 1,000 pages | $2.50 / 100 pages | $8.50 / 100 pages |
| 3,000 pages | $0.83 / 100 pages | $2.83 / 100 pages |
| 10,000 pages | $0.25 / 100 pages | $0.85 / 100 pages |
| 30,000 pages | $0.08 / 100 pages | $0.28 / 100 pages |

AI Pro at $9.99/month nets roughly $8.39 after conservative Play + RevenueCat
fees. If a user consumes the full 1,000 OCR pages, revenue is about $0.84 per
100 OCR pages before cloud voice/AI text costs. This is acceptable only if OCR is
shared across a healthy user base, queued/throttled, and measured.

Recommendation: allow generous normal reading/device listening in Reader Plus,
but keep OCR out of Reader Plus. Keep AI Pro/Power OCR capped, measured, and
queue-limited; adjust after telemetry.

## Multi-Month OCR for Large Scanned Books

AI Pro should allow a user to finish one large scanned book over multiple months
instead of forcing an immediate Power upgrade.

Current intended flow:

- The original PDF/DOCX is copied into the app's private library storage.
- Parsed text and OCR'd pages are cached locally in `DocCache`.
- Pending scanned pages stay in the cached document.
- When the monthly OCR quota is reached, OCR pauses and the reader explains that
  remaining scanned pages are saved for later.
- After the user's quota resets, reopening the book re-uploads the local source
  file, mints a fresh backend `docToken`, merges already-cached OCR text, and
  continues the remaining pending pages.
- The upgrade offer is convenience, not a hard wall: AI Pro gives 1,000 OCR
  pages/month, and Power gives 3,000 OCR pages/month.

Implementation notes:

- `Library` keeps the local source file.
- `DocCache` keeps OCR progress and pending pages.
- `OcrLoader` pauses distinctly for offline, quota, expired token, and generic
  server errors.
- Quota pauses do not retry every few seconds; the user can continue after the
  monthly reset or by upgrading.

## Device Voice Quality, No Extra Cost

Device voice quality can be improved without paying OpenAI by improving the
phone-side experience:

- Add a voice picker using installed Android/iOS system voices.
- Prefer high-quality Google/Samsung/Apple voices when available. The current
  app groups English voices by friendly accent labels instead of exposing raw
  Android voice ids.
- Add an in-app tip to install or update "Speech Services by Google" and
  download higher-quality voices in Android settings.
- Add per-language default voice selection.
- Add pronunciation replacements for common PDF artifacts, abbreviations, and
  names.
- Improve text cleanup before speech: dehyphenate line breaks, remove repeated
  headers/footers, normalize quotes/dashes, fix broken spacing, and avoid
  reading page numbers.
- Add a short paragraph-pause slider for device voice.
- Tune rate/pitch presets: natural, focused, fast.
- Keep playback foreground-friendly: the current reader prevents auto-lock while
  a book is reading, which costs nothing but improves long reading sessions.

These changes cost engineering time only. They do not create a per-user vendor
bill. Truly natural AI voices, however, require cloud TTS or a native/local
neural model and should be treated as a paid/capped feature.

## OpenAI Account and API Key Plan

Current architecture:

- The mobile app never receives the OpenAI key.
- Mobile calls the backend.
- The backend calls OpenAI with `OPENAI_API_KEY` from Render environment
  variables or local `backend/.env`.
- Whoever owns the OpenAI organization/project that created that key pays the
  API bill.

Production recommendation:

- Create a dedicated OpenAI project for readFlow.
- Create a service key for the backend only.
- Put that key in Render as `OPENAI_API_KEY`.
- Set project spend limits/alerts.
- Use prepaid credits or strict billing limits so a bug cannot silently create a
  large bill.
- Do not use a personal all-purpose key for public production.
- Rotate the current key before public release if it was ever shared broadly.

Important: a ChatGPT/Codex Pro subscription does not pay for readFlow API calls.
The app's AI/TTS calls are billed separately through the OpenAI API account.

## Unit Cost Assumptions

For reading cost estimates:

- Reading speed estimate: 150 words per minute.
- Character estimate: 6 characters per word including spaces/punctuation.
- This gives about 54,000 characters per hour of spoken book text.

OpenAI legacy TTS prices checked on 2026-06-28:

| Model | Cost |
| --- | ---: |
| `tts-1` | $15 per 1M characters |
| `tts-1-hd` | $30 per 1M characters |

OpenAI text model sample prices checked on 2026-06-28:

| Model | Input / 1M tokens | Output / 1M tokens |
| --- | ---: | ---: |
| `gpt-5.4-nano` | $0.10 | $0.625 |
| `gpt-5.4-mini` | $0.375 | $2.25 |

The backend currently defaults AI text to `gpt-4o-mini`. Re-check model choice
and pricing before launch; a current low-cost model should be selected on
purpose, not by old defaults.

## Cloud Voice Cost

Estimated OpenAI TTS cost at 54,000 characters per hour:

| Cloud voice allowance | Characters / month | `tts-1` cost | `tts-1-hd` cost |
| --- | ---: | ---: | ---: |
| 30 minutes/month | 27,000 | $0.40 | $0.81 |
| 1 hour/month | 54,000 | $0.81 | $1.62 |
| 2 hours/month | 108,000 | $1.62 | $3.24 |
| 5 hours/month | 270,000 | $4.05 | $8.10 |
| 10 hours/month | 540,000 | $8.10 | $16.20 |
| 1 hour/day | 1,620,000 | $24.30 | $48.60 |
| 12 hours/day | 19,440,000 | $291.60 | $583.20 |

Conclusion: unlimited cloud voice cannot be included in a $9.99 or $19.99 plan.
At 12 hours/day it would lose hundreds of dollars per user each month. Long
listening must use device voice, with cloud voice sold as a capped allowance or
usage pack.

Current allowance economics with `tts-1-hd`:

| Tier | Included Cloud AI voice | Approx listening | OpenAI cost if fully used |
| --- | ---: | ---: | ---: |
| AI Pro | 60,000 chars/month | about 1.1 hours / 36 pages | about $1.80 |
| Power | 180,000 chars/month | about 3.3 hours / 109 pages | about $5.40 |

This is intentionally conservative. Extra AI voice should be sold as a top-up
through Play Billing/RevenueCat, for example 100k characters at a price that
nets well above the $3 OpenAI cost on `tts-1-hd`.

## Local Neural Voice Plan

Current implementation choice: `react-native-sherpa-onnx` with Supertonic TTS,
specifically `sherpa-onnx-supertonic-tts-int8-2026-03-06` (Supertonic
Reader/rF AI). The model is downloaded on demand from the Sherpa model
registry instead of being bundled in every app install.

Why it is useful:

- No OpenAI per-character cost after the model is on the phone.
- Works offline.
- Keeps document text on device for narration.
- Lets heavy readers listen for long sessions without destroying margins.

Tradeoffs:

- Requires native modules (`react-native-sherpa-onnx` and
  `@dr.pogodin/react-native-fs`), so it must be tested in a fresh native build.
- Compressed model download is about 81 MB for the first voice. It is not part
  of the base app package.
- Generated WAV clips use app cache; repeated paragraphs can replay without
  regenerating.
- Quality should be better than many default device voices, but not as polished
  as high-quality cloud TTS.
- Uses phone CPU/battery. Long listening has no readFlow vendor bill but may
  warm/drain weaker phones.

Implementation status:

- DONE in source: shelf Voice sheet checks native support/model status and can
  download the local voice with progress.
- DONE in source: `LocalNeuralTTSProvider` generates WAV clips through Sherpa,
  caches them, plays them with `expo-audio`, and reports progress to the same
  line-highlighting path as cloud voice.
- DONE in source: if local AI is not ready, the reader stops rF AI playback and
  explains the issue once instead of silently switching to phone voice.
- DONE: clean local debug APK builds on Windows from a short temp path without
  spending EAS quota. Supertonic still needs on-device listening QA after the
  model downloads.

Kokoro through `react-native-executorch` remains a possible higher-quality
future path, but it is much heavier for a first shipping attempt. The first
version should prove demand and device behavior with the lighter
Sherpa/Supertonic path before adding hundreds of MB of model/runtime weight.

## AI Voice Cost Per Page

For "read this book with best quality AI voice", use the `tts-1-hd` column unless
we intentionally switch models. The current backend defaults to `tts-1-hd`.

Assumption:

- Typical book page: 250-300 words.
- Character estimate: about 6 characters per word including spaces/punctuation.
- So one page is roughly 1,500-1,800 characters.

| Amount read | Characters | `tts-1` cost | `tts-1-hd` cost |
| --- | ---: | ---: | ---: |
| 1 page, 250 words | 1,500 | $0.023 | $0.045 |
| 1 page, 300 words | 1,800 | $0.027 | $0.054 |
| 100 pages | 150k-180k | $2.25-$2.70 | $4.50-$5.40 |
| 500 pages | 750k-900k | $11.25-$13.50 | $22.50-$27.00 |
| 1,000 pages | 1.5M-1.8M | $22.50-$27.00 | $45.00-$54.00 |

Dense textbooks or PDFs can be much higher. A 500-word page is about 3,000
characters, which is about $0.09/page on `tts-1-hd` or $9 per 100 pages.

Conclusion: best-quality AI voice is too expensive to include as unlimited
monthly listening. Treat it as a capped premium allowance or a separate natural
voice pack. Device voice and future on-device AI voice are the long-listening
paths.

## AI Text Cost

AI text is much cheaper than cloud TTS if context size is controlled.
Every Ask, Summary, Explain, Simplify, or Key points action goes through the
backend AI route and can spend OpenAI text-model tokens unless the exact result
is served from cache. These actions are included in `aiActionsPerMonth`: AI Pro
currently has 500/month and Power has 2,000/month. Free and Reader Plus should
not be able to call this route.

Example costs using current OpenAI text prices checked on 2026-06-28:

| Example action | Model | Cost/action | 500 actions | 2,000 actions |
| --- | --- | ---: | ---: | ---: |
| Light: 2k input, 500 output | `gpt-5.4-nano` | $0.000513 | $0.26 | $1.03 |
| Heavy: 20k input, 2k output | `gpt-5.4-nano` | $0.003250 | $1.63 | $6.50 |
| Light: 2k input, 500 output | `gpt-5.4-mini` | $0.001875 | $0.94 | $3.75 |
| Heavy: 20k input, 2k output | `gpt-5.4-mini` | $0.012000 | $6.00 | $24.00 |

Conclusion: AI text can fit paid tiers if we cap actions, cap context windows,
cache repeated work, and choose the model intentionally. The real danger is
cloud voice, not summaries/Q&A.

## Store and Platform Fees

For Google Play, use about 15% as the conservative service-fee assumption for
subscription revenue unless the Play Console account shows a different exact
rate. Google is rolling out a newer lower-fee model starting June 30, 2026 for
the US/UK/EEA; for first-$1M recurring transactions the service fee is 10%, but
transactions that use Google Play Billing in the US/UK/EEA add a 5% billing fee,
so the practical planning number can still be about 15%. Re-check Play Console
before changing prices. RevenueCat is free up to $2,500 monthly tracked revenue,
then 1% of tracked revenue.

Approximate monthly net before OpenAI/Render:

| Listed price | After 15% Play fee | After 15% Play + 1% RevenueCat |
| ---: | ---: | ---: |
| $4.99 | $4.24 | $4.19 |
| $9.99 | $8.49 | $8.39 |
| $19.99 | $16.99 | $16.79 |
| $29.99 | $25.49 | $25.19 |

Render is a shared fixed cost, not a per-listening-hour cost. As of the current
pricing page, web service compute includes small paid tiers in the single or
double-digit dollars per month and bandwidth overages. OCR/PDF extraction may
force a larger instance if public usage grows.

## Recommended Plan Shape

This is the conservative, profit-protecting plan shape as of 2026-06-29.
It intentionally makes Reader Plus a strong non-AI reading product while keeping
OCR, rF AI, Cloud AI, and AI questions as clear upgrade reasons.

| Tier | Suggested price | What should be included | Cost risk |
| --- | ---: | --- | --- |
| Free | $0 | 1 saved book, about 100 pages, native text preview, bookmarks/basic settings, no read-aloud | Render CPU/bandwidth only |
| Reader Plus | $4.99/mo | Ad-free full native-text reading, larger library, device read-aloud, themes, bookmarks, focus/follow, good multilingual text-layer PDFs | Render import CPU/bandwidth |
| AI Pro | $11.99-$14.99/mo | Everything in Reader Plus, OCR, rF AI voice, limited AI Q&A/summaries, small Cloud AI voice allowance | Fine if OCR/AI/cloud voice are capped |
| Power | $24.99-$29.99/mo | Higher OCR/AI/cloud voice limits, larger books, exports/batch tools, priority heavy-reader features | Must hard-cap cloud voice |
| AI voice / OCR packs | Separate add-on | Extra Cloud AI voice characters or extra OCR pages after monthly limits | Best match to real marginal cost |

Recommended starting limits:

| Tier | OCR pages / month | AI actions / month | Cloud AI voice / month | rF AI |
| --- | ---: | ---: | ---: | --- |
| Free | 0 | 0 | 0 | No |
| Reader Plus | 0 | 0 | 0 | No |
| AI Pro | 1,000 | 100-200 | 30k-60k chars | Yes, initially English |
| Power | 3,000 | 500-1,000 | 180k chars | Yes, with future language packs |

Upgrade logic:

- Free users should understand the app value through the reading layout, but
  Listen, OCR, rF AI, Cloud AI, and Ask AI should show a clean upgrade prompt.
- Reader Plus should be excellent for real readers of proper PDFs and Word
  files. It should not include OCR or AI; scanned/image PDFs should clearly say
  AI Pro can unlock them with OCR.
- AI Pro should feel like the main paid plan: OCR for scanned books, rF AI
  with no cloud voice cost, and enough AI help to taste the value without making
  unlimited OpenAI spend possible.
- Power is for heavy scanned books, study/research use, exports, and higher
  monthly limits.
- Extra Cloud AI voice and extra OCR should be sold as top-ups, not silently
  included, because those are the features with real marginal cost.

If cloud voice must be high quality (`tts-1-hd`), keep allowances very small:

- AI Pro: 1 hour/month included, then upsell.
- Power: 3-5 hours/month included, then upsell.

If using cheaper/lower-latency `tts-1`, allowances can be larger but still need
hard caps. Do not allow 12 hours/day cloud listening in normal paid tiers.

## Free Tier Abuse Guard

The desired free limit of 1 book / about 100 pages needs a stable user identity.

Options:

- RevenueCat anonymous app user id for every install, including free users.
- Google Play account-backed purchase/entitlement identity once subscriptions
  are live.
- Google Sign-In if we need account portability.
- Play Integrity / App Set ID as an additional abuse signal, not the only user
  identity.

Pure local limits are easy to reset by uninstalling/reinstalling. IP-only limits
are also weak and can punish shared networks. For public release, send a stable
`x-app-user-id` to the backend before enforcing serious quotas.

## Implementation Checklist Before Public Pricing

1. DONE: cloud voice is capped in AI Pro/Power and extra use should be sold as
   a top-up.
2. DONE: explicit backend limit is `cloudVoiceCharsPerMonth`.
3. DONE: mobile natural/cloud voice uses `entitlement.features.cloudVoice`, not
   generic `ai`.
4. DONE: backend `/api/tts` is gated by `cloudVoice` and monthly character
   usage.
5. DONE in source: first rF AI voice uses Sherpa-ONNX plus on-demand
   Supertonic Reader, outside cloud voice quota. Needs native phone QA before
   product claims.
6. Product recommendation: rF AI starts at AI Pro, not Free/Reader Plus. It has
   no vendor bill, but it is a premium-feeling feature and a strong upgrade
   reason.
7. DONE in source: Free is 1 book/about 100 pages with no read-aloud.
8. Wire RevenueCat production SDK/user id so paid limits follow the Play account
   / RevenueCat customer, not only a local device install id.
9. Move OpenAI production billing to a dedicated readFlow project/key with spend
   alerts.
10. Re-check OpenAI model pricing and choose the AI text model/TTS model
   intentionally.
11. Add usage logging for AI actions, OCR pages, PDF extractions, and cloud voice
   characters.
12. Recalculate margins after real beta telemetry.
