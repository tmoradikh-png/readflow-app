# readFlow Current Handover

Updated: 2026-07-15

Start here when taking over readFlow. This file is a short operational map. It
does not contain passwords, API keys, service-account JSON contents, signing
keys, or recovery codes.

## Current Production State

- Android app is live on Google Play.
- Public listing: `https://play.google.com/store/apps/details?id=com.urmiaworks.readflow`
- App name on Play listing: `readFlow PDF Reader with AI`
- Brand casing in product copy: `readFlow`
- Android package: `com.urmiaworks.readflow`
- Current live production version: `1.0.27`
- Current live production version code: `33`
- Hotfix `1.0.28` / version code `34` was uploaded to the Play production
  track and sent from Publishing overview on 2026-07-15.
- Last observed Play Console state for `1.0.28 (34)`: `Changes in review`;
  Google quick checks were still running and Play said the change would be sent
  for review as soon as checks complete successfully. It is not live until Play
  shows the production release as active.
- Latest EAS Android build id: `d973d085-0e86-4818-9d48-f5e68aa157d4`.
- Latest EAS Android artifact:
  `https://expo.dev/artifacts/eas/b5xTuQwsLxzXZ30kv-Fr2-DkEPxyob7pSZGT8DIudEY.aab`
- Local AAB copy: `artifacts/readflow-1.0.28-34.aab`
- Next Android build must use version code `35` or higher after checking EAS.
- A duplicate `1.0.28` / code `34` EAS build
  `46806d5f-aa25-4e9f-9031-5d3866824fe3` was started by a CLI timeout retry
  and canceled.

Hotfix reason: the live Play build could crash when starting Cloud AI/rF AI
audio because Android denied `expo.modules.audio.service.AudioControlsService`
without `android.permission.FOREGROUND_SERVICE`. Build `1.0.28 (34)` restores
the required foreground media-playback/data-sync permissions and service types
while still blocking microphone/recording permissions.

Do not click `Remove changes` for the `1.0.28 (34)` production change unless
the owner intentionally wants to cancel the submitted hotfix.

Play Console may show `0` downloads shortly after real installs. Use Play
Console Statistics and Release dashboard for install metrics; the public store
download badge and dashboard summaries can lag, and internal tester installs may
not appear like public acquisitions.

## Accounts And Services

| Area | Account / owner | Important id or URL |
| --- | --- | --- |
| GitHub | `tmoradikh-png` | `https://github.com/tmoradikh-png/readflow-app` |
| Google Play | Urmia Works | developer id `5814875347439289711`, app id `4975304972724343415` |
| Expo/EAS | `tohid123` | `https://expo.dev/accounts/tohid123/projects/readflow/builds` |
| Render | `support@urmiaworks.com` | service id `srv-d8vhhnpo3t8c73b9c1n0` |
| RevenueCat | `support@urmiaworks.com` | project `d73a07a4`, Android app `appb8f9dbf896` |
| Google Cloud | Urmia Works | project `readflow-revenuecat` |
| OpenAI | owner-held billing account | key lives only in Render env var `OPENAI_API_KEY` |

Production backend:

- Render service name: `readflow-backend`
- Current reachable URL: `https://readflow-backend-internal.onrender.com`
- Health check: `https://readflow-backend-internal.onrender.com/api/health`
- The old `https://readflow-backend.onrender.com` URL was suspended and must
  not be used by app builds unless restored intentionally.

## Billing State

Android billing is wired through Google Play Billing, RevenueCat, and the
backend.

