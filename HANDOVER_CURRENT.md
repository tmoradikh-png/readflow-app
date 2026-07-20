# readFlow Current Handover

Updated: 2026-07-21

Start here when taking over readFlow. This file is a short operational map. It
does not contain passwords, API keys, service-account JSON contents, signing
keys, or recovery codes.

## Current Production State

- Android app is live on Google Play.
- Public listing: `https://play.google.com/store/apps/details?id=com.urmiaworks.readflow`
- App name on Play listing: `readFlow PDF Reader with AI`
- Brand casing in product copy: `readFlow`
- Android package: `com.urmiaworks.readflow`
- Last submitted production hotfix: `1.0.28` / version code `34`.
- Current source and side-by-side QA candidate: `1.0.30` / version code `36`.
  It contains the reader stability, reviewer-access, page-continuity, title,
  reference-marker, and speech-articulation repairs described below. It is not
  public until a new AAB passes phone QA and is promoted in Play Console.
- Latest EAS Android build id: `51a83cdf-12d6-4692-a589-2de95fee28f2`.
- Latest EAS Android artifact:
  `https://expo.dev/artifacts/eas/8mCk29evi4lil-XgvjdOfx25sPS2955W7_PXh-ZGSO0.aab`
- Local AAB copy: `artifacts/readflow-1.0.29-35.aab` (135.04 MiB)
- SHA-256:
  `3FFE6ED7A3EAD29AD5DC2F391848E4A411D397502660B60B2EC551CA7045D5C6`
- Build `1.0.29 (35)` finished on 2026-07-20 from commit `d73084b` with
  Play Store distribution. Bundletool verified package
  `com.urmiaworks.readflow`, version `1.0.29 (35)`, required foreground audio
  permissions, and no `RECORD_AUDIO` permission.
- The next Android build must use version code `36` or higher after checking
  EAS and Play for consumed codes.
- A duplicate `1.0.28` / code `34` EAS build
  `46806d5f-aa25-4e9f-9031-5d3866824fe3` was started by a CLI timeout retry and
  also finished. Do not upload it as a separate release; it has the same code.

Hotfix reason: the live Play build could crash when starting Cloud AI/rF AI
audio because Android denied `expo.modules.audio.service.AudioControlsService`
without `android.permission.FOREGROUND_SERVICE`. Build `1.0.28 (34)` restores
the required foreground media-playback/data-sync permissions and service types
while still blocking microphone/recording permissions.

Do not click `Remove changes` for the `1.0.28 (34)` production change unless
the owner intentionally wants to cancel the submitted hotfix.

## 1.0.29 Reader Repair Candidate

The 2026-07-20 repair addresses release-blocking reading defects:

- Visible reading position is now the source for Last read, bookmarks, app
  resume, and manual page jumps. Positions store page, sentence-within-page,
  and a text preview so old records survive document reprocessing.
- Opening or jumping to a saved location mounts a nearby window directly. It no
  longer animates through every earlier page.
- Screen lock, unlock, rotation, and height-only layout changes no longer start
  repeated scroll recovery. Failed list jumps make one bounded recovery.
- Long books use a stable, expanding render window and stable page/sentence
  keys. This reduces shaky scrolling, prevents blocked page boundaries, and
  avoids remounting the list during ordinary reading.
- Chapter headings retain paragraph boundaries and render on a separate line
  with a distinct typeface, size, and spacing. Multilingual chapter markers are
  recognized without flattening the surrounding text.
- Read-aloud isolates headings from body text, announces a localized `Title`
  cue, slows the heading slightly, and pauses before the first body sentence.
- RevenueCat purchase and restore updates now invalidate the SDK cache, listen
  for CustomerInfo changes, and force a short backend refresh/retry sequence.
  This repairs the case where Google Play completed a subscription but the app
  continued to display Free because of the backend entitlement cache.
- Backward reader-window expansion is limited to 12 sentences at a time. This
  prevents variable-height rows from producing large backward jumps such as
  page 38 to page 9.
- Free includes a 5-minute-per-day on-device rF AI preview. This uses phone
  CPU, battery, and the downloaded model; it makes no OpenAI call.
- An internal Reviewer tier grants unlimited no-vendor-cost reading features
  and rF AI. It cannot use OCR, text AI, or Cloud AI voice.
- rF AI initialization no longer sends missing optional Supertonic tuning values
  as JavaScript `undefined`. `patch-package` now supplies `Number.NaN`, which the
  Android Sherpa bridge interprets as "use the model default" instead of crashing
  while casting `null` to Kotlin `Double`. The reproducible dependency patch is
  `mobile/patches/react-native-sherpa-onnx+0.4.3.patch` and runs on `postinstall`.
