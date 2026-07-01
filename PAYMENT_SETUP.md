# readFlow Payment Setup

Updated: 2026-07-01

This is the payment handoff for Google Play, Apple App Store, RevenueCat, the
backend, and the mobile app. It is intentionally operational: another developer
should be able to open this file and know what still has to be done before
readFlow can sell paid plans.

Policy sources checked on 2026-06-29:

- Google Play Payments policy:
  https://support.google.com/googleplay/android-developer/answer/10281818
- Google Play Billing integration:
  https://developer.android.com/google/play/billing
- Subscription lifecycle and purchase acknowledgement:
  https://developer.android.com/google/play/billing/lifecycle/subscriptions
- Apple In-App Purchase:
  https://developer.apple.com/in-app-purchase/
- Apple App Review Guidelines:
  https://developer.apple.com/app-store/review/guidelines/
- RevenueCat Android product setup:
  https://www.revenuecat.com/docs/getting-started/entitlements/android-products
- RevenueCat iOS product setup:
  https://www.revenuecat.com/docs/getting-started/entitlements/ios-products
- RevenueCat Google Play service credentials:
  https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials
- RevenueCat App Store Connect API key setup:
  https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret/app-store-connect-api-key-configuration

## Current Status

Payment is partially wired, but not ready for public paid release yet.

Already present:

- Backend plan definitions in `backend/src/config/plans.ts`.
- Backend entitlement lookup through RevenueCat in
  `backend/src/services/entitlements.ts`.
- Mobile sends a stable local install id as `x-app-user-id`.
- Free, Reader Plus, AI Pro, and Power plan copy exists in the paywall.
- Mobile now includes `react-native-purchases` and can configure RevenueCat with
  the same stable `rf_...` install id used for backend entitlements.
- The paywall can open the native purchase flow and restore purchases once a
  RevenueCat public SDK key and a valid offering are present.

Missing before paid launch:

- Google Play subscription products are created and active, but sandbox purchase
  and restore testing is not complete yet.
- Apple App Store in-app purchase products are not created/tested.
- RevenueCat offerings are not configured.
- The backend still needs the production RevenueCat secret key in Render.
- Platform-specific RevenueCat public SDK keys are not set in release build
  environment yet.
- The production backend service has been converted from the old internal
  service. Current reachable URL:
  `https://readflow-backend-internal.onrender.com`. The service name is
  `readflow-backend`, but Render kept the original subdomain. The old
  `https://readflow-backend.onrender.com` URL returned Render's
  `Service Suspended` page on 2026-06-29 and must not be used by Play builds.

Until these are complete, Android and iOS can be released only as free previews
with paid features locked. If the RevenueCat public key or offering is missing,
the paywall CTA remains disabled as "Setting up purchases".

## Product IDs

The backend currently defines these product ids:

| Tier | Monthly product id | Yearly product id | Current code price |
| --- | --- | --- | --- |
| Reader Plus | `readflow_reader_plus_monthly` | `readflow_reader_plus_yearly` | $4.99/mo, $39.99/yr |
| AI Pro | `readflow_ai_pro_monthly` | `readflow_ai_pro_yearly` | $12.99/mo, $119.99/yr |
| Power | `readflow_power_monthly` | `readflow_power_yearly` | $29.99/mo, $279.99/yr |

RevenueCat entitlement ids:

| Tier | Entitlement id |
| --- | --- |
| Reader Plus | `reader_plus` |
| AI Pro | `ai_pro` |
| Power | `power` |

Important pricing note: source now uses the cost-safe launch prices above.
`backend/src/config/plans.ts` contains a 20% direct AI vendor COGS guardrail.
If prices, annual discounts, Cloud AI voice, or AI action allowances change, run
backend build/checks and confirm the guardrail still passes before creating or
updating Play products.

For App Store products, prefer mirroring the same product ids so RevenueCat
offerings and backend product mapping stay symmetric across stores. If App
Store product ids differ, update this file, RevenueCat mappings, and any
backend/mobile product-id assumptions in the same change.

## Suggested Top-Up Product IDs

Use one-time consumable products for cost-bearing overages after subscriptions
are live:

| Product id | Purpose | Suggested starting use |
| --- | --- | --- |
| `readflow_voice_25k_chars` | Extra Cloud AI voice | Adds 25,000 Cloud AI voice characters |
| `readflow_ocr_500_pages` | Extra OCR | Adds 500 OCR pages |
| `readflow_ai_200_actions` | Extra AI help | Adds 200 AI actions |

