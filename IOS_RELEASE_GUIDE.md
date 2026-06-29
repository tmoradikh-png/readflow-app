# readFlow iOS Release Guide (App Store / TestFlight)

App: **readFlow**. iOS bundle id: **com.urmiaworks.readflow**.
Expo/EAS account: **tohid123**. Project: **tohid123/readflow**
(projectId `097b0b5a-db90-46b4-b434-60836687b429`).

For the full account map, current source state, backend notes, and operational
habits, start with **[PROJECT.md](PROJECT.md)**. For Android/Google Play, use
**[RELEASE_GUIDE.md](RELEASE_GUIDE.md)**. For paid subscriptions, use
**[PAYMENT_SETUP.md](PAYMENT_SETUP.md)**. For App Store listing/review text,
use **[APP_STORE_RELEASE_PACKET.md](APP_STORE_RELEASE_PACKET.md)**.

Policy and platform sources checked on 2026-06-29:

- Apple App Review Guidelines:
  https://developer.apple.com/app-store/review/guidelines/
- Apple In-App Purchase overview:
  https://developer.apple.com/in-app-purchase/
- Apple App Privacy details:
  https://developer.apple.com/app-store/app-privacy-details/
- Apple App Store Connect privacy help:
  https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Apple export compliance:
  https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations
- Expo EAS iOS production build:
  https://docs.expo.dev/tutorial/eas/ios-production-build/
- Expo EAS Build:
  https://docs.expo.dev/build/introduction/

---

## iOS Release Gate - 2026-06-29

Current source iOS candidate: **1.0.23 / buildNumber 23**.

EAS iOS build history check on 2026-06-29:

```powershell
cd C:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow\mobile
npx --yes eas-cli build:list --platform ios --limit 5 --json --non-interactive
```

Result: `[]`. No iOS EAS builds are recorded for this Expo project yet.

Already prepared in source:

- `mobile/app.json` has `ios.bundleIdentifier` set to
  `com.urmiaworks.readflow`.
- `mobile/app.json` has `ios.buildNumber` set to `"23"` to match the finished
  Android 1.0.23 release candidate.
- `ios.infoPlist.ITSAppUsesNonExemptEncryption` is `false`.
- No iOS `UIBackgroundModes` audio declaration is present. The current product
  behavior is foreground-only reading/audio.
- `mobile/eas.json` has explicit iOS device/archive settings for development,
  preview, internal/TestFlight, and production profiles.
- `npm run check:release` now checks iOS bundle id, build number, export
  compliance, microphone/background-audio absence, iOS managed-directory
  safety, and EAS iOS archive settings.

Do **not** submit a public App Store release until these are complete:

- Apple Developer Program and App Store Connect ownership are verified for
  Urmia Works.
- An App Store Connect app record exists for bundle id
  `com.urmiaworks.readflow`.
- The privacy policy and terms URLs are live:
  `https://urmiaworks.com/readflow/privacy` and
  `https://urmiaworks.com/readflow/terms`.
- App Privacy answers in App Store Connect match the final SDKs and backend
  behavior.
- If paid plans are enabled, App Store in-app purchases, RevenueCat iOS app,
  RevenueCat platform SDK keys, and restore/purchase flows are wired and tested.
- rF AI/Sherpa native voice is tested on a real iPhone. Android rF AI QA does
  not prove iOS runtime quality or packaging.

Until purchases are wired, an iOS build should be treated as a **free preview /
TestFlight build** with paid features locked and purchase buttons unavailable.

---

## TL;DR - Cut an iOS TestFlight build

Run commands from `ReadFlow/mobile` on Windows PowerShell:

```powershell
cd C:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow\mobile
```

### Step 1 - Check the latest consumed iOS build number