- The current sentence plus the next three sentences are measured before they
  become active. Active wrapped lines render as separate React Native `Text`
  rows, so Android/Fabric cannot retain the background from earlier lines in a
  paragraph. Audio chunk and buffer sizes are unchanged.
- Inline footnote/reference markers are recognized in common PDF forms such as
  superscript digits, `[2]`, `communities.2`, and `communities2`. They render as
  small raised digits and are removed before Device, rF AI, or Cloud AI speech.
  A retained source-offset map keeps the spoken position and line highlight in
  sync after those silent markers are removed. Decimal values and names such as
  `1.2`, `CO2`, and `MP3` are deliberately preserved.

Automated verification passed for TypeScript, backend build, release config,
Metro Android bundling, stable-position migration, heading parsing, 500-page
indexing, reviewer cost guards, and the final signed AAB manifest. On 2026-07-20
the side-by-side QA APK was installed on Samsung SM-G975F. An 8-page retained
document resumed on page 3 after force-stop/relaunch, then scrolled backward to
page 2 without jumping; focused AndroidRuntime/ReactNativeJS logs contained no
crash. Long-book page-39 regression, audible heading quality, paid lock-screen
playback, and sandbox purchase/restore still require owner-observed QA.

On 2026-07-20 the newer source was also installed as side-by-side package
`com.urmiaworks.readflow.qa` on Samsung SM-S918B. A retained 133-page book opened
at page 38. rF AI reached Android `PLAYING`, remained alive without
AndroidRuntime/ReactNativeJS errors, and timed screenshots confirmed that one
wrapped line at a time carried the coral highlight during automatic scrolling.
The same retained book displayed the source text `communities.2` as a small
raised `2`. A direct speech-pipeline check produced `communities. The evidence`,
confirming that the marker is not sent to any TTS engine. The QA APK enables
the tracked `expo.extra.qaReviewerMode` build flag in its generated workspace.
That flag grants only the cost-free Reviewer tier and is absent from production
`app.json` and Play builds.

The existing `artifacts/readflow-1.0.29-35.aab` was built before the entitlement
refresh, 12-row backward expansion, spoken-title treatment, Sherpa initialization
patch, independent active-line rows, and silent reference markers. Do not use
that artifact to verify these fixes. The next Play candidate must be rebuilt
with version code `36` or higher.

## 1.0.30 Regression Repair Source

The tracked source is now `1.0.30 (36)`. It adds a pure/testable speech-chunk
pipeline that keeps unfinished sentences continuous across PDF page boundaries
without removing the visual page divider. rF AI speech normalization now makes
auxiliary pairs such as `would have` explicit and bumps the generated-audio
cache key to `ss0.21`, preventing stale audio from hiding the repair.

AI Pro, Power, and cost-free Reviewer access now permit downloaded rF AI and
Cloud AI audio to continue after screen lock or app switching, using Expo Audio
lock-screen controls. Free, Reader Plus, and Device voice remain foreground-
only. The plan source of truth also applies the owner-directed beta limits:
Free is one native-text import, 300 pages and 5 rF AI minutes/day; Reader Plus
has unlimited supported native-text reading and unlimited downloaded rF AI
during beta, with no OCR, text AI, or Cloud AI allowance.

The permanent bug ledger and release matrix is
`READER_REGRESSION_CHECKLIST.md`. `npm run check:release` now executes its pure
reader assertions. Manual connected-phone results must be added there or here;
do not consider source-level checks sufficient for audio quality/background QA.

### 2026-07-21 Connected-Phone QA Record

The standalone reviewer build `com.urmiaworks.readflow.qa` version `1.0.30`
(code `36`) was installed on Samsung SM-S918B. It opens the retained 133-page
book directly at the persisted reading position (page 39 during the check),
without a visible journey from page 1. rF AI successfully entered Android media
`PLAYING` state, created the foreground audio service and media notification,
and continued after a Home/app-switch check. The production package was removed
from Android user 0, leaving only the intended QA package there.

The build uses the cost-free **QA Reviewer** entitlement: no OCR, Cloud AI,
text AI, or paid quota can be consumed, while local downloaded rF AI and
background-media behavior can be tested. The voice sheet explicitly says that
Reviewer, AI Pro, and Power keep rF AI reading after screen lock with
lock-screen controls. A human still needs to listen to the revised `would have`
render and a real PDF page-boundary sentence before a production promotion.