Do not make Cloud AI voice unlimited. At heavy listening levels it can cost
hundreds of dollars per user per month if uncapped.

Top-up pricing should also obey the 20% direct AI vendor COGS rule. With
`tts-1-hd`, 25k Cloud AI voice characters cost about $0.75 in OpenAI spend, so
a $4.99 store-billing top-up nets about $4.19 after an assumed 15% store fee
plus 1% RevenueCat and keeps direct AI vendor cost around 18%. A 100k character
top-up costs about $3 in OpenAI spend and would need to be priced around
$17.99+ to keep the same margin.

## Google Play Console Setup

1. Upload a signed AAB to an internal or closed testing track first. RevenueCat
   documents that an APK/AAB must be uploaded before Android products can be
   created in Play Console.
2. In Play Console, create subscription products for the six subscription ids.
3. Add monthly/yearly base plans or equivalent subscription configuration.
4. Set prices and countries.
5. Configure trial/intro offers only after the basic purchase flow is stable.
6. Add license testers.
7. Confirm the app has billing capability after the RevenueCat SDK is added.
8. Complete Play App content sections: Data safety, Privacy policy, Content
   rating, Target audience, Ads declaration, App access, and Payments.

2026-07-01 Play Console status:

- Internal test build `1.0.24` / versionCode `24` is uploaded and includes
  `com.android.vending.BILLING`.
- Privacy policy, app access, ads, government apps, financial features, health,
  and content rating were completed or saved in Play Console. Content rating
  summary was saved with online/generated content and in-app purchases declared.
- All six Google Play subscription products are created and each has one active
  auto-renewing base plan:

| Product id | Name | Base plan id | Period | USD anchor price |
| --- | --- | --- | --- | --- |
| `readflow_reader_plus_monthly` | Reader Plus Monthly | `uw-baseplan01` | Monthly | $4.99 |
| `readflow_reader_plus_yearly` | Reader Plus Yearly | `uw-baseplan02` | Yearly | $39.99 |
| `readflow_ai_pro_monthly` | AI Pro Monthly | `uw-baseplan03` | Monthly | $12.99 |
| `readflow_ai_pro_yearly` | AI Pro Yearly | `uw-baseplan04` | Yearly | $119.99 |
| `readflow_power_monthly` | Power Monthly | `uw-baseplan05` | Monthly | $29.99 |
| `readflow_power_yearly` | Power Yearly | `uw-baseplan06` | Yearly | $279.99 |

- Earlier Play Console Save failures happened with several generated ids. The
  working pattern was the short company-prefixed base plan ids above.
- Subscription benefits were added in Play Console:
  - Reader Plus: clean PDF/Word reading, device voice reading, bookmarks/focus/progress.
  - AI Pro: Reader Plus features, OCR and AI reading help, rF AI and Cloud AI voices.
  - Power: higher OCR/AI limits, more Cloud AI voice time, heavy reading use.

Google Play requires Play Billing for in-app purchases of digital goods and
services distributed through Google Play. Do not send users from the app to a
website to buy Reader Plus, AI Pro, Power, OCR pages, or voice packs.

## App Store Connect Setup

1. Create or verify the App Store Connect app for bundle id
   `com.urmiaworks.readflow`.
2. Complete Agreements, Tax, and Banking before testing paid in-app purchases.
3. Create an auto-renewable subscription group for readFlow plans.
4. Create subscription products for the six subscription ids, preferably using
   the same ids listed above.
5. Set prices, countries/regions, subscription durations, and localization.
6. Configure sandbox testers.
7. Create an App Store Connect API key and store the `.p8` file securely.
8. Add App Store credentials to RevenueCat according to RevenueCat's iOS setup.
9. Complete App Privacy, age rating, review notes, support URLs, privacy URL,
   and terms URL before submission.

Apple in-app purchase must be used for digital subscriptions and in-app digital
top-ups sold inside the iOS app. Do not send users from the iOS app to a website
to buy Reader Plus, AI Pro, Power, OCR pages, or voice packs.

## RevenueCat Setup

1. Create a RevenueCat project for readFlow.
2. Add the Android app package `com.urmiaworks.readflow`.
3. Add the iOS app bundle id `com.urmiaworks.readflow`.
4. Add Google Play service credentials according to RevenueCat's guide.
5. Add App Store Connect API key / App Store credentials according to
   RevenueCat's iOS guide.
6. Import or create the Play and App Store subscription products.
7. Create entitlements:
   - `reader_plus`
   - `ai_pro`
   - `power`
