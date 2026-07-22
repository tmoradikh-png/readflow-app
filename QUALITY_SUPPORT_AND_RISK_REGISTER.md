# readFlow Quality, Support, and Risk Register

Updated: 2026-07-22

Owner: Urmia Works  
Support: `support@urmiaworks.com`

This is the operational source of truth for expected behavior, known product
limitations, incident handling, subscription tracing, and promotions. It is
written for support, engineering, store review, and handover. It does not
replace legal advice. Public terms and privacy text must be reviewed for the
operator's jurisdiction before publication, and nothing here limits rights that
cannot legally be limited.

## Release Position

readFlow supports comfortable reflowed reading for many text-based PDFs and
text-based Word `.docx` files. It also provides device voice, an optional
downloaded English rF AI voice, OCR on eligible plans, AI reading help, and
Cloud AI voice for quality-approved languages.

The product must not be marketed as compatible with every PDF, scan, language,
font, layout, formula, or device. Extraction, OCR, speech, and AI are assistive
processing. Readers should compare important material with the original.

## Current Plan Contract

The backend definition in `backend/src/config/plans.ts` is authoritative.

| Plan | Imports and document size | rF AI | OCR | AI help | Cloud AI voice |
| --- | --- | --- | ---: | ---: | ---: |
| Free | 1 import/month, 20 MB, 300 pages/document | 5 min/day | None | None | None |
| Reader Plus | 100 imports/month, 100 MB, 2,000 pages/document | 30 min/day | None | None | None |
| AI Pro | 300 imports/month, 100 MB, 2,500 pages/document | Unlimited where supported | 750 pages/month | 150 actions/month | 20,000 chars/month |
| Power | 1,000 imports/month, 200 MB, 5,000 pages/document | Unlimited where supported | 2,500 pages/month | 400 actions/month | 100,000 chars/month |

`Unlimited` means the plan does not meter rF AI minutes. It does not promise
compatibility with every phone, language, document, battery state, or available
storage. Abuse and technical safety limits still apply.

## Language Behavior

The shelf language selector currently exposes 21 languages: English, Spanish,
French, German, Italian, Portuguese, Dutch, Swedish, Norwegian, Danish,
Finnish, Turkish, Indonesian, Vietnamese, Japanese, Korean, Simplified Chinese,
Hindi, Russian, Arabic, and Persian.

### French example

For a French book today:

- A PDF with a usable French text layer can be imported and displayed without
  OCR, subject to the active plan's import and size limits.
- Phone voice uses a compatible French voice installed on the Android device.
- AI Pro and Power can OCR scanned French pages using the French OCR language.
- AI reading help is instructed to answer in French.
- Cloud AI voice is enabled because French has passed the current product gate.
- Downloaded rF AI is not offered because the current rF AI pack is English.

### Other languages

- Phone voice depends on a compatible voice installed by the phone vendor.
- OCR is configured for all 21 listed languages, but accuracy depends on scan
  quality, script, typography, columns, page rotation, and correct language
  selection.
- Cloud AI voice is currently enabled for English, Spanish, French, German,
  Italian, Portuguese, Dutch, Swedish, Norwegian, Danish, Finnish, Turkish,
  Indonesian, and Vietnamese.
- Cloud AI voice remains quality-gated for Japanese, Korean, Simplified
  Chinese, Hindi, Russian, Arabic, and Persian. Device voice remains available.
- Arabic and Persian use right-to-left extraction and display handling. Complex
  mixed-direction pages still require visual checking.
- Downloaded rF AI is English-only. Additional language packs require separate
  model selection, licensing, quality testing, download UI, and release QA.

## Large and Difficult Documents

The server rejects a file larger than the plan limit with HTTP 413 and a themed
upgrade explanation. It rejects unsupported formats with HTTP 415 and monthly
import exhaustion with HTTP 429. If a document exceeds its page limit, readFlow
processes only the allowed prefix and returns a truncation flag/page cap so the
app can explain the limit and offer a higher tier.

Large scanned documents do not need to finish OCR before opening. The first
eligible pages are processed, remaining pages are queued on demand, completed
OCR pages are cached, and the reader can pause, stop, or resume the job. When a
monthly OCR allowance is exhausted, completed pages remain saved and remaining
pages can continue after reset or on a higher plan.