- Mobile uses `react-native-purchases`.
- EAS has `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
- Render has `RC_SECRET_KEY`.
- RevenueCat Android app: `readFlow (Play Store)`.
- RevenueCat offering id: `default`.
- Entitlements: `reader_plus`, `ai_pro`, `power`.
- Google Play products and base plans are active:

| Product id | Base plan id | Tier |
| --- | --- | --- |
| `readflow_reader_plus_monthly` | `uw-baseplan01` | Reader Plus monthly |
| `readflow_reader_plus_yearly` | `uw-baseplan02` | Reader Plus yearly |
| `readflow_ai_pro_monthly` | `uw-baseplan03` | AI Pro monthly |
| `readflow_ai_pro_yearly` | `uw-baseplan04` | AI Pro yearly |
| `readflow_power_monthly` | `uw-baseplan05` | Power monthly |
| `readflow_power_yearly` | `uw-baseplan06` | Power yearly |

2026-07-14 connected-phone purchase smoke:

- Phone: Samsung SM-G975F, ADB serial `R58M168KTSZ`.
- Installed package came from Google Play: `installerPackageName=com.android.vending`.
- Installed version verified: `1.0.27 (33)`.
- Paywall opened from Cloud AI and loaded live annual products/prices.
- Google Play checkout opened for `AI Pro Yearly`.
- The checkout showed a real saved card, so the test was stopped before the
  `Subscribe` button. No purchase was made.

Do not press `Subscribe` while a real card is shown unless the owner explicitly
approves a real purchase/refund test.

## License Testing

Google Play internal testing and license testing are different:

- Internal testing lets the account install tester builds.
- License testing makes purchases use Google's test payment instruments.

Observed phone Google accounts included:

- `itohidmoradi@gmail.com`
- `t.moradi.kh@gmail.com`
- `spottimy@gmail.com`
- `tohid.khanshan@remarkable.no`

The intended tester account for the connected phone is `itohidmoradi@gmail.com`.

Play Console license testing should use the email list named `itohid, tohid`.
That list contains:

- `itohidmoradi@gmail.com`
- `t.moradi.kh@gmail.com`

Required license-testing settings:

1. Play Console -> Settings -> License testing.
2. Select Email lists.
3. Tick `itohid, tohid`.
4. Leave License response as `RESPOND_NORMALLY`.
5. Save changes.
6. On the phone, make sure Play Store is using `itohidmoradi@gmail.com`.
7. Clear Play Store cache.
8. Reopen readFlow and try the purchase again.

The payment sheet must show a test instrument/test card. If it still shows
a real saved card, stop before `Subscribe`.

## Build Routine

Use `RELEASE_GUIDE.md` as the authority. Short version:

```powershell
cd C:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow\mobile
npx --yes eas-cli build:list --platform android --limit 5 --json --non-interactive
npm run check:release
npx tsc --noEmit
npx --yes eas-cli build -p android --profile internal --non-interactive --no-wait
```

Rules:

- Never reuse an Android `versionCode`.
- Bump both `mobile/app.json` and `mobile/scripts/check-release-config.mjs`.
- Do not allow a generated `mobile/android/` folder to override release config.
- Push to GitHub before spending EAS build quota.
- Use GitHub owner `tmoradikh-png`.

## Key Documents

- `PROJECT.md`: full product and architecture handoff.
- `GOOGLE_PLAY_HANDOFF.md`: Play release/account/review history.
- `PAYMENT_SETUP.md`: Play, RevenueCat, products, and payment QA.
- `RELEASE_GUIDE.md`: Android build and Play release procedure.
- `IOS_RELEASE_GUIDE.md`: iOS/TestFlight plan.
- `COST_MODEL.md`: pricing, limits, and cost guardrails.
- `MARKETING_PLAY_STORE.md`: Play/website marketing copy and claims limits.
- `PRIVACY_POLICY_DRAFT.md`, `TERMS_OF_USE_DRAFT.md`,
  `PLAY_DATA_SAFETY_DRAFT.md`: legal/app-content drafts.

## Current Follow-Ups

- Finish license-tester purchase, restore, cancel, expiry, and entitlement tests.
- Improve over-limit UX so quota/file-too-long states open an upgrade prompt.
- Add a custom API domain instead of the confusing Render legacy subdomain.
- Commit or organize Play listing graphics from `pic/` if they should be kept.
- Build iOS only after App Store Connect products and RevenueCat iOS app setup.
- Monitor Render/OpenAI costs and keep AI/Cloud AI allowances within the cost
  model in `COST_MODEL.md`.
