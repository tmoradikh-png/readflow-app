# Android Play Quality Follow-Up

Candidate: 1.0.71 (78). Internal1.0.70(77) failed picker QA; do not promote.
Production remains 1.0.69 (76). No production submission.
Before tag: readflow-before-play-quality-1.0.70-20261026 (9e1a026).

## October 27 Release Request and Remaining Advisory

Owner now explicitly requests all issues fixed and production release. The earlier
internal-only instruction is superseded, but no production promotion has occurred.
The production dashboard still reports the three findings for76. Candidate78 has
the verified DEX/bitmap improvements and bounded Android12 smoke results below;
these do not establish that every production warning is cleared.

Latest upstream [React Native0.88 WindowUtil](https://raw.githubusercontent.com/facebook/react-native/v0.88.0/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/views/view/WindowUtil.kt)
still contains legacy bar-color and cutout compatibility calls. RN0.87 removed
StatusBarModule color methods, but that alone does not remove WindowUtil's sites.
A broad Expo/RN upgrade therefore has no verified all-warning fix. No dependency,
minimum Android version, bytecode or warning-suppression changes were applied.

Public npm metadata: ads wrapper17.4.0 requires RN>=0.86;16.5.0 embeds Google Ads25.4.0.
A local constant-pool scan of Google's public play-services-ads25.5.0 classes.jar
found no Window get/setStatusBarColor or get/setNavigationBarColor method references.
This is only one artifact, not a complete dependency or runtime/compatibility audit;
it does not prove an app upgrade clears the advisory. Research files are under tmp.
Sources: [wrapper metadata](https://registry.npmjs.org/react-native-google-mobile-ads/17.4.0),
[16.5 metadata](https://registry.npmjs.org/react-native-google-mobile-ads/16.5.0),
[Google Ads release notes](https://developers.google.com/admob/android/rel-notes).

Android15+ validation remains unavailable locally: connected SM-G975F is Android12;
hardware audit reports firmware virtualization disabled, HypervisorPlatform disabled,
and no installed emulator/AVD. No machine configuration changed. Play pre-launch
overview has no reports; settings show no test credentials/script configured.
No phone input, build, upload, account change or paid service was performed here.

Asked owner whether to release78 with the unresolved advisory documented or hold
production until all three findings are resolved. Await this scope decision; do not
silently reinterpret "all issues" as two fixes. Existing source remains db12868.

## Build 78 Evidence

Replacement78 source db12868 is committed/pushed. EAS build
300660f8-4e6b-4b5f-99d8-c6731a72859d FINISHED using existing included credit.
Fresh billing still showed USD6/USD45 included, renewal canceled/Free scheduled.
Internal release28 (1.0.71/78) is available to testers and the track is Active,
released October27 at00:40 Console time. It supersedes failed77; production76
is unchanged. Proof: tmp/play-quality78-internal-20261027.png.

Replacement AAB: artifacts/readflow-1.0.71-78-quality.aab, SHA256
F177D14954E1AAA1DEB9F5C92DBB7B51DED6AF68801150B14BD0650C00835912.
One DEX,10,793,288 uncompressed bytes; r8 noObfuscationPercentage15.26.
Mapping and DEX confirm Field and key retain original names, Tesseract nine-int
callback and boxed sherpa callbacks remain. SampledImageReader remains absent.
Derived files: tmp/quality78-mapping.txt and tmp/quality78-dex.xml. DEX inspection
also confirms JPXFilter (z7.h) has only decode helpers, with no encode method.
Play reports High DEX optimization,92% obfuscation, Full Mode and resource shrinking
for78. Proof: tmp/play-quality78-dex-20261027.png. Optimization/shrinking percentage
fields are dashes, not measured values. The phone retest below now supersedes the
earlier installation blocker. No production promotion.

## October 27 Device Blocker and Correction

Internal77 was successfully acquired through Play on SM-G975F/Android12; package
manager confirms version77 and com.android.vending installer. Startup/free shelf
passed. Add document failed before opening the picker: ExpoDocumentPicker options
could not be converted to DocumentPickerOptions, caused by NullPointerException.
Evidence: tmp/quality77-picker-failure.xml and .png. No import, OCR or voice pass.
The phone's library was empty before the update; no uninstall/data clearing occurred.

Record fields/getters are retained in the DEX, but Field is renamed to H8.b. This
matches [merged Expo PR51206](https://github.com/expo/expo/pull/51206) for SDK54 with
R8 8.11.18: preserving the Field annotation fixes the same record-conversion failure.
The exact runtime null mechanism is not established locally or in the upstream PR;
do not claim annotation defaults were stripped. Backported the narrow upstream keep
rule, retained all other optimization, and added a configuration regression check.
Candidate78 native build and unchanged-Field artifact audit passed. Targeted device
tests subsequently passed as recorded below; the remaining release limits still
apply. No speculative framework upgrade.

Owner authorized coordination with Assess ad-supported Sonos casting, chat
01a1759b-3601-72e3-bc6d-caa4f7436b84. That chat granted an exclusive QA window and
required the active casting session/audio settings remain untouched. The first
window ended with USB stay-awake restored to0. A second window was explicitly
granted after78 finished: Sonos demo captured/casting restored/commands stopped.
That second window is now released: USB stay-awake restored/read back0, phone
commands stopped and coordination chat notified. Casting/routing/volume untouched.
Play detail reopening and a fresh Play process did not offer78; its Updates list
also lacked readFlow. Installed package remains1.0.70(77), installercom.android.vending.
No update/uninstall/data clearing occurred during this window. Waiting for Play
delivery or owner approval of a one-time browser Downloads exception for Google's
signed APK, to be immediately moved into ReadFlow/artifacts. Request a fresh exclusive
phone window before installation/retest. No78 device pass is claimed at this point.

Owner subsequently approved the download exception and asked to finish properly.
Google-signed APK downloaded once and immediately moved into
artifacts/readflow-1.0.71-78-google-signed.apk; SHA256
6E0A56161DEAC42F00819920C16A0CA409A4BB121B388C9941A8E8B8732754BE.
Signature matches the previously installed app. Sonos chat granted a fresh exclusive
window. ADB update returned Success and package manager shows1.0.71(78), without
data clearing. Launch required Get this app from Play; selected official Update
from Play and acquisition completed. Final package manager confirms1.0.71(78) and
installercom.android.vending. No bypass of the Play acquisition requirement.

## October 27 Build 78 Phone Results

Bounded smoke tests on Samsung SM-G975F/Android12, coordinated third phone window:
- Startup and document picker pass. The77 options-conversion failure no longer
  reproduces. Imported three documents without uninstalling or clearing app data.
- Clean one-page fixture: heading and both body paragraphs match the known source
  text; screenshot/XML tmp/quality78-clean-import.*. This is not whole-book fidelity.
  Its isolated test-page footer remains in imported text; no universal footer claim.
- Scanned one-page fixture: Tesseracteng initializes, OCR completes (shelf Fixed),
  original image renders and its recognized text drives voice. Sparse scanned pages
  intentionally remain visual; OCR text was not directly compared through a text
  export. Do not treat displayed source pixels as an OCR-accuracy measurement.
  Evidence tmp/quality78-ocr.png and quality78-native-smoke-evidence.txt.
- rF AI: sherpa supertonic JNI engine initialized and AudioTrack delivered frames;
  media session PLAYING observed. Play/pause/restart, Follow off/on and Stop worked.
  Final media-session check showed no active readFlow session. This is a short native
  control/synthesis test, not an audible-quality review or a ten-minute endurance test.
- Extreme Ownership imported288pages; progress179/288 observed. Cover and page15
  photo/caption render. Original then Reflow both retainedpage15 without a crash.
  Evidence tmp/quality78-photo15.png/.xml, quality78-original15.xml, quality78-reflow15.xml.
  Previously recorded stray reference in page16 (convoy of 1 Humvees) remains; outside
  the three Play optimization changes, not silently represented as corrected.
- Optional support loaded local pricing and opened Google's Review and agree terms.
  Canceled with Android Back; no terms acceptance/purchase. Billing UI initiation
  passes, but a completed payment/cancellation lifecycle is not retested in78.
  Evidence tmp/quality78-support-terms.xml.
- Phone returned to library with three QA documents, playback stopped. USB stay-awake
  restored/read back0; phone commands stopped and Sonos chat notified. Its casting,
  routing and volume were not changed. Android15+ layout QA remains outstanding.

Two UI hierarchy captures failed to idle during the long import animation; switched
to screenshots and observed progress/completion. No stale hierarchy drove input.
No claim that all three Play warnings are cleared: DEX is verified High/92%, bitmap
sites are absent and image behavior passes the targeted test, but deprecated SDK
edge-to-edge calls remain unresolved and fresh bitmap recommendation clearance has
not been shown in a production dashboard. Production76 is unchanged.

## Evidence and Changes

Play production dashboard on October26 reported obfuscation2% with a February2027
deadline. Expo's release template defaulted minification and resource shrinking to
false, and used the non-optimizing ProGuard default. The new config plugin enables
both and selects proguard-android-optimize.txt on every prebuild. It preserves JNI
contracts for sherpa's extracted classes.jar and boxed FloatArray TTS callbacks.
It does not disable obfuscation globally or keep all PDFBox classes.
The transformation is idempotent and fails if the expected Gradle template changes.
See [Android R8 guidance](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization).

Play named PDFBox JPXFilter.encode and SampledImageReader.getRGBImage as unsampled
bitmap sites. readFlow does not use these methods to render pages: original display
uses PDFium and OCR uses Android PdfRenderer, already capped at six million pixels.
However, the image-presence scan constructed PDImageXObject, which can decode JPX
data just to detect a picture. It now inspects XObject dictionaries, including nested
Forms, without constructing/decoding images. Cycle/depth guards remain. Images are
not removed, resized or modified by this scan. R8 should strip unreachable library
code, but removal of both named sites must be verified in optimized output/Play.

Play's edge-to-edge list is entirely in dependencies:
- React Native StatusBarModule.getTypedExportedConstants and setColor.runGuarded.
- React Native WindowUtilKt.enableEdgeToEdge, statusBarHide and statusBarShow.
- Google ads internal overlay zzl.zzJ.

App edge-to-edge remains enabled; status bars already use style/visibility, not JS
color/translucency overrides. Added left/right safe-area padding to the reader so
landscape cutouts do not cover its content/controls. This fixes a source-level layout
gap, not the upstream deprecated-API warning. Both RN0.81.5 and0.83.0 retain the
reported calls; current upstream WindowUtil also retains legacy bar-color calls.
No unsupported bytecode rewriting, global assumption about OS APIs or warning-hiding
rules were added. Clearing that recommendation remains unresolved pending a verified,
compatible dependency fix, not a blind framework upgrade.
Sources: [RN0.83 WindowUtil](https://github.com/facebook/react-native/blob/v0.83.0/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/views/view/WindowUtil.kt),
[Android15 behavior](https://developer.android.com/about/versions/15/behavior-changes-15#edge-to-edge).

## Verification and Release Gate

- TypeScript, check:release, optimizer transformation/idempotence/fail-closed checks,
  reader/ad regression suite and bundled OCR asset checks passed.
- Prebuild produced version77, minify=true, shrinkResources=true and optimizing rules.
- Added native metadata tests: direct oversized JPX metadata (no decoder), nested
  Form/indirect image, cycles/malformed dictionaries and depth limit. EAS log shows
  testReleaseUnitTest completed without a failure before continuing release compilation;
  separate XML test report not yet retrieved.
- First local build failed deleting old Kotlin output folders. Deletion was blocked;
  nothing was deleted. A fresh-output init script bypasses stale outputs without
  removing them. Initial script also relocated the root linker output, an assistant
  setup error; corrected to relocate only dependency outputs under node_modules.
- Restored the ignored local Gradle wrapper to Expo54's8.14.3 template (was9.1.0).
  Third local attempt stopped because PowerShell split an unquoted Gradle system
  property into a task name, another assistant setup error. No further local retries.
- Switched to EAS Linux build12ccfc0a-a4e9-483a-9df7-501004279bed (internal profile).
  Native metadata tests run before bundleRelease; medium worker, existing credentials.
  Billing page showed USD6 used of USD45 included, renewal canceled/Free scheduled.
  No new paid service/overage or Play changes. Mobile-only archive inspected:108files,
  60,075,135 uncompressed bytes; no books/APKs/backups/keys/env/cache/generated Android.
  Upload30.4MB. Build FINISHED successfully; native test task and bundle completed.
- Expo Doctor15/18: expo-asset exists transitively/pinned by override but is not
  declared directly; background-actions lacks new-architecture verification metadata;
  local/sherpa packages have no directory metadata; three Expo patch versions lag.
  These dependencies are unchanged from76; no warning exclusions or speculative
  dependency upgrades were added. Record as separate maintenance follow-up.
- MEASURED baseline: production76 AAB has five DEX entries totaling39,071,464
  uncompressed bytes; no proguard.map/r8.json metadata. Counted ZipArchive entries,
  summing Length for /dex/*.dex, not an installed-memory measurement.
- Connected SM-G975F is Android12, with existing1.0.66(73). No uninstall, install,
  data clearing or device QA performed. Android15+ display QA remains necessary.

## October 27 Artifact Inspection

- Source b3736fb is committed/pushed. EAS build
  [12ccfc0a-a4e9-483a-9df7-501004279bed](https://expo.dev/accounts/tohid123/projects/readflow/builds/12ccfc0a-a4e9-483a-9df7-501004279bed)
  finished successfully. Local artifact: artifacts/readflow-1.0.70-77-quality.aab.
  SHA256: 00601CF5299F4B4C9A33D6202901E469A23F9D9E59D042605F07D5E29699B6E8.
- MEASURED via ZIP entries: one DEX, 10,792,436 uncompressed bytes, versus five DEX
  and 39,071,464 bytes in76. CALCULATED reduction: (1 - 10792436/39071464)*100
  =72.38%. This is bytecode size, not total download size or installed RAM.
- QUOTED from embedded com.android.tools/r8.json: R8 8.11.18; obfuscation,
  optimization and shrinking enabled; noObfuscationPercentage15.25,
  noOptimizationPercentage16.17, noShrinkingPercentage16.01. CALCULATED complements:
  84.75%,83.83%,83.99%. These are artifact metadata, not a fresh Play score.
  Both r8.json and proguard.map are embedded; neither existed in76.
- Mapping and SDK dexdump inspection: SampledImageReader is absent; JPXFilter is
  retained as z7.h with decode helpers but no encode method. The two reported
  unsampled bitmap sites were removed. Play reanalysis is still required.
- JNI audit: sherpa DTO names/getters and boxed FloatArray callbacks are retained.
  Tesseract onProgressValues with nine int parameters is present in DEX under its
  original name. It is absent from mapping.txt, illustrating why mapping absence
  alone is not proof of removal. Its nativeClassInit looks up that exact signature.
  This static audit is not a substitute for actual OCR/voice device tests.
- Local derived evidence: tmp/quality77-mapping.txt and tmp/quality77-dex.xml,
  generated from this AAB with ZIP extraction and Android SDK dexdump -l xml.
- Internal release27 is available to internal testers, October27 00:07 Console time.
  No devices were removed from the supported-device list. Production remains76.
- Play bundle explorer reports DEX optimization High, obfuscation92%, Full Mode and
  resource shrinking enabled, total uncompressed DEX10.8MB. This supersedes the
  earlier pending-score state. Its92% is a separate reported metric from the84.75%
  complement of R8 metadata; the exact difference in calculation is not established.
  Optimization/shrinking percentages are shown as dashes, not zero or measured values.
  Proof: tmp/play-quality77-dex-20261027.png; internal-publication proof:
  tmp/play-quality77-internal-20261027.png. Install download shown70.3MB,9.95MB smaller
  than76 (Play estimate, not measured network transfer).
- Play-signed APK: artifacts/readflow-1.0.70-77-google-signed.apk, SHA256
  302771D8EC4D9B7A5E1C017C3A624FB5F6721A197ECA74859F3B0D8FB0DAB200.
  Its signer matches the installed73 certificate. ADB update returned Success, with
  no uninstall/data clearing. Initial library was empty. Launch then required Get
  this app from Play; Update from Play was selected, but completion is not verified.
  The phone switched to Cast to Sonos; stopped input and restored temporary USB
  stay-awake2 to original0. Owner authorized coordination with that chat before QA.
- Upstream edge-to-edge deprecated API recommendation remains unresolved. Neither
  a bitmap-warning-free dashboard nor completed phone QA has been claimed.

Do not publish until optimized native compilation, JNI voice/OCR/import/billing smoke
tests, retained image behavior and Android15+ layout checks pass. Inspect mapping and
R8 metadata, then have Play analyze the new artifact. Configuration checks do not
prove an achieved obfuscation percentage or that any dashboard warning is cleared.
