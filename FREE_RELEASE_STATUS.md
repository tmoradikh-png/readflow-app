# Free Android Release Status

Updated: 2026-10-24. Owner authorized implementation, builds and Google Play submission.
This is work in progress, not a published release or a claim of zero current bills.

## October 24 Device and Build Progress

- Current candidate: 1.0.69 (76), source dadf46f, live ad unit configuration.
  TypeScript and check:release pass. EAS production-profile AAB build
  08016c8e-5781-4b67-8451-07654dc2f8b8 queued using approved included credit;
  upload was mobile-only, 30.4 MB. Install through the internal track first;
  do not promote until final phone checks. Expo usage before build500/4500,
  estimated overage0; Starter USD19 October27 renewal still active.
- Internal75 release25 became Available October24 01:25 and was installed through
  Google Play on SM-S918B. Startup now succeeds, six original books preserved,
  ad SDK initialization/request observed without the previous fatal exception.
  AAB artifacts/readflow-1.0.68-75-free-internal.aab SHA256:
  9E7F06EC2B59A200FDC037B1BE32057A723E6DEFD5174C19D288905A2029C14D.
- Native75 QA: fresh Principles PDF imports43 pages; Original/Reflow keeps page3;
  Confessions35,584,044 bytes imports712 pages, no20 MB paywall. English image-only
  fixture processed, library says Fixed, rF AI playback captured. Short local
  Whisper-small CUDA transcript contains the expected repeated body paragraphs;
  `breathes` transcribed as `braze`, cause unconfirmed, not an exact fidelity pass.
  Evidence under tmp/native75-ocr-* and tmp/native75-principles-import.png.
- Device QA found unique running footer still in Principles page3. Existing filter
  requires repetition, so added conservative footer geometry (bottom margin,
  isolated baseline, widely separated label/folio) with body/heading safeguards.
  Commit a2bcfc2 and before/after tags pushed; full QA passed. Native confirmation
  requires76 and a fresh import. Import progress was only a spinner for the large
  book: wired existing page callbacks into shelf status,3f3a478; TypeScript passed.
- Copy correction b065ebc replaces all three "no OpenAI cost" strings with "with
  no cost". Both fixes and copy are included in76, not installed75.
- Owner completed Play purchase terms/payment flow on phone. App displayed Thank
  you; Play Order Management confirms October23 23:39 UTC Test: Support readFlow,
  readflow_support_1, Processed. No real charge claimed or initiated by agent.
  Evidence tmp/play-support-test-20261024.png and native75-support-completed.png.
  Cancellation/pending-path device tests not yet performed.
- Owner explicitly approved registering phone advertising ID with AdMob. Added
  readFlow QA Samsung Android test device; confirmed saved. Identifier stays out
  of source/docs. Proof tmp/admob-test-phone-20261024.png. No ad clicked.
- Ten-minute background-only scrcpy audio capture is running for Principles rF AI.
  Follow toggled off/on without stopping playback, active highlight observed;
  background Settings use tested. Phone screen switched off for lock playback
  check; recording/transcription review and wake/unlock still pending. No complete
  listening-quality or whole-book exactness claim. Local turbo model cache was
  incomplete; explicitly selected intact cached Whisper-small on CUDA, no download.
- The older bullets below retain earlier milestones; this block supersedes their
  pending75-build/import/payment statements. No production submission yet.

- Owner now requires background-only PC work and explicitly authorized ADB to
  operate only the connected phone. No mouse/keyboard takeover or
  foreground windows. Stopped the agent's scrcpy mirror. USB stay-awake is temporarily
  enabled for QA; restore original0 afterwards. Continue CLI builds/install/logs and hidden
  browser work and background ADB phone tests;
  do not silently substitute static checks for native visual or listening tests.
- Owner corrected download wording: replace "no OpenAI cost" with "with no cost".
  Updated all three user-facing occurrences in LibraryScreen/LocalNeuralVoice.
  This copy change is newer than internal build75 and belongs in final76+.
- Release blocker found on Play-installed 1.0.67 (74), October24 01:06:
  AndroidRuntime fatal exception in com.urmiaworks.readflow, PID465:
  IllegalStateException: MobileAds.initialize() must be called prior to setting
  app muted state. LibraryAds.tsx called setAppMuted before initialize; a JS catch
  cannot catch that asynchronous native fatal exception. This was an implementation
  error not caught by the earlier static checks. No book tests claimed on build74.
- Candidate is now 1.0.68 (75), still test ads. Initialization is awaited before
  muting and before rendering the banner. Added executable mocked-SDK regressions
  for pending initialization, concurrent calls and failure/recovery. npm run check:qa
  passed (TypeScript, config, generated text, 22 OCR hashes, reader/ad regressions).
  This proves JS ordering, not yet the native-device fix. Commit98cfbb0 and tags
  readflow-before-device-qa-20261024 / readflow-after-ad-startup-fix-1.0.68-20261024
  pushed to tmoradikh-png/readflow-app. Replacement internal AAB build:
  https://expo.dev/accounts/tohid123/projects/readflow/builds/e4b4d091-be04-4419-9bea-edac74f5065b
  FINISHED October23 23:20:17 UTC. Expo usage before build400/4500, overage zero.
