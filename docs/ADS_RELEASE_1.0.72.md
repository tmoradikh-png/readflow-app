# Library Ad Recovery - 1.0.72 (80)

Updated November 15, 2026. Build79 is accepted in an unpublished internal draft.
S23 QA79 passed demo-ad layout and network recovery, but exposed a privacy-form
loading error. QA80 and production80 are built. Play accepted80 into the existing
unpublished internal draft; submission remains held for native privacy verification.
The S23 disconnected after QA80 installation, before the app could be launched.

## Scope

- Keep the native banner mounted after failed loads so AdMob's configured
  automatic refresh can recover. No competing JavaScript refresh timer.
- After a consent-update/form error, check UMP's current `canRequestAds` result.
  Never assume consent or read an app-maintained cached consent flag.
- Measure the library slot and pass its width to the adaptive banner, rather than
  requesting the full window width inside a potentially narrower container.
- Reuse UMP's current consent information when opening privacy choices instead
  of refreshing it immediately before showing its asynchronously preloaded form.
  Keep the launch-time refresh and the SDK permission gate. A transient form
  failure remains retryable by the user, without falsely blaming connectivity.
- Preserve PG ad content rating, the library-only placement, muted ads, privacy
  choices, free reading and optional support. No additional ad formats or SDKs.

These are delivery and layout fixes, not a verified eCPM or revenue improvement.
Do not raise floors or broaden sensitive content solely to inflate eCPM.

## Verification

TypeScript, release configuration, reader regressions, OCR asset verification
and new mocked-native ad component checks passed on both the working tree and
the isolated Android release source at commits `fbcc615` and `2e31390`. The new checks
cover permission denial, prior-session consent after update/form errors, failed
consent-state reads, width, backgrounding, hidden library, privacy revocation,
late consent completion and SDK initialization failure/retry.
Build80 additionally checks that opening privacy does not restart consent updates
and that form-loading errors remain safely retryable without automatic loops.

QA80 build `f6165c4c-c4d9-4247-916b-73db428b96fc` finished. Artifact:
`artifacts/readflow-qa-1.0.72-80-demo-ads.apk`, 290764294 bytes, SHA-256
`1E02AD08519293F4CB27D7195822BC3A646186C3E0B4297FE8B2709AFC136622`.
Compiled package/version, demo-only config, absent advertising-ID permissions
and unchanged disposable debug signature verified. Installed successfully on the
S23, but not launched/tested before its USB connection disappeared. Cleanup of the
temporary QA80 package and USB stay-awake setting is pending reconnection. The
original app/data were not changed. Phone queue released; no phone process remains.
Production80 build `b5435348-fec8-43aa-903d-e8aaeb1a3ca6` finished using the
existing upload identity and free quota. Both80 archives contain109files and
22 OCR models; no private inputs or unrelated iOS/website changes.
Both cloud logs confirm native test execution and successful Gradle builds.
Production artifact: `artifacts/readflow-1.0.72-80-ads.aab`,201895400bytes,SHA-256
`8585D567B5DC711CA6A4D461EB6C2136B817BE167A6E53071904B202DEEB3545`.
JarFile signature verified and existing upload certificate matched. Play accepted
the artifact with mapping and native symbols, no newly unsupported devices or
blocking errors. Internal draft29 now contains80 only, named1.0.72(80), with the
approved release notes unchanged. Build79 remains recoverable in the artifact
library. Save and publish was NOT pressed. Production remains last-verified78.

EAS production build `242625bd-8a27-47fb-9fcd-1195e2b204b9` finished. Its Gradle
log confirms `:readflow-offline:testReleaseUnitTest` and a successful build.
Artifact: `artifacts/readflow-1.0.72-79-ads.aab`, 201895396 bytes, SHA-256
`9A142E1FE93BC31C6EE62E604DCEA50B929179F6A734E9A0BC25E4157CA48473`.
The upload certificate matches the existing identity. JDK JarFile signature
verification passed, with self-signed, timestamp and stream-entry-order warnings;
Google Play accepted and processed this earlier bundle. It was superseded in
internal draft29 by80 without publication.

S23 demo banners loaded in portrait and landscape. After one offline launch,
the native SDK logged a failed load while the Advertisement slot stayed mounted.
The test banner returned without app restart, observed108seconds after restoring
connectivity. No live ads or ad clicks were used. Privacy choices did not remain
visible on two attempts; a separate post-recovery capture logged the native
error "Privacy options form is being loading. Please try again later." AdMob's
published message has consent, refusal and manage-options controls enabled.
The extra per-click consent update is removed in80 to avoid racing preloading;
that diagnosis does not establish why the earlier forms dismissed automatically.
Native privacy verification is still required. Production submission is pending.
A mocked SDK test does not prove real ad delivery, consent UI or revenue.
Existing unrelated native PDF/phone-voice crash reports are outside this ad fix.

For S23 testing without registering its advertising ID, a separate QA variant
finished as `33ce2b59-a3bf-4a12-a66b-82dc784cb279`. It uses the same application
source with only app/build configuration differences: the `.qa` package/name and
scheme, demo ad units with `adsTestMode: true`, and both advertising-ID permissions
blocked. It assembles a release-mode APK without production credentials, using
the template's disposable debug signing configuration. Compiled APK permissions,
demo configuration and signature were verified before installation. The disposable
QA package was removed after this test; original app/data were untouched, temporary
phone settings restored and the shared phone ticket released. Never publish this QA variant or treat it
as proof of production ad fill or revenue. The original production AAB is unchanged.

For a clean Windows source export, use `git -c core.autocrlf=false archive`.
Default Windows line-ending conversion changed generated-source comparisons and
the OCR license checksum in three packaging attempts. Explicitly disabling that
conversion preserved committed bytes and passed the unchanged checks. Do not
weaken checksums or regenerate text rules merely to work around checkout bytes.

## Release Gates

- Exclude unrelated uncommitted iOS and website changes from the Android source.
- Build with the existing upload identity; no key regeneration or paid services.
- Obtain exact release-note/upload approval before external submission.
- Use only test ads for QA, with shared-phone ownership first; never click ads.
- Compare complete comparable reporting windows after release. Review total
  earnings, earnings per active user, fill/show rate and retention alongside eCPM;
  report sample limits and do not infer attribution from rolling-window changes.

Exact release notes approved November 15:

Improved library ad recovery after connection errors and banner sizing. Free
reading and listening remain unchanged.

## Sources

- [Google banner refresh guidance](https://developers.google.com/admob/android/banner)
- [Google UMP error and permission guidance](https://developers.google.com/admob/android/privacy)
- [Google floor trade-offs](https://support.google.com/admob/answer/3418058?hl=en)

The installed react-native-google-mobile-ads 15.8.3 BannerAdProps definition
supports explicit adaptive width. No dependency upgrade is included.
