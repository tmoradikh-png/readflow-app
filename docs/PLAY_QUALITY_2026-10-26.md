# Android Play Quality Follow-Up

Candidate: 1.0.70 (77). Production remains 1.0.69 (76). Not submitted.
Before tag: readflow-before-play-quality-1.0.70-20261026 (9e1a026).

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
  Form/indirect image, cycles/malformed dictionaries and depth limit. Not yet run.
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
  Upload30.4MB. Build result pending.
- MEASURED baseline: production76 AAB has five DEX entries totaling39,071,464
  uncompressed bytes; no proguard.map/r8.json metadata. Counted ZipArchive entries,
  summing Length for /dex/*.dex, not an installed-memory measurement.
- Connected SM-G975F is Android12, with existing1.0.66(73). No uninstall, install,
  data clearing or device QA performed. Android15+ display QA remains necessary.

Do not publish until optimized native compilation, JNI voice/OCR/import/billing smoke
tests, retained image behavior and Android15+ layout checks pass. Inspect mapping and
R8 metadata, then have Play analyze the new artifact. Configuration checks do not
prove an achieved obfuscation percentage or that any dashboard warning is cleared.