- Fresh Play financial audit: all103 orders across five pages marked Test; latest
  August11. Query range January1 2008 to October23 2026; no real paid order found.
  All-six-product subscription report shows total/new/canceled subscriptions0 and
  gross revenue0 for April20-October20; data explicitly only through October20 UTC.
  Evidence: tmp/play-subscriptions-20261024.png. This is not a future/no-lag guarantee.
  Legacy base plans/services remain active pending the free production transition.
- Prepared free listing draft in MARKETING_PLAY_STORE.md; not saved/published in Play.
  Three owner-provided books plus English scan fixture staged on phone under
  Download/readflow-qa. Staging is not a successful import or OCR result.
- Latest-source preview 587d01d9-847c-4aba-a51d-c51d1348a661 FINISHED.
  Downloaded artifacts/readflow-1.0.67-74-free-preview-b3.apk (300697987 bytes).
  SHA256 E1381EA71AA5AF11FB84F1D11F51B103013EA9C9A4FCDEA5897B949C57498022.
  apksigner verification passed; aapt confirms 1.0.67 (74), minSdk24/targetSdk36.
- Samsung SM-S918B is USB-authorized. Originally installed Play app was 1.0.66 (73).
  Preview APK adb install -r failed INSTALL_FAILED_UPDATE_INCOMPATIBLE:
  Play's installed signing certificate differs from the Expo/upload-key APK.
  No uninstall or data clear performed. Google Play-signed APK74 then installed
  successfully; package manager confirms 1.0.67 (74), and the existing shelf appeared.
  Automatic Play protection was satisfied by Update from Play; package manager
  confirms code74 and installerPackageName=com.android.vending. Launch then hit the
  confirmed ad initialization crash above. Device QA is NOT complete.
- Internal-track AAB build from unchanged committed source FINISHED using included
  Expo credit: 0ec61a94-f90a-4e2f-80fd-f747cee487cf. Build link:
  https://expo.dev/accounts/tohid123/projects/readflow/builds/0ec61a94-f90a-4e2f-80fd-f747cee487cf
  AAB: artifacts/readflow-1.0.67-74-free-internal.aab, 204595041 bytes.
  SHA256 9A4D201F77A58665EDBC4AFA8E561584EDEFEB5DC002AAD1A655DE7F226B7444.
  Google-signed APK: artifacts/readflow-1.0.67-74-play-signed.apk.
  SHA256 9D60B27E854D8F1B8E8B90F28C4CFCA5ED2C623D820841318491C70E8B1C93AA.
  Internal release24 is Available to internal testers, released October24 01:01.
  Evidence: tmp/play-internal-published-20261024.png. Code74 is consumed; next75+.
  Play lists AD_ID in artifact74. Its old-active-artifact warning was ignored for
  this internal release only; no app permission or protection was disabled.
  app.json still enables test ads. A final live-ad production build remains necessary.
- Expo usage before this build: 300/4500 allowance units, total overage cost zero.
  Starter USD19 renewal October27 remains active. No new paid service authorized.
- AdMob All apps now says Getting ready / Limited ad serving / Review in progress.
  app-ads.txt detail still says no ad requests/no data. Do not claim full approval.
- Play Ads, Advertising ID and Data safety changes saved, ready for review, not
  submitted. Added ads SDK sharing/approximate location and retained old-client
  document/purchase disclosures. Details/evidence in PLAY_DATA_SAFETY_DRAFT.md.
  Actual b3 APK confirms Advertising ID permissions, no RECORD_AUDIO permission.
- Local scrcpy 5.0.1 downloaded from Genymobile official release into tools/;
  vendor SHA256 matched. Owner unlocked desktop; activation now works. A black
  hardware-decoded mirror was resolved by --hwdec=disabled --render-driver=software.
  readFlow-QA is usable; --no-audio is set, so no listening test is claimed.
- Phone stay_on_while_plugged_in was 0; temporarily enabled USB stay-awake.
  Restore to 0 at the end of QA. Preserve owner library and unrelated files.

The dated October21 sections below retain history; this section supersedes their
no-phone/in-progress preview statements. Production submission is still pending.

## Scope

- Candidate 1.0.68 (75); production last verified active at 1.0.66 (73).
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
Latest-source preview build 587d01d9-847c-4aba-a51d-c51d1348a661 was submitted
October 21 after the opt-out and lockfile fixes. Last check: IN_PROGRESS.
https://expo.dev/accounts/tohid123/projects/readflow/builds/587d01d9-847c-4aba-a51d-c51d1348a661
Use EAS_NO_VCS=1 and absolute EAS_PROJECT_ROOT=<ReadFlow>/mobile, with TEMP/TMP/npm cache
under ReadFlow/tmp. The inspected archive contained 104 files, 22 OCR packs, no private
books/backups/credentials, and no generated root android directory. Upload was 30.4 MB.
Do not run EAS with the repository root as the upload root: owner files are untracked there.

