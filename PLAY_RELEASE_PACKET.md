# readFlow Play Release Packet

Updated: 2026-07-01

This packet gathers the launch text and review checklist for Google Play. Keep
it in sync with `PAYMENT_SETUP.md`, `PRIVACY_POLICY_DRAFT.md`,
`TERMS_OF_USE_DRAFT.md`, `PLAY_DATA_SAFETY_DRAFT.md`, `MARKETING_PLAY_STORE.md`,
and `COST_MODEL.md`.

For iOS App Store submission text and App Privacy notes, use
`APP_STORE_RELEASE_PACKET.md`.

## Release Readiness

Current source status:

- App name/copy uses `readFlow` and `rF AI`.
- No tracked mobile source contains the previous local-AI label or old
  capability field.
- Source release candidate is `1.0.25 / versionCode 25`.
- Release checker passes for the current source configuration.
- Android permissions are minimal plus billing for subscriptions: `INTERNET`
  and `com.android.vending.BILLING`.
- Background audio has been removed; reading should stop when leaving the app.
- Free tier is a limited manual preview with no read-aloud, OCR, AI, rF AI, or
  Cloud AI.
- RevenueCat mobile SDK wiring is present. The Android public key is set in EAS,
  Google Play products are published in RevenueCat, and the `default` offering
  has all six paid packages. A fresh `1.0.25` AAB is still required because
  build 24 was created before the EAS public key was set.
- Play Console app-content progress on 2026-07-01: privacy policy, app access,
  ads, government apps, financial features, health, and content rating are saved
  or ready in Publishing overview.

Verified for paid launch prep:

- Production backend returned healthy from
  `https://readflow-backend-internal.onrender.com/api/health` on 2026-07-01.
  The service is named `readflow-backend`; the old
  `https://readflow-backend.onrender.com` URL returned `Service Suspended` on
  2026-06-29 and must not be used.
- RevenueCat dashboard setup is complete for Android paid-product wiring:
  project, Android app, entitlements, published products, Google Play
  service-account credentials, and all six `default` offering packages exist.
  Render production has `RC_SECRET_KEY` set and a random non-buyer entitlement
  probe returned `source: revenuecat`, `tier: free`. A fresh AAB built after
  the EAS RevenueCat public Android key and sandbox purchase/restore tests are
  still required.

Not ready for paid public launch:

- Fresh AAB built after the EAS RevenueCat public Android key is not uploaded
  yet.
- Sandbox purchase/restore tests are not complete yet.
- Privacy policy is live at `https://www.urmiaworks.com/readflow/privacy`.
  Confirm the final public terms URL before production submission.
- Google Play subscription products and base plans were created and activated
  on 2026-07-01. See `PAYMENT_SETUP.md` for product ids, base plan ids, and
  USD anchor prices.

## Play Store Listing

App name:

```text
readFlow
```

Title:

```text
readFlow: PDF Reader & Voice
```

Short description, under 80 characters:

```text
Read PDFs and text-based Word docs in a clean phone view, with voice and AI.
```

Full description:

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

Keywords and phrases:

```text
PDF reader, Word document reader, PDF voice reader, text to speech PDF, AI PDF reader, OCR PDF reader, study PDF, read aloud, mobile reading, document reflow, accessibility
```

Category:

```text
Books & Reference
```

Support email:

```text
support@urmiaworks.com
```

Website:

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

Recommended phone screenshots:

1. Shelf with imported books and clean `readFlow` branding.
2. Reader view showing reflowed PDF text and large comfortable typography.
3. Voice selector showing Phone voice, rF AI, and Cloud AI.
4. AI panel showing summary/explain/Q&A, with AI Pro/Power context.
5. OCR/Fix text progress screen for scanned PDFs.
6. Language selector showing multilingual OCR/voice options.
7. Upgrade sheet with Free, Reader Plus, AI Pro, and Power.

Avoid screenshots that imply every language, scan, or AI voice is perfect. Use
realistic examples and show limits where helpful.

## Subscription Disclosure Text

Use this near the paywall and store listing if paid launch is enabled:

```text
Subscriptions renew automatically unless cancelled in Google Play before the end of the current billing period. You can manage or cancel your subscription in Google Play. Monthly allowances reset each billing month. Unused AI, OCR, or Cloud AI voice allowance may not roll over unless stated in the app. Prices may vary by country and taxes. Refunds are handled by Google Play policies and applicable law.
```

Plan text:

```text
Free: Limited manual reading preview. No read-aloud, OCR, AI, rF AI, or Cloud AI.

Reader Plus: Full native-text reading for supported PDFs and text-based Word .docx files, bookmarks, saved progress, and Phone voice. OCR and AI are not included.

AI Pro: Reader Plus features, 750 OCR pages/month, 150 AI reading-help actions/month, rF AI where supported, and 45,000 Cloud AI voice characters/month for approved languages.

Power: Higher limits for heavy readers and scanned-book workflows: 2,500 OCR pages/month, 400 AI actions/month, and 100,000 Cloud AI voice characters/month for approved languages.
```

## App Review Notes

Use this for Play review when paid features are wired:

```text
readFlow does not require login for basic use. Paid features are sold through Google Play Billing using RevenueCat. Reviewers can install the internal test build, import a text-based PDF or .docx file, and test the free reading preview. Paid features such as OCR, AI Q&A, rF AI, and Cloud AI require a sandbox subscription or a configured test entitlement.

The app processes supported documents to create a phone-friendly reading view. OCR, AI answers, and Cloud AI voice use the backend. rF AI voice runs on the device after an optional model download. The app is not designed for children and does not contain ads in this release.
```

If paid purchases are not wired yet, use this instead:

```text
This build is a free preview/internal test build. Paid feature buttons are locked and do not charge the user. Google Play Billing is not active in this build.
```

## Play App Content Answers

Ads:

```text
No, the app does not contain ads in this release.
```

Target audience:

```text
Not designed for children. Suggested target age: 18+ for v1.
```

App access:

```text
No special login is required for basic use. If paid sandbox testing is needed, provide a Play license tester account and instructions after RevenueCat is wired.
```

Content rating:

```text
Books/Reference. No gambling, sexual content, violence, or regulated health/financial claims are provided by the app itself. User-provided documents may contain their own content.
```

Government/health/financial/news declarations:

```text
No. readFlow is a document reading, OCR, voice, and AI reading-assistance app.
```

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
- RevenueCat/Play Billing purchase and restore flow is tested if paid launch is
  enabled.
- Privacy Policy and Terms are live at the URLs in this packet.
- Data Safety form matches the final build, SDKs, and backend behavior.
- `npm run check:release` passes.
- Fresh install from Play internal testing passes the QA checklist in
  `RELEASE_GUIDE.md`.
