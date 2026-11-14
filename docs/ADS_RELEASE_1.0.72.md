# Library Ad Recovery - 1.0.72 (79)

Prepared November 14, 2026. Not built or submitted yet.

## Scope

- Keep the native banner mounted after failed loads so AdMob's configured
  automatic refresh can recover. No competing JavaScript refresh timer.
- After a consent-update/form error, check UMP's current `canRequestAds` result.
  Never assume consent or read an app-maintained cached consent flag.
- Measure the library slot and pass its width to the adaptive banner, rather than
  requesting the full window width inside a potentially narrower container.
- Preserve PG ad content rating, the library-only placement, muted ads, privacy
  choices, free reading and optional support. No additional ad formats or SDKs.

These are delivery and layout fixes, not a verified eCPM or revenue improvement.
Do not raise floors or broaden sensitive content solely to inflate eCPM.

## Verification

TypeScript, release configuration, reader regressions, OCR asset verification
and new mocked-native ad component checks passed on both the working tree and
the isolated Android release source at commit `fbcc615`. The new checks
cover permission denial, prior-session consent after update/form errors, failed
consent-state reads, width, backgrounding, hidden library, privacy revocation,
late consent completion and SDK initialization failure/retry.

Native build, phone smoke test and store submission are pending. A mocked SDK
test does not prove real ad delivery, consent UI, revenue, or device layout.
Existing unrelated native PDF/phone-voice crash reports are outside this ad fix.

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

Proposed release notes (pending approval):

Improved library ad recovery after connection errors and banner sizing. Free
reading and listening remain unchanged.

## Sources

- [Google banner refresh guidance](https://developers.google.com/admob/android/banner)
- [Google UMP error and permission guidance](https://developers.google.com/admob/android/privacy)
- [Google floor trade-offs](https://support.google.com/admob/answer/3418058?hl=en)

The installed react-native-google-mobile-ads 15.8.3 BannerAdProps definition
supports explicit adaptive width. No dependency upgrade is included.
