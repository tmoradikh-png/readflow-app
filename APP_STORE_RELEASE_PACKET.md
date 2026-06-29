# readFlow App Store Release Packet

Updated: 2026-06-29

This packet gathers iOS App Store listing text, App Review notes, subscription
disclosures, and App Privacy worksheet notes. Keep it in sync with
`IOS_RELEASE_GUIDE.md`, `PAYMENT_SETUP.md`, `PRIVACY_POLICY_DRAFT.md`,
`TERMS_OF_USE_DRAFT.md`, `PLAY_RELEASE_PACKET.md`, `MARKETING_PLAY_STORE.md`,
and `COST_MODEL.md`.

Policy sources checked on 2026-06-29:

- App Review Guidelines:
  https://developer.apple.com/app-store/review/guidelines/
- In-App Purchase:
  https://developer.apple.com/in-app-purchase/
- App Privacy Details:
  https://developer.apple.com/app-store/app-privacy-details/
- Manage app privacy in App Store Connect:
  https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/

## Release Readiness

Current source status:

- Source iOS candidate is `1.0.23 / buildNumber 23`.
- EAS iOS build history returned `[]` on 2026-06-29, so no iOS build is recorded
  yet for the Expo project.
- Bundle id is `com.urmiaworks.readflow`.
- Release checker validates iOS bundle id, build number, export compliance,
  foreground-only audio, no microphone usage string, and EAS iOS archive config.
- Free tier is a limited manual preview with no read-aloud, OCR, AI, rF AI, or
  Cloud AI.

Not ready for paid public launch:

- Apple Developer/App Store Connect account ownership must be verified.
- App Store Connect app record and TestFlight setup must be completed.
- RevenueCat/iOS App Store in-app purchases are not wired in the mobile purchase
  flow.
- Legal URLs are not live yet.
- App Privacy answers must be reviewed against the final SDK/data flow.
- rF AI needs real iPhone QA before public claims.

## App Store Listing

App name:

```text
readFlow
```

Subtitle, under 30 characters:

```text
PDF Reader & Voice
```

Promotional text:

```text
Turn supported PDFs and text-based Word documents into a cleaner phone reading view, with saved progress, voice options, and AI help on eligible plans.
```

Description:

```text
readFlow helps make long PDFs and text-based Word .docx documents easier to read on your phone.

Instead of forcing you to pinch and zoom a fixed page, readFlow turns supported documents into a clean mobile reading view, keeps your place, and can read aloud depending on your plan, phone, and language.

Features:

- Reflow supported PDFs and text-based Word .docx documents into phone-friendly text
- Read manually with clean typography, bookmarks, and saved progress
- Listen with Phone voice on eligible plans
- Use rF AI voice on eligible phones after downloading the voice model
- Use capped Cloud AI voice on supported paid plans and approved languages
- Highlight text while listening
- Ask AI for summaries, explanations, simplified text, key points, and answers on eligible plans
- Use OCR allowances on paid AI plans for scanned or image-based PDFs
- Choose document language for OCR, voices, and AI answers

Important notes:

- readFlow works best with clean text-based PDFs and modern Word .docx documents that contain real text.
- Scanned, image-heavy, damaged, blurred, skewed, noisy, phone-photo, legacy, or heavily formatted documents may require OCR and may not convert perfectly.
- OCR, AI answers, and AI voices are assistive features and may be incomplete or inaccurate.
- Voice quality and availability vary by language, device, installed voices, and plan.
- Some features require paid plans and monthly allowances.
```

Keywords, 100 characters max:

```text
PDF reader,OCR,read aloud,voice,AI,documents,study,Word,accessibility
```

Primary category:

```text
Books
```

Support URL:

```text
https://urmiaworks.com/readflow
```

Marketing URL:

```text
https://urmiaworks.com/readflow
```

Privacy policy URL:

```text
https://urmiaworks.com/readflow/privacy
```

Terms URL:

```text
https://urmiaworks.com/readflow/terms
```

## Screenshot Plan

Recommended iPhone screenshots:

1. Shelf with imported books and clean `readFlow` branding.
2. Reader view showing reflowed PDF text and comfortable typography.
3. Voice selector showing Device voice, rF AI, and Cloud AI.
4. AI panel showing summary/explain/Q&A with AI Pro/Power context.
5. OCR/Fix text progress for scanned PDFs.
6. Language selector showing multilingual OCR/voice options.
7. Upgrade sheet with Free, Reader Plus, AI Pro, and Power.