Expected limitations:

- Password-protected, damaged, or unsupported-encryption PDFs may fail.
- A visually clean PDF can still contain a broken, out-of-order, or custom-
  encoded text layer.
- Multi-column pages, tables, equations, footnotes, sidebars, captions, and
  decorative typography can be interpreted imperfectly.
- Picture-only Word files and legacy `.doc` files are not supported as normal
  text documents. Use a text-based `.docx` or PDF; scanned PDFs require OCR.
- Very large books use more phone storage and memory and take longer to index.
- A model download, Cloud AI, OCR, or AI help can pause when network access is
  unavailable. Existing cached native text and phone voice remain local.

## Known Quality Risks

These are product risks to monitor, not claims that every build currently has
the defect. Regression coverage is recorded in
`READER_REGRESSION_CHECKLIST.md`.

| Area | Possible symptom | Expected handling |
| --- | --- | --- |
| Text extraction | Wrong order, missing glyphs, odd characters | Keep original file; offer Fix text/OCR on eligible plans |
| OCR | Misspelled or joined words, low confidence | Show OCR source/progress; user verifies against original |
| Reflow | Heading, list, table, caption, or footnote misclassified | Preserve displayed wording; report with page and language |
| Speech preparation | Pause, emphasis, abbreviation, or name sounds wrong | Preserve meaningful words; fall back to source text when confidence is low |
| rF AI | English-only, model/device incompatibility, CPU/battery use | Explain model requirement; offer Phone voice or eligible Cloud AI |
| Device voice | Voice quality or language varies by phone | Let reader select an installed voice/accent |
| Cloud AI | Network latency, allowance exhaustion, language quality gate | Prefetch, stop cleanly, and offer local/device alternatives |
| Reader position | Resume, bookmark, rotation, or list re-anchor drift | Stable page/sentence anchors; regression-test long books |
| Background audio | Stops outside the app on ineligible plan/device | Only AI Pro and Power promise eligible generated-audio background playback |
| Subscription | Store purchase temporarily still shows Free | Refresh/restore; match Support ID in RevenueCat; inspect Play order |
| Backend | Render restart, overload, or provider outage | Fail closed for paid features; retain local reading where possible |

## How Bugs Are Detected

### Automatic signals

1. Google Play Console: `Monitor and improve > Android vitals > Overview` for
   crash rate, ANR rate, battery issues, and device-specific clusters.
2. Google Play pre-launch report for automated device tests attached to a
   release candidate.
3. Render Logs and Metrics for HTTP errors, latency, OCR failures, provider
   errors, memory, CPU, and service restarts.
4. RevenueCat Customers and Events for purchase, renewal, cancellation,
   entitlement, and webhook/validation problems.
5. Release checks: backend TypeScript build, mobile TypeScript, release-config
   checks, reader regression fixtures, and signed-bundle manifest verification.

Android vitals is delayed and only includes eligible Play-installed devices
whose users share diagnostics. It is not a complete real-time error stream.
readFlow does not currently include Sentry, Crashlytics, or another centralized
JavaScript exception service. Adding one is a post-launch improvement that
requires account setup, privacy/Data Safety review, source maps, and alerting.

### User reports

The About sheet has **Report a problem**. It prepares an email containing app
version/build, plan, Android version, and the anonymous readFlow Support ID.
Support can match that ID to RevenueCat without asking for a password. The user
is prompted for steps, expected behavior, document language/type/pages/size,
and is told not to send a private document unless requested.

Never ask for passwords, payment-card details, recovery codes, API keys, or a
Google account password. Request the smallest non-confidential sample page that
reproduces a document issue. Delete support documents when no longer needed.

## Incident Triage

| Severity | Definition | Initial action target |
| --- | --- | --- |
| P0 | Security/privacy incident, widespread data exposure, uncontrolled spend | Disable affected endpoint or release immediately; notify owner |
| P1 | App will not open, widespread crash/ANR, purchases fail broadly, data loss | Triage same day; halt rollout or issue hotfix |
| P2 | Core reading, scrolling, resume, bookmark, OCR, or speech defect with workaround | Reproduce and place in next patch |
| P3 | Cosmetic, isolated document/voice issue, enhancement | Log with sample and prioritize by frequency |

