# readFlow Payment Setup

Updated: 2026-06-29

This is the payment handoff for Google Play, RevenueCat, the backend, and the
mobile app. It is intentionally operational: another developer should be able to
open this file and know what still has to be done before readFlow can sell paid
plans.

Policy sources checked on 2026-06-29:

- Google Play Payments policy:
  https://support.google.com/googleplay/android-developer/answer/10281818
- Google Play Billing integration:
  https://developer.android.com/google/play/billing
- Subscription lifecycle and purchase acknowledgement:
  https://developer.android.com/google/play/billing/lifecycle/subscriptions
- RevenueCat Android product setup:
  https://www.revenuecat.com/docs/getting-started/entitlements/android-products
- RevenueCat Google Play service credentials:
  https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials

## Current Status

Payment is not ready for public paid release yet.

Already present:

- Backend plan definitions in `backend/src/config/plans.ts`.
- Backend entitlement lookup through RevenueCat in
  `backend/src/services/entitlements.ts`.
- Mobile sends a stable local install id as `x-app-user-id`.
- Free, Reader Plus, AI Pro, and Power plan copy exists in the paywall.

Missing before paid launch:

- RevenueCat SDK is not wired in the mobile app.
- Google Play subscription products are not created/tested.
- RevenueCat offerings are not configured.
- The mobile app does not yet open the native Play Billing purchase flow.
- The backend still needs the production RevenueCat secret key in Render.
- The public production backend is currently suspended in Render. On
  2026-06-29, `https://readflow-backend.onrender.com/api/health` returned
  Render's `Service Suspended` page. This requires owner dashboard action before
  Play release.

Until these are complete, the app can be released only as a free preview with
paid features locked and purchase buttons unavailable.

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
a $4.99 Play Billing top-up nets about $4.19 and keeps direct AI vendor cost
around 18%. A 100k character top-up costs about $3 in OpenAI spend and would
need to be priced around $17.99+ to keep the same margin.

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

Google Play requires Play Billing for in-app purchases of digital goods and
services distributed through Google Play. Do not send users from the app to a
website to buy Reader Plus, AI Pro, Power, OCR pages, or voice packs.

## RevenueCat Setup

1. Create a RevenueCat project for readFlow.
2. Add the Android app package `com.urmiaworks.readflow`.
3. Add Google Play service credentials according to RevenueCat's guide.
4. Import or create the Play subscription products.
5. Create entitlements:
   - `reader_plus`
   - `ai_pro`
   - `power`
6. Attach the correct products to the correct entitlements.
7. Create an offering named `default`.
8. Add monthly and yearly packages for each paid tier.
9. Copy the RevenueCat public SDK key for Android into mobile config.
10. Copy the RevenueCat secret/server key into Render as `RC_SECRET_KEY`.
11. Test purchase, restore, cancellation, grace period, and expired subscription.

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
Invoke-WebRequest https://readflow-backend.onrender.com/api/health
```

The internal Render service can use `ENTITLEMENTS_DEV_OVERRIDE=true` for testing,
but it must not be used in public builds because it grants paid access.

## Mobile Work Still Needed

Add the RevenueCat SDK and connect it to the existing entitlement flow:

1. Add the SDK dependency, likely `react-native-purchases`.
2. Configure the Android public SDK key at app startup.
3. Use RevenueCat's app user id as the stable `x-app-user-id` sent to the
   backend. The current local `rf_...` id is useful for free quotas but is not a
   purchase identity.
4. Fetch offerings from RevenueCat.
5. Pass `purchasingAvailable=true` to `UpgradeSheet` only after offerings load.
6. Open the native purchase sheet for selected tier and billing period.
7. Implement Restore Purchases.
8. After purchase/restore, refresh backend entitlements and usage.
9. Add graceful error UI for cancelled, pending, failed, and already-owned
   purchases.
10. Make sure Free still cannot call OCR, AI text, Cloud AI voice, or read-aloud.

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
- Backend quota uses the RevenueCat app-user id, not `anonymous`.
- Public build cannot accidentally use the internal Render service.

## Release Decision

Do not submit a paid Play release until all of these are true:

- Production backend health is green.
- RevenueCat SDK purchase and restore flows work on the connected phone.
- RevenueCat secret is set on production Render.
- Play products are active and mapped to the correct entitlements.
- Privacy Policy, Terms, and Data Safety answers match the final SDK/data flow.
- `npm run check:release` passes.
- A fresh internal-testing install passes the subscription test matrix.
