# readFlow Google Play Handoff

Updated: 2026-07-01

This file records the Android release setup, accounts, services, and review
answers used for the first public Google Play release. Do not add passwords,
API keys, private JSON contents, signing keys, or recovery codes to this file.

## Current Play Status

- Google Play production release `1.0.27` / version code `33` was submitted for
  review on 2026-07-01.
- Last observed Play Console state in this Codex session: "Your changes are now
  in review." Managed publishing was off, so approval should publish
  automatically unless Google flags an issue.
- The submitted AAB was built by EAS:
  `6bee8c21-d52c-4e4f-8622-0dc992a5f2f2`.
- Artifact URL:
  `https://expo.dev/artifacts/eas/nc3RoJjcCStaue6IRX9CMHeTsWFP68KpgnHyVTMsQRM.aab`.
- Local artifact copy: `artifacts/readflow-1.0.27-33.aab`.
- The next Android build must use version code `34` or higher after checking EAS
  and Play for any consumed build codes.

## Accounts And Consoles

| Area | Account / owner used | URL / id | Notes |
| --- | --- | --- | --- |
| GitHub | `tmoradikh-png` | `https://github.com/tmoradikh-png/readflow-app` | Always use this repo owner unless the owner explicitly changes it. |
| Google Play Console | Urmia Works developer account | Developer id `5814875347439289711`, app id `4975304972724343415` | Package is permanent: `com.urmiaworks.readflow`. |
| Google Cloud | Urmia Works / Google account used during setup | Project `readflow-revenuecat` | Created for RevenueCat service credentials and Google developer notifications. |
| RevenueCat | `support@urmiaworks.com` | Project `d73a07a4`, Android app `appb8f9dbf896` | App name in dashboard: `readFlow (Play Store)`. |
| Render | `support@urmiaworks.com` | Service id `srv-d8vhhnpo3t8c73b9c1n0` | Production service name is `readflow-backend`. |
| Expo / EAS | `tohid123` | Project `tohid123/readflow`, id `097b0b5a-db90-46b4-b434-60836687b429` | Android builds and hosted artifacts. |
| OpenAI | Owner-held billing account | Render env var `OPENAI_API_KEY` | The key is server-only. Verify ownership/billing in the OpenAI dashboard. |
| Urmia Works web | Urmia Works | `https://www.urmiaworks.com/readflow/privacy` | Privacy/support URL used for Play app content. |

Important URLs:

- Play app dashboard:
  `https://play.google.com/console/u/0/developers/5814875347439289711/app/4975304972724343415`
- Play publishing overview:
  `https://play.google.com/console/u/0/developers/5814875347439289711/app/4975304972724343415/publishing`
- Play subscriptions:
  `https://play.google.com/console/u/0/developers/5814875347439289711/app/4975304972724343415/subscriptions`
- RevenueCat project:
  `https://app.revenuecat.com/projects/d73a07a4`
- RevenueCat Android app:
  `https://app.revenuecat.com/projects/d73a07a4/apps/appb8f9dbf896`
- RevenueCat API keys:
  `https://app.revenuecat.com/projects/d73a07a4/api-keys`
- Render service:
  `https://dashboard.render.com/web/srv-d8vhhnpo3t8c73b9c1n0`
- Production backend health:
  `https://readflow-backend-internal.onrender.com/api/health`
- Google Cloud service accounts:
  `https://console.cloud.google.com/iam-admin/serviceaccounts?project=readflow-revenuecat`
- EAS builds:
  `https://expo.dev/accounts/tohid123/projects/readflow/builds`

## What Was Submitted To Google

- Production release `1.0.27` / code `33` for full rollout.
- App title/store listing: `readFlow PDF Reader with AI`.
- Brand casing inside docs and app: `readFlow`.
- Category: Books & Reference.
- Target audience: adults / 18+.
- Ads declaration: no ads.
- Advertising ID declaration: no Advertising ID use.
- Government apps: no.
- Financial features: no.
- Health features: no.
- App access: no login required for basic use.
- Privacy policy: `https://www.urmiaworks.com/readflow/privacy`.
- Data Safety: documents may be processed for import, OCR, AI help, and voice;
  no sale of user data; no ads in this release.
- Store graphics were uploaded through Play Console. Local source images used
  during listing work are in `pic/`, currently untracked by Git.

## Billing And Products

