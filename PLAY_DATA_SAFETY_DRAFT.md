# readFlow Google Play Data Safety Draft

Updated: 2026-06-29

This file is a draft worksheet for the Google Play Data safety form. It must be
reviewed after the final payment SDK, analytics SDKs, crash tools, backend
retention, and legal policy are finalized. Google says developers are
responsible for accurate Data safety labels and keeping them consistent with the
privacy policy.

For iOS App Store App Privacy answers, use
`APP_STORE_RELEASE_PACKET.md` as the starting worksheet.

Policy sources checked on 2026-06-29:

- Data Safety form guidance:
  https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play Developer Program policy:
  https://support.google.com/googleplay/android-developer/answer/17105854

## High-Level Answers

Does the app collect or share user data?

```text
Yes. The app processes documents, document text, AI requests, usage counters,
technical logs, and purchase entitlement information depending on the features
used.
```

Is data encrypted in transit?

```text
Yes. The app uses HTTPS for backend calls where supported.
```

Can users request deletion?

```text
Yes. Users can delete local books in the app and can request backend deletion
or support help at support@urmiaworks.com.
```

Does the app sell data?

```text
No.
```

Does the app contain ads?

```text
No ads in this release.
```

## Data Types To Review In Play Console

### Files and docs

Collected:

```text
Yes, when the user imports documents or uses cloud extraction, OCR, AI answers,
or Cloud AI voice.
```

Purpose:

```text
App functionality: document import, extraction, reading view, OCR, AI answers,
and voice generation.
```

Required or optional:

```text
Optional in the sense that users choose which files to import, but required for
the document features they choose to use.
```

Shared:

```text
Review with counsel. Document data may be processed by service providers such as
Render and OpenAI. If they qualify under Google's service-provider exception,
this may not count as "shared" in the Data safety form. Do not mark as sold.
```

### App activity

Collected:

```text
Yes, usage counters such as imports, OCR pages, AI actions, and Cloud AI voice
characters are collected to enforce plan limits and prevent abuse.
```

Purpose:

```text
App functionality, account management, fraud prevention, security, and service
reliability.
```

### App info and performance

Collected:

```text
Likely yes for backend/server logs and app version/platform error context. If a
crash analytics SDK is added later, update this section.
```

Purpose:

```text
Diagnostics, security, debugging, and reliability.
```

### Device or other IDs

Collected:

```text
Yes. The app sends an app user id for quotas/entitlements. After RevenueCat is
wired, the RevenueCat app user id should be used for purchases and backend
entitlements.
```

Purpose:

```text
Account management, subscription entitlement, usage limits, fraud prevention,
and app functionality.
```

### Purchases

Collected:

```text
Yes after subscriptions are enabled. Google Play and RevenueCat provide purchase
and subscription status needed to unlock paid plans.
```

Purpose:

```text
App functionality, account management, payment entitlement, fraud prevention,
and customer support.
```

### Personal info

Collected:

```text
The app does not currently require a login email. Email may be collected if the
user contacts support. If Google Sign-In or account creation is added later,
update this section.
```

### Audio files

Collected:

```text
The app does not request microphone access and does not record user audio. Cloud
AI voice may generate audio from document text. Local generated audio may be
cached on device.
```

## Third Parties / Processors To List In Internal Notes

- Render: backend hosting.
- OpenAI: AI answers and Cloud AI voice when those features are used.
- RevenueCat: subscription entitlement and purchase management after payment is
  wired.
- Google Play: billing, subscriptions, refunds, and purchase management.
- Expo/EAS: build/deployment tooling, not necessarily runtime data collection.

## Final Checks Before Submitting Data Safety

- Confirm whether any analytics or crash SDKs are included in the final build.
- Confirm final RevenueCat SDK configuration and data categories.
- Confirm OpenAI data processing terms and retention settings for the production
  project.
- Confirm backend document retention and deletion behavior.
- Confirm privacy policy says the same thing as the Data safety form.
- Confirm the app still has no microphone permission and no audio recording.
- Confirm no ads SDK is included.
