# Free Android Release Status

Updated: 2026-10-21. Owner authorized implementation, builds and Google Play submission.
This is work in progress, not a published release or a claim of zero current bills.

## Scope

- Candidate 1.0.67 (74); production verified active at 1.0.66 (73).
- Free local PDF/DOCX import, local OCR, pictures/original pages, bookmarks, themes,
  device speech and unlimited downloaded rF AI. Preserve existing library data.
- Remove subscriptions, paid gates, cloud voice and remote AI actions from the new app.
- Library-only AdMob banner, never reader/audio interruptions. Do not send book text,
  filenames or metadata to advertising providers. Reading must work without ads/network.
- Optional consumable support contribution, approximately USD 1, localized by Play.
  No renewal, digital reward or ad removal. Automatic prompt after 7 days and 3 distinct
  visit days, then at least 30 days apart; 180 days after support; permanent opt-out.
- No new paid services. Retire existing bills only after migration and subscriber checks.

## Source and Checks

Before tag: readflow-before-free-offline-20261020, starting main HEAD cfba971.
Implementation commit 1c52591 and after tag
readflow-after-free-offline-candidate-1.0.67-20261021 pushed to origin/main using
GitHub account tmoradikh-png. Private owner files and unrelated website index excluded.
Mobile removes RevenueCat/server bootstrap and uses constant free entitlements.
Native module readflow-offline uses PDFBox-Android 2.0.27.0, Tesseract4Android 4.9.0,
and Play Billing 9.1.0. Existing layout/OCR cleanup rules are generated into mobile
with scripts/sync-offline-text.cjs. This does not prove native extraction equivalence.
OCR includes 22 tessdata_fast packs, pinned at
87416418657359cb625c412a48b6e1d6d41c29bd, with Apache license and SHA256 manifest.
Ads now use react-native-google-mobile-ads 15.8.3 / Google Mobile Ads 24.6.0.
The first cloud build failed because 16.5.0 / GMA 25.4.0 needs Kotlin metadata 2.3,
while Expo 54 uses Kotlin 2.1.20. Pinning the older SDK addresses this confirmed
compatibility cause; version 17 also requires newer React Native.
Measurement initialization is delayed; UMP consent gates SDK initialization/ad requests.
Test ads remain enabled in app.json. Production configuration check intentionally fails
until live-ad configuration is deliberately enabled after QA.

Obtained: TypeScript, QA configuration, OCR asset hashes and reader regression checks PASS.
Cloud preview build FINISHED; APK signature verification passed (v2), and aapt confirms
com.urmiaworks.readflow, version 1.0.67/code74, minSdk24/targetSdk36.
Support opt-out now survives later manual dismissal; the new regression passes.
That JS fix is newer than this preview APK and requires the next build.
Not obtained: real-device import fidelity, OCR quality, audio playback,
billing cancel/pending/recovery, consent geography/revocation and banner-layout QA.
No phone detected by adb on October 21. Do not claim text is 100% correct.

Windows Gradle 8.14.3 failed on transform-cache AccessDenied three times, including a
targeted cache repair. A bounded Gradle 9.1 attempt failed on locked Kotlin build-output
directories. The exact lock owner is unknown. No security settings were changed.
Stop this local retry method. Generated Android tree is ignored and excluded from EAS;
the native module Android source is included (ignore rules must be root-anchored).

## Expo Build

Owner approved upload of mobile source and bundled OCR models to existing tohid123/readflow.
Preview APK build submitted: 93d90195-9482-4b1f-8a1e-959169653971.
https://expo.dev/accounts/tohid123/projects/readflow/builds/93d90195-9482-4b1f-8a1e-959169653971
Status: ERRORED at react-native-google-mobile-ads:compileReleaseKotlin (see above).
Corrected preview build 4ece17c7-609c-4a8d-b71f-53c7e461b629 FINISHED:
https://expo.dev/accounts/tohid123/projects/readflow/builds/4ece17c7-609c-4a8d-b71f-53c7e461b629
Downloaded: artifacts/readflow-1.0.67-74-free-preview-b2.apk.
SHA256: 4F1E524FD81B2C0F5BBF30D7850D893733CF7D1553E4BECE590EFCE699D15CAB.
Not installed: no phone connected. No production AAB or Play submission yet.
Use EAS_NO_VCS=1 and absolute EAS_PROJECT_ROOT=<ReadFlow>/mobile, with TEMP/TMP/npm cache
under ReadFlow/tmp. The inspected archive contained 104 files, 22 OCR packs, no private
books/backups/credentials, and no generated root android directory. Upload was 30.4 MB.
Do not run EAS with the repository root as the upload root: owner files are untracked there.