Payments are sold through Google Play Billing and managed by RevenueCat. The
mobile app uses the RevenueCat public Android SDK key from EAS environment
variable `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. The backend uses the
RevenueCat secret key from Render environment variable `RC_SECRET_KEY`.

RevenueCat entitlements:

| Tier | Entitlement id |
| --- | --- |
| Reader Plus | `reader_plus` |
| AI Pro | `ai_pro` |
| Power | `power` |

Google Play subscription products and base plans:

| Product id | Base plan id | Tier |
| --- | --- | --- |
| `readflow_reader_plus_monthly` | `uw-baseplan01` | Reader Plus monthly |
| `readflow_reader_plus_yearly` | `uw-baseplan02` | Reader Plus yearly |
| `readflow_ai_pro_monthly` | `uw-baseplan03` | AI Pro monthly |
| `readflow_ai_pro_yearly` | `uw-baseplan04` | AI Pro yearly |
| `readflow_power_monthly` | `uw-baseplan05` | Power monthly |
| `readflow_power_yearly` | `uw-baseplan06` | Power yearly |

RevenueCat offering:

- Offering id: `default`.
- REST id: `ofrng6b3bf29391`.
- All six Android packages are configured and products were shown as
  `Published` in RevenueCat.

## RevenueCat And Google Credentials

Google Cloud project `readflow-revenuecat` was created for RevenueCat.

Service account:

```text
readflow-revenuecat@readflow-revenuecat.iam.gserviceaccount.com
```

Setup completed:

- Google APIs enabled: Google Play Android Developer API, Google Play Developer
  Reporting API, and Cloud Pub/Sub API.
- Google Cloud IAM roles granted to the service account: `Pub/Sub Editor` and
  `Monitoring Viewer`.
- The service account was added in Play Console Users and permissions.
- A service account JSON was generated and uploaded to RevenueCat.
- A later working local JSON filename was:
  `C:\Users\Greencom\Downloads\readflow-revenuecat-979abf84a3bf.json`.

Never commit, paste, or email the JSON contents. If credentials are rotated,
upload the new JSON to RevenueCat and update this section with the date only.

## Backend And AI

Production backend:

- Render service name: `readflow-backend`.
- Current public URL: `https://readflow-backend-internal.onrender.com`.
- Old URL `https://readflow-backend.onrender.com` returned a Render suspended
  page and must not be used by public app builds.
- Recommended future cleanup: add a custom domain such as
  `https://api.urmiaworks.com` and update mobile config plus docs.

Important Render env vars:

- `APP_KEY`
- `ENTITLEMENTS_DEV_OVERRIDE=false`
- `RC_SECRET_KEY`
- `OPENAI_API_KEY`
- AI/TTS/OCR provider settings listed in `render.yaml`

AI and Cloud AI voice use the backend. The mobile app never receives the
OpenAI key. If Google asks about AI cost or processing, answer that OpenAI calls
are server-side, gated by paid entitlements and monthly allowances, and the
backend fails closed to the free tier when purchase validation is unavailable.

## Foreground Services And Permissions

Google Play required foreground-service declarations during release review. The
source now strips unused microphone and foreground-service declarations from
Android library manifests before EAS builds. Current intended Android
permissions are minimal plus billing:

- `INTERNET`
- `com.android.vending.BILLING`

If Google asks about foreground service behavior:

- readFlow is a foreground reading app. It does not intentionally provide
  background audiobook playback in this release.
- Reading aloud is expected to stop when the user leaves the app.
- The app may keep the screen awake while reading to avoid accidental lock.
- Media playback review video:
  `https://raw.githubusercontent.com/tmoradikh-png/readflow-app/main/docs/play-review/readflow-media-playback-demo.mp4`
- Data sync/import review video:
  `https://raw.githubusercontent.com/tmoradikh-png/readflow-app/main/docs/play-review/readflow-data-sync-demo.mp4`

## If Google Asks

Why does the app need document processing?

```text
readFlow imports supported PDFs and text-based Word documents and converts them
into a phone-friendly reading view. For scanned documents, paid OCR can extract
text. AI reading help and Cloud AI voice use the backend only when the user
chooses those paid features.
```

Does the app require login?

```text
No. Basic reading preview works without login. Paid access is verified through
Google Play Billing and RevenueCat using the app install's stable app-user id.
```

Does the app use Advertising ID or ads?

```text
No. This release contains no ads and does not use Advertising ID for ads,
analytics, or tracking.
```

Why are subscriptions included?

```text
Subscriptions unlock reader features, OCR allowance, AI reading help, rF AI, and
Cloud AI voice according to the selected tier. All digital purchases use Google
Play Billing and can be managed in Google Play.
```

What data is processed?

```text
Documents selected by the user may be processed to extract/reflow text. OCR,
AI answers, and Cloud AI voice may use backend services. The app does not sell
user data and does not include ads in this release.
```

How can Google test paid features?

```text
Use Google Play license testing/sandbox subscriptions for the configured
subscription products, or add a temporary RevenueCat test entitlement for the
tester app-user id. Do not enable Render ENTITLEMENTS_DEV_OVERRIDE in public
production.
```

## Verification Already Run

- `npm run check:release` passed before the submitted production build.
- TypeScript check passed before release prep.
- Production backend health returned OK.
- Random non-buyer entitlement probe returned free tier through RevenueCat.
- Play Console quick checks completed with no blocking issue before submission.
- Raw foreground-service review video URLs returned HTTP 200 before submission.

## Known Follow Ups

- Run sandbox purchase, restore, upgrade, downgrade, cancel, and entitlement
  expiry checks once the Play build is available to testers.
- Improve over-limit paywall prompts. Current backlog item: after a user hits
  quota/file-too-long, show a themed upgrade prompt instead of only the raw
  quota message.
- Add a custom API domain to replace the confusing
  `readflow-backend-internal.onrender.com` production URL.
- Build and release iOS only after App Store Connect products and RevenueCat iOS
  app setup are complete.
- Decide whether to commit curated Play listing source graphics from `pic/` or
  move them to a tracked marketing-assets folder.