CLI account:usage before the latest build reported Starter, 200 of 4500 build allowance
units used (CLI units), zero overage cost, and an
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
Website privacy policy and app-ads.txt published October 21 with owner's approval:
https://urmiaworks.com/readflow/privacy and https://urmiaworks.com/app-ads.txt.
Device-code login succeeded after owner switched to tohid.moradi.kh@gmail.com,
account 490d777337f916bad4335f86dffb4f5e. Existing Pages project urmiaworks confirmed.
Initial deployment: https://e2a54433.urmiaworks.pages.dev. Wrangler reported 2 new assets,
25 reused, and successful Functions deployment. Public policy text and HTTP 200
publisher record verified; screenshot tmp/privacy-policy-published-20261021.png.
Staging copied previous deployment's public bytes, preserving the live readflow
index rather than the unrelated local edit. Existing headers/signup function retained.
Previous deployment exposed PROJECT.md, README.md and two .claude files; these were
excluded from the new production deployment. Historical deployment URLs were not
deleted or audited for secret contents. Staging/preservation manifest is under
tmp/website-approved-20261021. No private books or credentials were uploaded.
AdMob verification initially failed despite the public record matching the expected
publisher line. Existing robots.txt blocked every crawler. A narrowly scoped
Google-adstxt exception for /app-ads.txt was deployed and publicly verified at
https://6cb180ca.urmiaworks.pages.dev (1 new asset, 26 reused). Other crawl restrictions
remain unchanged. Verification still failed immediately afterward, and the detailed
AdMob table has no crawl data/ad requests. Exact remaining cause is unconfirmed;
do not repeatedly retry before Google has recrawled. Public Play developer website
points to urmiaworks.com. Google notes propagation can take up to 24 hours:
https://support.google.com/admob/answer/9776740.

After refreshing AdMob, the incomplete-payment banner disappeared and both message
editors worked. European message "readFlow European privacy choices" is Published,
English plus 31 available translations, EEA/UK/Switzerland, refusal enabled for all
regions. US message "readFlow US privacy choices" is Published, English plus two
Spanish variants, all current/future supported US states. Both select the Android app;
European policy URL is the newly published policy. Proofs:
tmp/admob-europe-consent-published.png and tmp/admob-us-consent-published.png.
These are console publication checks, not device consent/ads validation.
Payments form offers the existing Urmia Holding AS organization profile. Owner instructed
to review unchanged details and click Submit. Completion verified: AdSense (Norway)
is linked to Urmia Holding AS. Never submit
financial profile linkage on the owner's behalf. No bank information was requested there.

First Play order-history page still ends in August test purchases. This is not a fresh
full subscriber audit. Historic September audit found only test orders. Check active
subscriptions before retiring RevenueCat/Render or disabling old purchase options.
Play target audience currently selects only 18 and over; no age-setting changes made.

Fresh Play Subscriptions overview on October 21 shows all six products, April 17 to
October 17: total subscriptions 0, new subscriptions 0 and gross revenue NOK 0.00.
The page explicitly says data is only through October 17 UTC. This is a dated report,
not proof of no new purchases since then. Evidence: tmp/play-subscriptions-20261017.png.
Website/consent evidence and crawler fix committed/pushed as 853c057 using tmoradikh-png.
Tags: readflow-before-admob-crawler-20261021 and
readflow-after-free-website-consent-20261021. Owner's unrelated files remain untouched.

## Remaining Gates

1. Rebuild from committed source after the final opt-out/dependency fixes, then test
   installed Android app. The successful preview can test native import/audio meanwhile.
2. Test representative books against originals, OCR layout/headers/footnotes/figures,
   saved positions and rF AI background playback. Preserve existing regression fixtures.
3. Verify support purchase/cancel/pending/recovery using Play license test payments only.
4. Resolve app-ads.txt verification and AdMob app review. Payment warning has cleared;
   public files and consent messages are published. Device consent/revocation and
   actual ad delivery remain unverified.
5. Public privacy policy is deployed; update Play Data safety, Ads declaration and
   free store copy.
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
The completed preview predates these lockfile updates; latest-source build 587d01d9
includes them but has not yet completed.
Advisories: https://github.com/advisories/GHSA-pqg4-j6r4-53mv and
https://github.com/advisories/GHSA-r292-9mhp-454m.

Sources: https://support.google.com/admob/answer/7356092?hl=en-GB (publisher use is free);
https://developers.google.com/admob/android/privacy/play-data-disclosure (SDK disclosures);
https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent (UMP);
https://github.com/gradle/gradle/issues/31438 (Windows transform-cache defect).