For every reproducible defect record: build, device/Android version, plan,
Support ID if relevant, document type/language/page, expected/actual result,
reproduction steps, logs, severity, owner, fix commit, automated regression,
and connected-phone result.

## Subscription Tracking

- Google Play Order Management and financial reports are the financial source
  of truth for charges, refunds, cancellations, and payouts.
- RevenueCat is the entitlement and lifecycle dashboard. Search its Customers
  page using the `rf_...` Support ID from the app's report email. The profile
  shows products, entitlement, expiration, renewals, events, and promotional
  grants.
- The backend validates RevenueCat with `RC_SECRET_KEY`, caches the resolved
  entitlement briefly, and applies the highest active tier.
- The app has no required account/login. Therefore Urmia Works normally knows
  a subscriber by anonymous Support ID, not by name or email. This is privacy-
  preserving but means support must request that ID when matching a purchase.
- Never treat an app screenshot alone as proof of payment. Confirm the Play
  order and RevenueCat customer record, then use Restore purchases/refresh.

## One-Month Free Access and Promotions

Three supported methods are available:

### 1. One person: RevenueCat granted entitlement

Use when support, a reviewer, or a partner needs immediate access and provides
their `rf_...` Support ID.

1. Open RevenueCat > Customers and search the Support ID.
2. Open the customer profile and choose **Grant** in Entitlements.
3. Choose `reader_plus`, `ai_pro`, or `power` and set a one-month expiry.
4. Ask the user to open readFlow and Restore purchases/refresh.
5. Record who approved the grant, purpose, tier, Support ID, start, and expiry.

This does not create a Google Play subscription, does not charge the user, and
does not automatically convert to paid. Prefer Reader Plus for broad giveaways
because it has no direct AI vendor spend.

### 2. Individual campaign codes: Google Play one-off promo codes

Use one-off subscription codes for a limited set of people. In Play Console go
to `Monetize with Play > Promo codes`, create a subscription promotion, select
the product and one-month trial duration, then export and distribute unique
codes. Users can redeem one-off codes through Google Play or the app. Keep one
campaign per promoter so redemptions can be attributed.

### 3. Public acquisition offer: Google Play subscription offer

Create a 30-day new-customer offer on the selected base plan. Google Play
requires a valid payment method; unless cancelled, billing begins at the stated
price when the trial ends. The paywall and promotion must clearly show
eligibility, duration, renewal price, cancellation method, and when billing
starts.

Do not publish a custom multi-use Play code until in-app custom-code redemption
has been tested. Never grant uncapped Cloud AI. AI Pro and Power promotional
users remain protected by the same server quotas as paying users.

## Release Gate

Before production submission:

1. Confirm canonical plan prices/limits match mobile paywall, Play products,
   RevenueCat packages/entitlements, and release documents.
2. Run `npm run build` in `backend` and `npm run check:release` plus
   `npx tsc --noEmit` in `mobile`.
3. Verify no API key or service-account JSON is in Git or the AAB.
4. Test import, reading, bookmark/resume/page jump, rotation/lock/unlock,
   scrolling, Device voice, rF AI, Cloud AI, OCR, purchase, restore, and quota
   exhaustion on a Play-installed tester build.
5. Test at least English, one Latin non-English language (French), one RTL
   language (Persian or Arabic), and one CJK language with representative PDFs.
6. Verify Android manifest permissions and that microphone recording remains
   absent.
7. Review pre-launch report, Android vitals, Render health/logs, and RevenueCat
   credentials/events.
8. Use staged rollout when available; monitor P0/P1 signals before expansion.

## Approved User-Facing Limitation Text

Use this concise disclosure in support, store, and product copy where needed:

> Results depend on the document, language, layout, scan quality, phone, and
> selected voice. OCR, AI, and read-aloud can make mistakes. Check important
> content against the original. Features, supported languages, file limits,
> and monthly allowances vary by plan and may require internet access or a
> separate on-device model download.

