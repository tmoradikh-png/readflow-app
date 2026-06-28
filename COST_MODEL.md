# ReadFlow Pricing and Cost Model

Updated: 2026-06-28

This file records the business model assumptions for ReadFlow so another
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

## Current Implementation Warning

Before public release, fix these mismatches:

- `backend/src/config/plans.ts` currently says `cloudVoice: false` for every
  tier and `cloudVoiceAvailable: false`.
- `mobile/src/components/Reader.tsx` currently unlocks natural voice with
  `canUseCloudVoice = canUseAI`, so AI Pro users can reach cloud TTS even though
  the plan config says cloud voice is not a launch feature.
- `backend/src/routes/tts.ts` defaults to `tts-1-hd`, and `render.yaml` also
  sets `TTS_MODEL=tts-1-hd`. This is the more expensive legacy TTS model.
- Free-tier limits are not aligned with the latest product decision. The user
  wants roughly 1 free book and around 100 pages. Current backend config is
  `pdfsPerMonth: 30` and `perDocPageCap: 30`; the mobile reader also has
  `ENFORCE_FREE_LIMIT=false`, so local reading is not actually capped in-app.

Do not launch public subscriptions until the cloud voice allowance and free
limits are explicit and enforced by the backend.

## Key Principle

The free tier must have no marginal API cost to us.

Allowed in free:
- Device/on-phone TTS only.
- Native text extraction for a small number of pages/books.
- Local reading, bookmarks, and basic settings.
- Ads if the product uses ads later.

Not allowed in free:
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
- Render is used when the user imports/extracts a PDF or DOCX, and when paid OCR
  is needed for scanned/image pages.
- OCR has no OpenAI/API cost in the current backend, but it consumes Render CPU
  and memory. This is why Reader Plus still needs OCR page caps and concurrency
  limits.

Current Reader Plus config:

- Price: $4.99/month or $39.99/year.
- OCR: 300 pages/month.
- Server document extractions: 100/month.
- Max file size: 50 MB.
- Max processed pages per document: 500.
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
with device voice. The risky part is not reading time; it is many large imports
and scanned/OCR-heavy books. Keep OCR capped, queue or throttle concurrent OCR,
and move long-term caching/storage carefully.

## OCR Cost Per Page

Reader Plus currently has a 300 OCR pages/month allowance. This is not a limit
on normal reading pages. It only applies to scanned/image pages that need OCR.
A normal text PDF can be read and listened to with device voice for no per-hour
vendor cost after import.

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

At $4.99/month, Reader Plus nets roughly $4.19 after conservative Play +
RevenueCat fees. If a user consumes the full 300 OCR pages, revenue is about
$1.40 per 100 OCR pages. This is healthy at moderate shared volume, but a very
small user base with many OCR-heavy users can feel expensive because the fixed
server cost is spread over too few subscriptions.

Recommendation: allow unlimited normal reading/device listening in Reader Plus,
but keep OCR capped, measured, and queue-limited. Start with 300 OCR pages/month,
then adjust after real telemetry.

## Multi-Month OCR for Large Scanned Books

Reader Plus should allow a user to finish one large scanned book over multiple
months instead of forcing an upgrade.

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
- Prefer high-quality Google/Samsung/Apple voices when available.
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

- Create a dedicated OpenAI project for ReadFlow.
- Create a service key for the backend only.
- Put that key in Render as `OPENAI_API_KEY`.
- Set project spend limits/alerts.
- Use prepaid credits or strict billing limits so a bug cannot silently create a
  large bill.
- Do not use a personal all-purpose key for public production.
- Rotate the current key before public release if it was ever shared broadly.

Important: a ChatGPT/Codex Pro subscription does not pay for ReadFlow API calls.
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

This is the conservative, profit-protecting plan shape:

| Tier | Suggested price | What should be included | Cost risk |
| --- | ---: | --- | --- |
| Free | $0 | 1 saved book, about 100 pages, device voice, native text only | Render CPU/bandwidth only |
| Reader Plus | $4.99/mo | Ad-free, bigger library, OCR allowance, device voice | OCR CPU on Render |
| AI Pro | $9.99-$14.99/mo | AI text actions, OCR, device voice, maybe 1-2 cloud voice hours | Fine if cloud voice capped |
| Power | $19.99-$29.99/mo | Higher AI/OCR/export limits, maybe 5 cloud voice hours using cheaper TTS | Must hard-cap cloud voice |
| Natural Voice Pack | Separate add-on | Extra cloud voice hours or pay-as-you-go credits | Best match to real OpenAI cost |

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

1. Decide whether cloud voice is included, capped, or sold only as an add-on.
2. Add explicit cloud voice limits to backend plan config, for example
   `cloudVoiceMinutesPerMonth` or `cloudVoiceCharactersPerMonth`.
3. Gate mobile natural voice from `entitlement.features.cloudVoice`, not `ai`.
4. Gate backend `/api/tts` with the cloud voice entitlement and monthly usage.
5. Decide free tier: 1 book and about 100 pages, then update backend and mobile
   to match.
6. Wire RevenueCat production SDK/user id so limits follow a user/install, not
   only a local device state.
7. Move OpenAI production billing to a dedicated ReadFlow project/key with spend
   alerts.
8. Re-check OpenAI model pricing and choose the AI text model/TTS model
   intentionally.
9. Add usage logging for AI actions, OCR pages, PDF extractions, and cloud voice
   characters.
10. Recalculate margins after real beta telemetry.