8. Attach the correct products from both stores to the correct entitlements.
9. Create an offering named `default`.
10. Add monthly and yearly packages for each paid tier. For Google Play, expect
    RevenueCat to reference products using either the plain Play product id or
    a `product_id:base_plan_id` identifier; mobile source `1.0.24+` accepts both.
11. Set the RevenueCat public SDK key for Android as
    `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` for EAS builds, or as
    `expo.extra.revenueCatAndroidApiKey` in `mobile/app.json` for local
    controlled test builds.
12. Set the RevenueCat public SDK key for iOS as
    `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, or as
    `expo.extra.revenueCatIosApiKey` for local controlled test builds.
13. Copy the RevenueCat secret/server key into Render as `RC_SECRET_KEY`.
14. Test purchase, restore, cancellation, grace period, billing retry, and
    expired subscription on both Android and iOS.

RevenueCat normally handles purchase acknowledgement, but verify this in sandbox.
Google Play can refund and revoke purchases that are not acknowledged within the
required window.

## Backend Setup

Production Render service must have:

| Env var | Required value |
| --- | --- |
| `ENTITLEMENTS_DEV_OVERRIDE` | `false` |
| `RC_SECRET_KEY` | RevenueCat production secret key |
| `APP_KEY` | Production app key matching `mobile/app.json` |
| `OPENAI_API_KEY` | Dedicated readFlow OpenAI API key |
| `AI_PROVIDER` | `openai` for production AI |
| `TTS_PROVIDER` | `cloud` for Cloud AI voice |
| `TTS_MODEL` | Decide intentionally, currently `tts-1-hd` |

Render production health must return 200 before a public release:

```powershell
Invoke-WebRequest https://readflow-backend-internal.onrender.com/api/health
```

The internal Render service can use `ENTITLEMENTS_DEV_OVERRIDE=true` for testing,
but it must not be used in public builds because it grants paid access.

## Mobile Work Still Needed

Mobile RevenueCat wiring status as of source `1.0.24`:

1. `react-native-purchases@10.4.0` is installed.
2. The app reads `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` and
   `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, with `mobile/app.json` fallback fields.
3. RevenueCat is configured with the stable local `rf_...` app user id, and the
   backend receives that same id as `x-app-user-id`.
4. The app fetches the current RevenueCat offering and maps packages by product
   id, not by RevenueCat package label.
5. `UpgradeSheet` opens purchase and restore flows only after mapped packages
   are available.
6. After purchase or restore, the app refreshes backend entitlement and usage.
7. Purchase cancellation, pending payment, network errors, inactive products,
   and missing offerings show themed in-app messages.
8. Free still cannot call OCR, AI text, Cloud AI voice, rF AI, or read-aloud.

Still required before paid launch:

- Add the RevenueCat Android public SDK key to the EAS build environment.
- Set `RC_SECRET_KEY` on Render production.
- Import the active Google Play products into RevenueCat and attach them to the
  entitlements and default offering.
- Upload a billing-capable AAB (`1.0.24` or later) to Play internal testing.
- Complete sandbox purchase and restore tests on a Play license tester account.

## Sandbox Test Matrix

Before paid production:

- Fresh install with no purchase: tier is Free, read-aloud locked, OCR locked,
  AI locked, Cloud AI locked, rF AI locked.
- Buy Reader Plus monthly: device read-aloud works; OCR, AI, rF AI, and Cloud AI
  remain locked.
- Buy AI Pro monthly: OCR works within allowance; AI Q&A works; rF AI works for
  English after model download; Cloud AI works only for QA-approved languages
  and within character allowance.
- Buy Power yearly: higher limits appear from backend.
- Cancel subscription: entitlement remains active until expiry, then falls back.
- Restore purchase on reinstall: paid tier returns.
- License tester purchase is acknowledged. Watch Play Console orders; sandbox
  purchases can be refunded quickly if acknowledgement fails.
- iOS sandbox/TestFlight purchase and restore work with the App Store sandbox
  account.
- Backend quota uses the RevenueCat app-user id, not `anonymous`.
- Public builds cannot accidentally use internal/dev Render entitlement override.

## Release Decision

Do not submit a paid Play release until all of these are true:

- Production backend health is green.
- RevenueCat SDK purchase and restore flows work on connected Android and iOS
  devices.
- RevenueCat secret is set on production Render.
- Play and App Store products are active and mapped to the correct entitlements.
- Privacy Policy, Terms, Play Data Safety, and App Store App Privacy answers
  match the final SDK/data flow.
- `npm run check:release` passes.
- A fresh Play internal-testing install and TestFlight install pass the
  subscription test matrix.