```powershell
npx --yes eas-cli build:list --platform ios --limit 5 --json --non-interactive `
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{JSON.parse(s).forEach(b=>console.log(b.appVersion+'/'+b.appBuildVersion+' '+b.status+' '+b.id.slice(0,8)))})"
```

If the result is still empty, buildNumber `23` is free for iOS. If an iOS build
already consumed `23`, choose a higher `ios.buildNumber`.

### Step 2 - Bump only what needs bumping

For the current iOS 1.0.23 candidate, source is already set:

- `mobile/app.json` -> `expo.version`: `"1.0.23"`
- `mobile/app.json` -> `expo.ios.buildNumber`: `"23"`
- `mobile/scripts/check-release-config.mjs` ->
  `EXPECTED_VERSION`: `"1.0.23"`
- `mobile/scripts/check-release-config.mjs` ->
  `EXPECTED_IOS_BUILD_NUMBER`: `"23"`

If you need a new iOS build number without changing Android, update
`expo.ios.buildNumber` and `EXPECTED_IOS_BUILD_NUMBER`. Android
`versionCode` has its own constant in the checker and should only change when
cutting another Android build.

### Step 3 - Validate

```powershell
npm run check:release
npx tsc --noEmit
```

Both must pass before spending EAS quota.

### Step 4 - Commit and push exact source

Commit the source that will be built and push it to
`https://github.com/tmoradikh-png/readflow-app.git` before starting the EAS
build.

### Step 5 - Start the iOS archive build

```powershell
npx --yes eas-cli build -p ios --profile internal --non-interactive --no-wait
```

The `internal` profile is intentionally a store archive profile for iOS, so the
result is suitable for App Store Connect/TestFlight. If this is the first iOS
build and EAS has no Apple credentials yet, the non-interactive command may
fail. In that case, rerun with the account owner present and let EAS create or
use Apple distribution credentials. Do not commit certificates, profiles, API
keys, or passwords.

### Step 6 - Record and submit

Add a row to the iOS build ledger below as soon as a build is started. When the
build finishes, upload it to App Store Connect/TestFlight. EAS Submit can do
this once App Store Connect credentials are configured:

```powershell
npx --yes eas-cli submit -p ios --latest --non-interactive
```

If App Store Connect API keys are not configured in EAS, use the interactive
submit flow with the owner present. Do not commit App Store Connect API key
files.

---

## App Store Connect Setup Checklist

- Create or verify the App Store Connect app record for `readFlow`.
- Bundle ID: `com.urmiaworks.readflow`.
- SKU: choose a stable internal SKU, for example `readflow-ios`.
- Primary category: Books.
- Secondary category: Education or Productivity only if product decides.
- Support URL: `https://urmiaworks.com/readflow`.
- Marketing URL: `https://urmiaworks.com/readflow`.
- Privacy Policy URL: `https://urmiaworks.com/readflow/privacy`.
- Age rating: not designed for children; answer content questions accurately.
- Export compliance: current source sets
  `ITSAppUsesNonExemptEncryption:false`; confirm this remains accurate before
  submission.
- App Privacy: use `APP_STORE_RELEASE_PACKET.md` as the worksheet, then review
  against final SDKs and backend behavior.
- Paid launch only: create App Store auto-renewable subscription products,
  connect them to RevenueCat, configure offerings, and test sandbox purchase
  plus restore.

## iOS QA Checklist

- Fresh TestFlight install opens without a startup crash.
- App icon and splash use the clean readFlow art.
- Import a normal PDF and verify reflowed reading.
- Import a text-based `.docx` if testing Word support.
- Open a saved book, rotate, jump to a bookmark, and use page navigation.
- Device voice reads and line highlighting follows.
- Press Home/app-switch/lock while reading and confirm playback stops promptly.
- Open Voice and confirm Device voice, rF AI, and Cloud AI labels.
- rF AI either downloads/plays correctly on iPhone or stops with the themed
  not-ready/download message. It must not silently switch to Device voice.
- Cloud AI is locked for Free and uses clean upgrade messaging.
- AI and OCR paid paths are locked in the free preview build.
- No microphone prompt appears.
- Offline/poor-network states do not crash.

## iOS Build Ledger

Append a row every time an iOS EAS build is started.

| buildNumber | versionName | EAS build id | Status | What changed |
| ----------- | ----------- | ------------ | ------ | ------------ |
| 23 | 1.0.23 | not started | source prepared | iOS App Store/TestFlight prep based on Android 1.0.23 release candidate. No EAS iOS build existed on 2026-06-29. |

**Next iOS buildNumber: 23** unless `eas build:list --platform ios` shows that
23 or a higher number has already been consumed.