Avoid screenshots that imply every language, scan, or AI voice is perfect.

## Subscription Disclosure Text

Use this near the paywall and App Store description if paid launch is enabled:

```text
Subscriptions renew automatically unless cancelled before the end of the current billing period. You can manage or cancel subscriptions in your Apple ID account settings. Monthly allowances reset each billing month. Unused AI, OCR, or Cloud AI voice allowance may not roll over unless stated in the app. Prices may vary by country and taxes. Refunds are handled by Apple policies and applicable law.
```

Plan text:

```text
Free: Limited manual reading preview. No read-aloud, OCR, AI, rF AI, or Cloud AI.

Reader Plus: Full native-text reading for supported PDFs and text-based Word .docx files, bookmarks, saved progress, and Phone voice. OCR and AI are not included.

AI Pro: Reader Plus features, 750 OCR pages/month, 150 AI reading-help actions/month, rF AI where supported, and 45,000 Cloud AI voice characters/month for approved languages.

Power: Higher limits for heavy readers and scanned-book workflows: 2,500 OCR pages/month, 400 AI actions/month, and 100,000 Cloud AI voice characters/month for approved languages.
```

## App Review Notes

Use this if paid features are wired:

```text
readFlow does not require login for basic use. Paid features are sold through Apple in-app purchase using RevenueCat. Reviewers can install the TestFlight or App Store build, import a text-based PDF or .docx file, and test the free reading preview. Paid features such as OCR, AI Q&A, rF AI, and Cloud AI require a sandbox subscription or configured test entitlement.

The app processes supported documents to create a phone-friendly reading view. OCR, AI answers, and Cloud AI voice use the backend. rF AI voice runs on the device after an optional model download. The app is not designed for children and does not contain ads in this release.
```

If paid purchases are not wired yet, use this instead:

```text
This build is a free preview/TestFlight build. Paid feature buttons are locked and do not charge the user. Apple in-app purchase is not active in this build.
```

## App Privacy Worksheet

Use App Store Connect's current App Privacy form and review with counsel before
submission. This worksheet mirrors the current app design.

Data types likely to declare:

- User Content / Documents: imported PDFs/Word files, extracted text, page
  images, selected text, prompts, OCR text, generated AI responses, and cloud
  voice requests when cloud features are used.
- Identifiers: app user id for quotas and entitlements; RevenueCat app user id
  after subscriptions are wired.
- Purchases: subscription and entitlement status after in-app purchases are
  enabled.
- Usage Data: monthly counters for imports, OCR pages, AI actions, and Cloud AI
  voice characters.
- Diagnostics: backend logs and error context needed for debugging, abuse
  prevention, and reliability.
- Contact Info: support email and message content if users contact support.

Notes:

- No ads SDK is present in this release.
- The app does not request microphone access and does not record user audio.
- Document processing is for app functionality, not advertising.
- OpenAI/AI provider processing applies only when users invoke AI/cloud voice or
  when backend extraction/OCR requires cloud processing.
- Local rF AI model files and generated local audio can remain on the device.

## Public Claims To Use

Safe claims:

- "Designed to make long documents easier to read on a phone."
- "Works best with text-based PDFs and modern Word .docx files."
- "OCR is available on eligible AI plans and works best on crisp printed scans."
- "rF AI runs on supported phones after model download and uses phone CPU,
  storage, and battery."
- "Cloud AI voice is capped by monthly allowance and enabled only for approved
  languages."
- "AI answers are assistive and should be checked against the original document."

Avoid:

- "Perfectly reads every PDF."
- "Unlimited AI."
- "Works with all languages."
- "Human voice for every book."
- "Guaranteed OCR."
- "No errors."
- "Legal, financial, medical, or professional advice."

## Before Pressing Submit

- Production Render backend returns 200 from `/api/health`.
- Public build uses the verified converted production URL
  `https://readflow-backend-internal.onrender.com`, or a future custom domain
  that points to the same production service.
- `ENTITLEMENTS_DEV_OVERRIDE=false` in public Render.
- RevenueCat/App Store in-app purchase and restore flow is tested if paid launch
  is enabled.
- Privacy Policy and Terms are live at the URLs in this packet.
- App Privacy answers match the final build, SDKs, and backend behavior.
- `npm run check:release` passes.
- Fresh TestFlight install passes the QA checklist in `IOS_RELEASE_GUIDE.md`.