CLI account:usage reports Starter, unused included build allowance, no overage, and an
upcoming USD 19 renewal on October 27. This plan is NOT cancelled. Use only included credit;
cancel/downgrade recurring plan after builds. No authorization to incur overage.

## Play and AdMob

Play one-time product readflow_support_1, purchase option support, is Active in 174 regions.
Submitted base USD 1.00; Play price-charming produced USD 0.99 in the US and NOK 12 in Norway.
Display Play's localized price, never hardcode USD in the UI. Product has no subscription.
Proof: tmp/support-product-active.png. No test payment performed.

AdMob registered support@urmiaworks.com after explicit approval of Norway and terms.
Publisher: pub-5199768562686629.
Android app: ca-app-pub-5199768562686629~3386452834.
Library banner: ca-app-pub-5199768562686629/1338873995.
Registration/app/banner proofs: tmp/admob-registered.png, tmp/admob-app-added.png,
tmp/admob-banner-created.png. App requires review and app-ads.txt verification.
website/app-ads.txt and updated privacy policy prepared but NOT deployed. Owner
explicitly approved publishing both. Cloudflare saved login expired; a minimal
Pages/account/user OAuth refresh initially timed out; a stale callback then failed
state validation. Those localhost flows are stopped. Device-code authorization avoids
the callback, but also timed out without completion. Stop further automatic auth retries
until owner is ready. Current browser account is support@urmiaworks.com;
website/PROJECT.md instead records tohid.moradi.kh@gmail.com/account
490d777337f916bad4335f86dffb4f5e. Verify actual project access before publishing.
Dashboard confirms this session only has Support@urmiaworks.com's Account,
ID 92d2aba4f641ca3e82180d25a96308d8, not the documented website account. Owner asked
to sign in as tohid.moradi.kh@gmail.com and report dashboard ready before another login.
Consent messages NOT configured yet; European message editor stalled at loading in
two attempts. Stop repeating that method; no consent message was saved or published.
Payments form offers the existing Urmia Holding AS organization profile. Owner instructed
to review unchanged details and click Submit. Completion verified: AdSense (Norway)
is linked to Urmia Holding AS. Never submit
financial profile linkage on the owner's behalf. No bank information was requested there.

First Play order-history page still ends in August test purchases. This is not a fresh
full subscriber audit. Historic September audit found only test orders. Check active
subscriptions before retiring RevenueCat/Render or disabling old purchase options.
Play target audience currently selects only 18 and over; no age-setting changes made.

## Remaining Gates

1. Rebuild from committed source after the final opt-out/dependency fixes, then test
   installed Android app. The successful preview can test native import/audio meanwhile.
2. Test representative books against originals, OCR layout/headers/footnotes/figures,
   saved positions and rF AI background playback. Preserve existing regression fixtures.
3. Verify support purchase/cancel/pending/recovery using Play license test payments only.
4. Resolve any remaining AdMob payment warning, public app-ads.txt, consent messages
   and app review. Profile linkage succeeded, but another AdMob view still reports
   incomplete payment setup; completion across AdMob is not yet confirmed.
5. Update public privacy policy, Play Data safety, Ads declaration and free store copy.
6. Check/retire subscriptions and paid Render/RevenueCat/OpenAI/Expo dependencies without
   silently breaking existing subscribers or claiming costs have ended prematurely.
7. Commit/tag/push scoped changes as tmoradikh-png, then signed production AAB and submission.

Unrelated website/readflow/index.html edit and owner backup.ab, pic/, saeed-tester.csv
must be preserved. Do not include them in this release commit or build upload.

Initial dependency audit reported 49 findings overall (12 moderate, 35 high, 2 critical).
Targeted npm update upgraded shell-quote 1.8.4 -> 1.12.0 and tar 7.5.16 -> 7.5.22;
the resulting npm audit summary reports 47 (12 moderate, 35 high), no critical findings.
These dependencies are reached through development/build tooling; a full exposure
audit of remaining findings is not complete. No forced framework upgrade was used.
The queued preview predates these lockfile updates; final build must use committed source.
Advisories: https://github.com/advisories/GHSA-pqg4-j6r4-53mv and
https://github.com/advisories/GHSA-r292-9mhp-454m.

Sources: https://support.google.com/admob/answer/7356092?hl=en-GB (publisher use is free);
https://developers.google.com/admob/android/privacy/play-data-disclosure (SDK disclosures);
https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent (UMP);
https://github.com/gradle/gradle/issues/31438 (Windows transform-cache defect).