Play Console may show `0` downloads shortly after real installs. Use Play
Console Statistics and Release dashboard for install metrics; the public store
download badge and dashboard summaries can lag, and internal tester installs may
not appear like public acquisitions.

On 2026-07-21 the QA APK was rebuilt and reinstalled after comparing pages 42
and 43 against readFlow's own backend extraction of the 133-page English
manuscript. The extractor confirms the source contains `must not become`,
`emperors, and people`, and the isolated title `Loyalty that refuses`. The app
now recovers short sentence-case PDF headings even when the text layer loses
blank lines, sends a stronger speech-only boundary for the repeated-subject
conjunction, and adds a light articulation pause before `become`. Generated rF
audio cache version `ss0.22` prevents older WAV files from masking the change.

Automated release, TypeScript, exact manuscript regression, and backend build
checks pass. Human QA is still required on the unlocked Samsung: verify page 43
renders `Loyalty that refuses` as a separate heading and says `Title` before it;
verify `emperors, and people inside` retains `and`; and verify page 42 says the
complete phrase `must not become innocence`. Do not promote this candidate
until those three audible checks pass.

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

Reviewer access requires two Render secrets that must never be committed:

- `REVIEWER_ACCESS_CODE`: a strong code supplied only in Play App access
  instructions or directly to trusted reviewers.
- `REVIEWER_TOKEN_SECRET`: a separate random signing secret, at least 32 bytes.

In the app, the reviewer opens `Shelf -> ? -> App review access`, enters the
access code once, and taps Activate. The backend returns a signed, app-install
bound reviewer token. Reviewer access is hidden from public pricing and cannot
call OpenAI, OCR, or Cloud AI voice. A separately packaged local QA build may
set `expo.extra.qaReviewerMode=true`; it grants the same cost-free Reviewer
tier without a token and must use `com.urmiaworks.readflow.qa`, never the
production package. Rotate both secrets if the access code is shared outside
the intended review group.

Google Play internal/closed tester membership does not itself create a
`reader_plus` RevenueCat entitlement. For beta access, prefer the existing
Reviewer code because it already grants unlimited native-text reading and rF AI
without vendor-cost features. A tester can instead make a Google Play test
purchase after being added to License testing, or an operator can grant a
time-limited RevenueCat entitlement to a known app-user id, but neither option
is automatic. Never enable the global development entitlement override on the
production backend.

## Billing State

Android billing is wired through Google Play Billing, RevenueCat, and the
backend.

- Mobile uses `react-native-purchases`.
- EAS has `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
- Render has `RC_SECRET_KEY`.
- RevenueCat Android app: `readFlow (Play Store)`.
- RevenueCat offering id: `default`.
- Entitlements: `reader_plus`, `ai_pro`, `power`.
- Source after the 2026-07-20 repair immediately reconciles RevenueCat
  CustomerInfo with a forced backend lookup after purchase, restore, app resume,
  or SDK entitlement notification. Deploy the matching backend before testing
  this mobile fix.
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

Owner's numbered priorities are implemented in `1.0.30 (36)` source. The
standalone reviewer build passed resume and Home/app-switch background checks;
these items remain for human audible/lifecycle verification before production:

1. Confirm Free/Reader Plus beta limits against the production backend after it
   is deployed.
2. Audibly confirm the page-39 `would have` sentence with a fresh `ss0.21` render.
3. Test AI Pro/Power lock, Home, notification controls, headset controls, and
   process recreation; also confirm Free/Reader Plus stop outside the app.

- Configure `REVIEWER_ACCESS_CODE` and `REVIEWER_TOKEN_SECRET` in Render, then
  add the code and navigation path to Play Console App access instructions.
- Build a new Android candidate with version code `36` or higher after the
  entitlement/title/navigation/rF AI repair, upload it to a Play internal track,
  and complete the remaining reader regression checklist before public
  promotion. The older `artifacts/readflow-1.0.29-35.aab` does not contain the
  final repair.
- Finish license-tester purchase, restore, cancel, expiry, and entitlement tests.
- Improve over-limit UX so quota/file-too-long states open an upgrade prompt.
- Deploy the `1.0.30` canonical plan changes before relying on the revised Free
  and Reader Plus limits. Free-tier ads remain an undecided follow-up.
- Add a custom API domain instead of the confusing Render legacy subdomain.
- Commit or organize Play listing graphics from `pic/` if they should be kept.
- Build iOS only after App Store Connect products and RevenueCat iOS app setup.
- Monitor Render/OpenAI costs and keep AI/Cloud AI allowances within the cost
  model in `COST_MODEL.md`.
