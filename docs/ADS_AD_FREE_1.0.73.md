# Ad-Free Subscriptions - 1.0.73

November 16, 2026. Source committed/pushed as65f741c with before/after tags;
NOT released or device-tested.

## Approved Scope

One Android app, all reading/listening features free. Library banners for free
users, optional auto-renewing ad-free USD0.99/month or USD9.99/year (localized
Play prices elsewhere). Muted interstitials only on explicit return from a book,
after at least 10 foreground minutes, at least 20 minutes apart, max two per UTC
day. AdMob also caps the unit at two impressions/day. No app-open, delayed,
mid-reading, background or mid-listening ads. A close with unconfirmed audio stop
skips the ad. SDK mute and volume zero are set before loading.

Help always displays a selectable support@urmiaworks.com address, opens an email
draft, and displays a fallback if the email app cannot open. Nothing sends email
automatically. Legacy support contributions remain one-time, no ad removal.

Owner approved scoped GitHub/Expo transfers on the free quota and gated Play
submission. Exact approved notes:

> Added optional monthly and yearly ad-free subscriptions, muted ads at reading breaks, and easier email support. Reading and listening remain free.

No books, tester contacts, credentials, unrelated iOS/website work or new backend.
Before tag: readflow-before-ad-free-1.0.73-20261116 at f2ce2c1.

## Service Configuration

- Play product `readflow_ad_free`, name `readFlow Ad-Free`.
- Description: `Remove all ads while your subscription is active. Reading and listening remain free.`
- Base plans `monthly` (P1M) and `yearly` (P1Y) both observed Active on November16.
  US prices observed USD0.99 and USD9.99. Default grace period retained. No trials.
- Existing AdMob app `ca-app-pub-5199768562686629~3386452834`.
- Existing banner `ca-app-pub-5199768562686629/1338873995` unchanged.
- New interstitial `ca-app-pub-5199768562686629/8175009965`, name
  `readFlow Library Return`, Google-optimized All prices, text/image/video enabled,
  two impressions per day. No sensitive category/rating changes or ad clicks.
- Public RSA billing verification key copied from this app's Monetization setup
  to `mobile/native/readflow-offline/assets/readflow-billing-public-key.txt`.
  This is a PUBLIC verification key, not a signing private key or new identity.

## Billing And Limitations

Direct Play Billing9.1.0. Native subscription query, signed purchase verification,
PURCHASED-only grant, acknowledge (never consume), pending/cancellation, restore
and Google Play management link. Recheck foreground and every15 active minutes.
Uncertain billing state suppresses ads, rather than advertising to paying users.
Prices come from Play; no hardcoded fallback price or invented entitlement.

No paid backend or RevenueCat reactivation. Local signature checking is less
tamper-resistant than Google's recommended server verification. Play's device
purchase cache is not a real-time server expiry/refund feed. An acknowledgement
failure retries on a later app query; no off-device acknowledgement worker exists.
Offline reading always works, but fresh purchase/restore requires Google Play.
These limits must not be described as full server-verified subscription handling.

## Evidence And Release Gates

TypeScript, complete release/reader/OCR suite and mocked ad/subscription checks
passed, including an isolated committed Android source export. That export also
needs three historical backend source fixtures for regression/generation checks;
they are local test inputs, not a deployed server or part of the mobile upload.
Native billing module compiles separately against cached Billing9.1.0,
RN0.81.5 and Android36. Full local Gradle stopped before native compilation because
shared dependency build directories could not be deleted; no destructive cleanup
or repeated build attempt. This is not packaged-APK or device verification.

Still required: clean EAS build, real Play test purchase/restore/cancel/expiry,
native demo-ad/consent/layout/audio-stop/contact QA, release config checks,
updated public privacy text and final gated submission. Device tests only S23
with per-phone queue, no advertising-ID registration, no real purchase/ad traffic.
Proposed demo-ad internal81 then live-ad production82 strategy awaits owner
approval; do not submit production until gates pass. Only free build quota.

Google guidance:
- https://developer.android.com/google/play/billing/integrate
- https://developer.android.com/google/play/billing/security
- https://developer.android.com/google/play/billing/lifecycle/subscriptions
- https://developers.google.com/admob/android/global-settings
- https://support.google.com/googleplay/android-developer/answer/9857753

Local evidence/receipts and approvals: chat checkpoint under CODEX_CHECKPOINTS.
