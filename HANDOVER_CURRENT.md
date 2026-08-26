# readFlow Current Handover

Updated: 2026-08-26

Start here when taking over readFlow. This file is a short operational map. It
does not contain passwords, API keys, service-account JSON contents, signing
keys, or recovery codes.

## Current Production State

- Android app is live on Google Play.
- Public listing: `https://play.google.com/store/apps/details?id=com.urmiaworks.readflow`
- App name on Play listing: `readFlow PDF Reader with AI`
- Brand casing in product copy: `readFlow`
- Android package: `com.urmiaworks.readflow`
- Current live production release: `1.0.66` / version code `73`.
  It contains the reader stability, reviewer-access, page-continuity, title,
  reference-marker, bounded local-synthesis, and independent speech
  text-intelligence and progressive-rF-playback repairs described below. It is
  available on Google Play.
- Latest EAS Android build id: `4ee76bca-814b-4a79-8acf-e5c9881002a7`
  (`1.0.66 (73)`, internal/store profile, commit `d941d50`).
- Latest EAS Android artifact:
  `https://expo.dev/artifacts/eas/iKL2zWQ-jR_iXAZJfPrEnnUsu0qCEnD5FvyPeRgTExg.aab`
- Local candidate AAB copy: `artifacts/readflow-1.0.66-73-internal.aab`
  (151,501,398 bytes)
- SHA-256:
  `335964023DCD72DEE5A881DC0111EDFDDF5DB51334444FEF41FB2D895625BB03`
- Build `1.0.50 (57)` finished on 2026-07-22 from commit `9870a69` with
  Play Store distribution. Play parsed it as package
  `com.urmiaworks.readflow`, version `1.0.50 (57)`, target SDK 36, minimum API
  24. The release check verified required foreground-audio permissions and no
  `RECORD_AUDIO` permission in source configuration.
- `1.0.50 (57)` was uploaded to the Google Play production track on
  2026-07-22 and submitted for a 100% rollout. On 2026-07-27 Play Console
  verified the production track is active, latest release is `1.0.50 (57)`,
  status is `Available on Google Play`, released on Jul 22 at 8:51 PM, with
  177 countries/regions and 0 installs shown in that track summary. Managed
  publishing remains off.
- Android version code `73` is consumed. The next Android build must use code
  `74` or higher.
- Release `1.0.66 (73)` was promoted from internal testing to a 100% production
  rollout and became `Available on Google Play` on 2026-08-17 at 5:14 PM.
  Play showed 177 countries/regions and 10 installs on 2026-08-26.
- Latest tested local QA APK: `artifacts/readflow-qa-1.0.65-72.apk`
  (231,562,883 bytes; SHA-256
  `AED70B6DFB12AAAD2E578C2897A12D0AE4A4363B0EC51DD2A63544D80025F722`).
  It is installed as side-by-side package `com.urmiaworks.readflow.qa` on
  Samsung SM-G975F. No local candidate was sent to EAS or Google Play. Use
  Android code `73` or higher for the next local build attempt.
- A duplicate `1.0.28` / code `34` EAS build
  `46806d5f-aa25-4e9f-9031-5d3866824fe3` was started by a CLI timeout retry and
  also finished. Do not upload it as a separate release; it has the same code.

## 1.0.66 Subscription Release Gate - 2026-08-11

- RevenueCat CustomerInfo updates with no active entitlement are no longer
  ignored. The mobile app clears its SDK-tier guard and forces a backend
  entitlement/usage refresh, so an expired subscription does not remain shown
  as paid until restart.
- Restore now synchronizes both active and inactive CustomerInfo before showing
  its result. The release checker guards the inactive/expiry path.
- Play production was verified active at `1.0.50 (57)`, the internal track was
  verified active at `1.0.29 (35)`, all six subscriptions had one active base
  plan, backend health passed, and a random non-buyer resolved as
  `source: revenuecat`, `tier: free`.
- EAS build `4ee76bca-814b-4a79-8acf-e5c9881002a7` finished. Local AAB:
  `artifacts/readflow-1.0.66-73-internal.aab` (151,501,398 bytes; SHA-256
  `335964023DCD72DEE5A881DC0111EDFDDF5DB51334444FEF41FB2D895625BB03`).
  Play accepted it and made release `1.0.66 (73) internal QA` available to the
  configured internal testers on Aug 11.
- The connected SM-G975F showed the internal-beta Update button, but Play
  refused the update with certificate mismatch because its old `1.0.28 (34)`
  package was installed with a different signing certificate. Replacing that
  old package requires an uninstall that may erase its local library; do not do
  that without owner confirmation. The side-by-side QA package and its books
  are unaffected.
- Production promotion completed on 2026-08-17. Sandbox
  purchase/restore/expiry monitoring remains a post-rollout check.

## 1.0.65 Running Furniture and Title-Break QA - 2026-08-11

- General edge-pattern detection now groups alternating Arabic/Roman page
  labels, tolerates damaged closing glyphs, and removes OCR-damaged labels only
  when they match independently observed numbered running furniture.
- Genuine isolated or typography-marked titles remain structural breaks. Broad
  legacy guesses no longer turn body lines beginning with `Appendix`, `Book`,
  `Introduction`, or a Walk name into headings.
- Parsed-text cache schema `5` forces older ambiguous extracts to refresh.
  Text-heavy scanned chapter openings now use clean reflow; photos, captions,
  covers, tables, diagrams, sparse image pages, and illustrated author pages
  keep their source layout.
- A full 283-page Rousseau extraction/reflow audit retained the genuine
  `PREFACE`, ten Walk openings, `INTERPRETATIVE ESSAY`, and `APPENDIX A/B`,
  removed running headers/page labels, and suppressed the multi-page Notes
  blocks. Automated reader/release checks, mobile TypeScript, backend build,
  and the local Android release build passed.
- On Samsung SM-G975F, page 9 began with `editions of Spink...` and contained
  no `x Preface`; page 19 displayed `FIRST WALK` as a separate reflow heading
  without its printed footer/page number. No fatal Android or React error was
  observed. Commits: `fce9ebe`, `881ca6c`. Before tag:
  `readflow-before-running-furniture-title-breaks-local-1.0.64-20260811`.
  No public release was performed.

## 1.0.62 Reader Runtime QA / 1.0.63 Pending Build - 2026-08-11

- Fresh Persian import/open no longer ANRs. Long extracted page paragraphs use
  bounded tap spans, and Extreme Ownership page 59/60 scrolling produced zero
  span, skipped-frame, ANR, or fatal warnings on `1.0.62 (69)`.
- The header followed the measured viewport center from page 59 to page 60.
  Direction-aware window expansion prevented forward scrolling from prepending
  older pages.
- One uninterrupted rF AI session ran for more than ten minutes, advanced from
  page 60 to page 64 at media speed 1.0, survived Follow off/on, and stopped
  cleanly. No `rF AI paused`, AudioTrack `-12/-20`, ANR, or fatal error occurred.
- Rousseau opened Original on reflow page 4 without crashing, but returning to
  Reflow landed on page 6. Source `1.0.63 (70)` resets measured cells and scroll
  state whenever a reader generation/page jump is rebuilt; automated checks
  pass, but a final APK/device retest is pending the next build.
- Relevant commits: `087ddb1`, `b4b55b1`, `7487b63`, `7e8fdfd`, `6d9dfa7`,
  `9062197`, `19e7b82`, and `2d8b5ca`. No public release was performed.

## 1.0.55 General Text-Fidelity Candidate - 2026-08-11

This local candidate fixes general failures found by comparing all 2,718 pages
of the nine real-book fixtures against their source PDFs:

- A three-asterisk scene divider no longer starts a footnote block. Prose sharing
  its extracted line remains, including the affected Extreme Ownership and
  World as Will pages.
- A trailing inline asterisk no longer removes the rest of a page. A true footer
  line that begins with an asterisk is still omitted.
- Multi-page note suppression resumes at a strong new section such as
  `INTERPRETATIVE ESSAY`, not only at numbered chapter/walk markers.
- Native PDF extraction returns an optional, backward-compatible
  `footnoteStartLine` only when page geometry shows a repeated small citation
  marker near the bottom followed by smaller note text. The mobile app removes
  that suffix from Reflow/speech; released clients ignore the extra field, OCR
  clears it, and Original mode remains exact.

Verification completed before phone installation:

- All nine real books (2,718 pages) were extracted and reflowed. No reflow row
  was empty outside intentional multi-page note suppression. Previously missing
  body prose improved in Confessions (page 615), Extreme Ownership scene-break
  pages, Rousseau pages 162-170, and World as Will scene-break pages.
- Visual renders confirmed the source layout on Persian page 73, Rousseau pages
  26 and 30, and Extreme Ownership page 59. The lower Persian retention score
  reflects removal of real numbered footer notes; sampled boundaries retain the
  body above them.
- Backend build, mobile TypeScript, release checks, reader regressions, and a
  clean local Android release build passed. A live 182-page Persian import
  verified the deployed backend returns the page-73 boundary at the visual
  footer start.
- Source commit: `db6bad3`. Before tag:
  `readflow-before-general-text-fidelity-local-1.0.55-20260811`.
- Connected-phone installation and runtime checks are pending ADB reconnection.
  No EAS build, Play upload, rollout, or public app release was performed.

## 1.0.54 Local Reader Recovery and Note-Cleanup Candidate - 2026-08-11

This local candidate addresses the owner's latest reader failures and deferred
reader-quality items without changing production:

- Turning Follow back on clears stale manual-scroll state and immediately
  reanchors to the spoken line. A failed local rF AI provider is disposed and
  recreated before Play retries, so playback no longer requires an app restart.
- Original and Reflow keep separate positions. Entering Original opens the
  current source page; returning resolves the same page-relative sentence.
  Native PDF surfaces remain mounted across switches, preventing the Android
  PDF-renderer teardown race (`Get page pdf document null`).
- Reader Settings now exposes persistent System, Light, and Dark controls.
  Retained visual PDF pages are isolated from theme-driven rerenders.
- Explicit NOTES, FOOTNOTES, and ENDNOTES sections are removed from Reflow and
  speech across page boundaries until a strong chapter/book/walk heading.
  Numbered ordinary body prose remains intact; Original still preserves the
  complete source pages.

Verification:

- The real 283-page Rousseau PDF produced 660 reflow rows; First Walk and
  Second Walk body text remained, while sampled editorial notes and the NOTES
  heading were absent.
- On Samsung SM-G975F, Rousseau stayed on page 3 through two complete
  Original/Reflow cycles with no crash. System -> Light -> System worked while
  an inline source page remained visible.
- rF AI remained in Pause/playing state after Follow off/on, produced no `rF AI
  paused` notice or fatal log, and Stop returned the control to Play without an
  app restart.
- Mobile TypeScript, release checks, reader regressions, backend build, and the
  clean local Android release build passed. No EAS build, Play upload, backend
  deployment, or public release was performed.
- Before tag: `readflow-before-reader-recovery-notes-local-1.0.54-20260811`.
- After tag: `readflow-after-reader-recovery-notes-local-1.0.54-20260811`.

## 1.0.53 Local Visual-Page and Import-Quality Candidate - 2026-08-05

This local candidate keeps figures, photo captions, sparse covers/title pages,
compact tables, and diagram-like pages in Reflow by rendering the exact retained
source PDF page inline. Dense prose continues through normal text reflow. A
local deterministic classifier handles already-cached books without cloud AI,
OCR, re-import, or vendor cost; corrupted visual text and photo furniture are
excluded from speech while short valid prose remains speakable.

The backend now also detects raster paint operators for text-sparse pages and
returns a backward-compatible `hasRasterImage` hint. Real extraction found the
exact 22 raster pages in the 288-page `Extreme Ownership` fixture, including
pages 15, 30, 51, 92, 186, and author portraits on 282. This backend change was
verified locally only and has not been deployed.

Connected Samsung SM-G975F evidence:

- `1.0.53 (60)` installed over the QA package without clearing data and retained
  all four imported documents.
- Extreme Ownership pages 15 and 30 showed the complete source photos and
  captions inline; page 31 returned to ordinary reflow with no overlap.
- Rousseau page 1 showed the real cover/title instead of the garbled native text
  `Jean. -Jacques`, `Rousseau _`, and `| Solitary Walker`.
- Confessions page 1 showed the complete scanned cover instead of attempting to
  display its corrupt text layer.
- Backend build, mobile TypeScript, release checks, and reader regressions pass.
  No EAS build, Play upload, backend deploy, or public release was performed.
- Before tag: `readflow-before-visual-pages-import-quality-local-1.0.53-20260805`.
- After tag: `readflow-after-visual-pages-import-quality-local-1.0.53-20260805`.

## 1.0.52 Local rF AI Resource Hotfix - 2026-08-05

The connected Samsung reproduced a release-blocking rF AI failure in `1.0.51`:
continuous speech stopped after about 4 minutes 38 seconds and showed `rF AI
paused`. Logcat repeatedly reported `AudioTrack` initialization errors `-12`
and `-20`. `expo-audio` player removal did not synchronously release each native
ExoPlayer/AudioTrack, while the local provider created another player for every
short clip.

`1.0.52` keeps a bounded pool of two native players, alternates/replaces their
sources at clip handoff, and releases both only when the provider is disposed.
The source regression suite now prohibits more than one allocation site and
pins the two-player cap and outgoing-player recycling.

Connected Samsung SM-G975F evidence:

- The side-by-side `1.0.52 (59)` APK retained all four imported documents.
- A microphone-recorded rF AI run stayed active for 10 minutes, advanced
  `Extreme Ownership` from page 4 through page 13, and kept both Android audio
  services foreground. Screenshots at minutes 1, 5, and 10 showed page/highlight
  progress; there was no rF AI warning, crash, or `AudioTrack` `-12`/`-20` error.
- Speech was present through the old failure boundary. A phone `Slow charging`
  system dialog appeared during the latter part of the run, but page/highlight
  progression and both foreground services continued behind it.
- Stop changed the control to Play; restart changed it back to Pause and advanced
  from page 13 to page 14 during another 60-second run with zero matching errors.
- This is a local QA build only. No EAS build, Play upload, rollout, or public
  release was performed.
- Before tag: `readflow-before-audiotrack-resource-fix-local-1.0.52-20260805`.
  After tag: `readflow-after-audiotrack-resource-fix-local-1.0.52-20260805`.

## 1.0.51 Local QA Candidate - 2026-08-05

This candidate addresses the collected owner/reviewer feedback without a
public release:

- RevenueCat purchase state is applied immediately and a stale backend refresh
  cannot temporarily downgrade an active SDK entitlement.
- rF AI keeps one session speed, stops at the retained source position on local
  playback failure, and uses a watchdog instead of silently skipping forward.
- Eligible generated rF AI playback uses an Android media foreground service
  so clip scheduling continues while the phone is locked.
- Speech-only number handling covers years, eras, decades, currency, and
  academic references without rewriting the displayed source.
- Reflow removes repeated edge headers, footers, Roman/digit page labels, and
  OCR-damaged short furniture more conservatively.
- PDF readers have an Original/Reflow switch. Original preserves tables,
  figures, covers, and scanned pages and can navigate them without invoking OCR
  or a subscription gate.
- Appearance defaults to the phone setting and persists explicit System, Light,
  or Dark selection.
- Saved-page restoration no longer prepends earlier variable-height rows during
  initial layout, which shifted a stored page 8 back to page 4 on the Samsung
  test phone. Shelf title/action layouts were also corrected for the same phone.

Connected Samsung SM-G975F evidence:

- A 61-second locked/dozing run continued through at least seven newly-created
  rF AI clips. The background and media services remained foreground.
- A second 118-second foreground run on Rousseau page 58 produced 27 clip
  starts with no crash, watchdog notice, or stalled Play state.
- A fresh page-8 Last read save reopened at page 8 and the same sentence after
  a clean exit. Original mode rendered Rousseau page 10 and Confessions pages
  1-5; scanned-page Next no longer opened the OCR paywall.
- Light persisted across force-stop/relaunch; System returned to the phone's
  dark appearance. OCR gating correctly kept Reviewer out of paid OCR.
- A Google Play sandbox AI Pro Yearly purchase on the installed production
  `1.0.28 (34)` package reproduced the transient post-purchase paywall, then
  showed AI Pro after force-stop/relaunch. Google explicitly showed a test card
  and no charge. The `1.0.51` immediate-entitlement repair is covered by source
  checks, but live Billing cannot run in the side-by-side `.qa` package.
- Confessions has a corrupted legacy native text layer. Original mode is usable;
  an AI Pro/Power OCR rebuild is still required for clean reflow. Local OCR
  comparisons showed strong improvement on pages 5, 8, and 13, while the
  decorative cover remained unreliable.
- During the initial `1.0.51` session this environment had no working microphone
  capture. Later USB microphone capture reproduced the four-minute resource
  exhaustion above and supplied the `1.0.52` before/after evidence.

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
has unlimited supported native-text reading and 30 downloaded rF AI minutes/day,
with no OCR, text AI, or Cloud AI allowance. AI Pro and Power have unlimited
downloaded rF AI. The 2026-07-22 commercial rebalance reduces AI Pro Cloud AI
voice to 20,000 characters/month and changes Power to $19.99/month or
  $179.99/year with 2,500 OCR pages, 400 AI actions, and 100,000 Cloud AI voice
  characters/month. AI Pro is $10.99/month or $119.99/year. The matching
  Google Play base-plan prices must be verified for the 1.0.50 release; Power
  pricing was saved on
  2026-07-22; Google recalculated the regional prices for new subscribers.

The operational quality, language, document-limit, monitoring, subscription,
and promotion source of truth is `QUALITY_SUPPORT_AND_RISK_REGISTER.md`.

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

## 1.0.31 rF AI Articulation Candidate

The tracked source is now `1.0.31 (37)`. Ordinary rF AI synthesis chunks stop
at a sentence boundary before exceeding 300 characters, down from 420. The
smaller request is intended to reduce flattened stress and swallowed quiet
words while preserving the existing prefetch/player handoff. A grammatical
sentence that continues across a PDF page still uses its separate 760-character
safety cap so the page turn does not split the sentence. Generated local audio
uses cache version `ss0.23`, and the automated reader gate verifies that an
over-limit second sentence remains queued instead of being lost. Audible phone
QA is still required before production promotion.

On 2026-07-21 the standalone QA APK was built from this source and installed
over `com.urmiaworks.readflow.qa` on the connected Samsung SM-S918B. Android
reported `1.0.31 (37)`, the retained 133-page book reopened on page 42, rF AI
entered media state `PLAYING`, and the active-line highlight advanced without
AndroidRuntime or ReactNativeJS fatal errors. Playback was stopped with the
app's Stop control after the smoke check. The preserved QA artifact is
`artifacts/readflow-qa-1.0.31-37.apk` (SHA-256
`A3BA29DAA01B987A7CD37BC73CF18DFEBAD64265BBC8573ADEF59FC6B8A5905A`).
This verifies installation and playback mechanics, not subjective articulation;
the owner still needs to listen for small-word retention and acceptable gaps.

## 1.0.32 rF AI Handoff Candidate

The 300-character experiment in `1.0.31 (37)` made chunk transitions frequent
enough for an audible handoff glitch to become objectionable. Source
`1.0.32 (38)` therefore combines complete sentences up to 500 characters while
retaining sentence-boundary splitting, the existing six-chunk prefetch, and the
separate 760-character page-continuation cap. It deliberately does not use an
overlapping sliding speech window: the current batch engine cannot reuse hidden
context or trim regenerated overlap at exact phoneme boundaries without repeat,
skip, and tone-discontinuity risk. Generated local audio uses cache version
`ss0.24`. Automated fixtures cover both sides of the limit so a following
sentence is combined only when it fits and is never discarded when it does not.

Automated release, TypeScript, exact manuscript regression, and backend build
checks pass. Human QA is still required on the unlocked Samsung: verify page 43
renders `Loyalty that refuses` as a separate heading and says `Title` before it;
verify `emperors, and people inside` retains `and`; and verify page 42 says the
complete phrase `must not become innocence`. Do not promote this candidate
until those three audible checks pass.

On 2026-07-21 the standalone QA APK was built from `1.0.32 (38)` and installed
over `com.urmiaworks.readflow.qa` on the connected Samsung SM-S918B while
preserving app data. Android reported the expected version, and the retained
133-page book reopened on page 44. rF AI entered media state `PLAYING`, its
active-line highlight advanced through the page, and focused AndroidRuntime and
ReactNativeJS logs contained no fatal errors. Playback was stopped with the
app's Stop control. The preserved APK is
`artifacts/readflow-qa-1.0.32-38.apk` (215,196,776 bytes; SHA-256
`5C634E82B9E545441D9E85F14F69DFDA2C334E2C918A4D877D048F9AA04DC04E`).
This confirms installation and playback mechanics; the three subjective audible
checks above still require the owner to listen.

## 1.0.33 Paragraph Audio Candidate

Owner listening to `1.0.32 (38)` found that the flattened adjacent citations
`1`, `10`, and `13` were spoken as the number `11013`, and reported many skipped
small words plus an apparent decline after several minutes. The citation parser
previously accepted only one-to-three digits after punctuation, so the five-digit
flattened run escaped speech cleanup. It now recognizes a bounded complete digit
run after punctuation; source-offset mapping keeps it visible as a superscript
but removes it before every voice engine. The automated regression uses the exact
page-44 phrase ending in `widened.11013`.

Source `1.0.33 (39)` retains native PDF paragraph identity and sends one complete
source paragraph to rF AI as one WAV. This removes Expo Audio/player replacement
between sentences inside a paragraph. It does not concatenate unrelated
paragraphs or cut a grammatical sentence at the old 500-character limit. Sherpa
still performs its own bounded sentence-group generation inside the single WAV,
and an unfinished sentence at a PDF page boundary keeps the existing 760-character
safety rule. Generated local audio uses cache version `ss0.25`.

There is no elapsed-listening text buffer or rolling context in the local provider:
each paragraph request is normalized and synthesized independently, future WAVs
are generated through one serialized prefetch queue, and completed files are
cached by model, render version, speed, and exact text. Therefore a genuine
progressive decline is not explained by an overflowing reading buffer. It can be
content-dependent Supertonic 2 alignment error, phone thermal slowdown producing
larger pauses, or cumulative perception of independent errors. Refreshing the
engine during reading was deliberately not added without evidence because it
would introduce cold-start gaps and native resource churn.

The manuscript itself contains the exact phrase `the later leaders who honored
refusal` in chapter 4, so hearing `the later leaders` on page 45 is not an inserted
word. Human QA is still required for paragraph transitions and small-word
retention before this candidate is promoted.

On 2026-07-21 the standalone QA APK was built and installed over
`com.urmiaworks.readflow.qa` on Samsung SM-S918B with its data preserved.
Android reported `1.0.33 (39)`, and the retained 133-page book reopened on page
44 with `11013` displayed as a superscript marker. rF AI entered media state
`PLAYING`; the first paragraph was exposed to Android as one approximately
59.4-second clip, then playback advanced to the next paragraph as one
approximately 89.5-second clip. The active-line highlight continued to advance,
focused AndroidRuntime/ReactNativeJS logs contained no fatal errors, and the
app's Stop control removed the media session. The preserved APK is
`artifacts/readflow-qa-1.0.33-39.apk` (215,196,832 bytes; SHA-256
`422F117D55B8E1B583D5732B39CA0FFB40A62054B4AAC84F3AC92AAAD3CD156E`).
The exact speech-text regression proves `11013` is omitted before synthesis;
subjective audio quality and small-word retention still require owner listening.

## 1.0.34 Clean rF AI Reader Candidate

Source `1.0.34 (40)` replaces the accumulating phrase-specific repairs with a
clean reader pipeline. Android rF AI now uses Supertonic 3 model
`sherpa-onnx-supertonic-3-tts-int8-2026-05-11` and sherpa-onnx Android runtime
`1.13.2-1`; iOS deliberately remains on the tested Supertonic 2 model until a
matching iOS runtime is available and tested. The three old prose-specific
comma/semicolon substitutions were removed. Speech normalization now performs
only generic Unicode, typography, symbol, acronym, and title normalization.

Native PDF text is rendered as source paragraphs instead of a separate visual
row for every sentence. A normal paragraph becomes one audio clip. An
exceptionally long paragraph is divided around a 1,000-character soft limit,
but only after a complete sentence; a single over-limit sentence remains whole.
Continuation offsets remain anchored inside the same visible paragraph, and an
unfinished sentence crossing a PDF page is still synthesized continuously.
Generated local audio uses cache version `ss0.26`, so no Supertonic 2 WAV can
mask the new behavior.

The backend positioned-text renderer now emits a blank line only when the PDF's
vertical geometry indicates a real paragraph gap. `TextReflow` preserves those
paragraphs, and includes a conservative short-line fallback for already cached
native extracts made before the backend fix. The production book was checked
directly with both rendered pages and extracted text: page 44 contains `the
United States Army`, and page 45 contains `the later leaders`. Those phrases
must not be rewritten because they are the author's source text.

Automated checks reassemble a roughly 1,000-word paragraph from every generated
block and require exact word preservation, verify normal paragraph grouping,
long-single-sentence safety, page-boundary continuation, silent flattened
citations, clean prose normalization, the Supertonic 3 model id, and the native
runtime patch. Connected-phone installation and audible QA are recorded below
after the APK is built. The final QA APK is
`artifacts/readflow-qa-1.0.34-40.apk` (211,235,008 bytes; SHA-256
`4E63CF9C8CFE48D56BA14A2D7DE3D8010DDC272C3C698D89D46CD642B33A83C6`). It
installed successfully on the connected Samsung SM-S918B as `1.0.34 (40)` on
2026-07-21 while preserving the prior QA app data. Automated reader, TypeScript,
release-configuration, backend-build, and APK-install checks passed. Audible
Supertonic 3 and visual page-44/45 QA still require the owner to bring rF AI to
the foreground; the phone was in an active IMO video call at the smoke-test
point and the call was intentionally not interrupted.

## 1.0.35 Source-Identity Integrity Candidate

The follow-up audit found that legacy document ids used only `filename + page
count`. A revised PDF could therefore collide with an older edition having the
same name and page count, reuse its parsed-text/OCR cache, and retain the first
edition's private stored copy. This is a real source-integrity defect even when
the extractor itself returns the correct words.

New imports now calculate the selected file's MD5 in the native filesystem
without loading the whole book into JavaScript. The fingerprint is placed at
the front of an `rf2:` document id and propagates through the library, parsed
text cache, OCR pages, bookmarks, and stored source filename. Cached OCR is
merged only when the complete content-aware document id matches. Re-import the
latest PDF once after installing `1.0.35 (41)`; a revised same-name/same-length
file will then be stored and parsed as its own exact edition instead of opening
the legacy cache.

The final QA artifact is `artifacts/readflow-qa-1.0.35-41.apk` (211,236,272
bytes; SHA-256
`54A94BAEDF58F1444E0FF844324F6C056CF35C2E8777F16270B75C1B21BD0A11`). It
installed successfully over the connected QA package on Samsung SM-S918B as
`1.0.35 (41)` while retaining app data. The exact production PDF was copied to
`Downloads/Almost-the-Same-Human-verified-2026-07-21.pdf` for a fresh
content-aware import. That last import requires the owner to unlock the secure
lock screen; ADB cannot and must not bypass it.

After unlock, the production PDF already present as `Download/book.pdf` was
verified byte-for-byte against the PC source (MD5
`868C2CB8AE010313B910A44DDB53B068`) and imported again. The shelf created a
second `book` identity with reset progress rather than reusing the legacy
filename/page-count record. On-device inspection of the fresh entry at pages
44-45 showed the exact source paragraphs, including `The long return to My Lai`,
`the United States Army`, `The medal can be evidence of learning`, `treat that
praise as evidence`, `the later leaders`, and `who belonged to him`. The legacy
entry was deliberately retained so its reading history was not destroyed; the
top `Continue` entry is the verified import.

## 1.0.36 Missing Voice-Pack UX Candidate

The reader previously reused `UpgradeSheet` for two unrelated conditions:
commercial feature access and a missing on-device rF AI model. After the move
to Supertonic 3, an existing installation legitimately needed the new one-time
model download, but tapping Listen displayed the plans/registration page. This
looked like an account failure even though the model download itself requires
neither registration nor a subscription.

Every `localVoiceReady === false` and `local_unavailable` path now opens a
plain `ThemedNotice` explaining how to return to the shelf's Voice panel and
download rF AI. The plans sheet remains reserved for actual plan limits. The
Android Supertonic 3 pack was downloaded successfully on the connected Samsung
SM-S918B and the Voice panel reported `rF AI is ready` before this build.

The final QA artifact is `artifacts/readflow-qa-1.0.36-42.apk` (211,236,892
bytes; SHA-256
`4DC5834FF7321FACC27A8CECB732A37FF93CEDE774FD939EA1A10F9DD28C8B3A`). It
installed successfully over the connected QA package as `1.0.36 (42)` while
retaining the downloaded voice model and verified content-aware book import.
Automated regression, TypeScript, release-configuration, backend, manifest,
and final on-device playback results are recorded after the remaining checks.

## 1.0.38 Reader Source/Viewport Integrity Candidate

Nine annotated phone screenshots exposed shared pipeline defects rather than
phrase-specific rF AI problems. The source PDF proves that page 50 contains
normal 11-point `2024.` followed by a separate raised 5-point citation `11`;
the old extractor discarded size/baseline geometry and produced `2024.11`, so
mobile deliberately mistook it for a decimal and Supertonic spoke it. The same
geometry correctly identifies the raised `1` after `office.` on page 46.

Native extraction now converts only small, raised, horizontally adjacent digit
items into Unicode superscripts. Automated fixtures require `2024.¹¹`,
`office.¹`, and an unchanged real `2024.11` decimal. Existing cached extracts
also recognize the unambiguous legacy form `2024.11 This...`, so the installed
book is repaired immediately without re-importing while future imports retain
the PDF's actual geometry. The repair occurs at the canonical reflow boundary,
not only in the renderer: display, copy, speech/highlight mapping, and AI
context all receive `2024.¹¹`.

Follow mode now records each wrapped line's native Y/height and tracks that line
inside its paragraph. It re-anchors before the line reaches the bottom of the
live FlatList viewport, including when the settings panel changes height. This
keeps source paragraphs visually whole while preventing highlighted/read text
from moving below the controls. The floating AI/AI Pro overlay was removed and
is now an in-flow button in the fixed Prev/Next navigation strip.

Speech input no longer adds an invisible localized `Title` word; headings use
only their displayed source text, with a slightly slower delivery and a short
structural pause. Supertonic sentence silence increases from `0.2` to `0.35`,
and render-cache version `ss0.27` prevents older timing from masking the change.
Citation removal retains its exact source-offset map, so displayed text remains
authoritative for both speech and highlighting.

The QA artifact is `artifacts/readflow-qa-1.0.38-44.apk` (211,238,412 bytes;
SHA-256
`BFB8292603333327D611C20068AA3E33372979FA0E94C453B2308091EAB6E634`). It
installed over `com.urmiaworks.readflow.qa` on Samsung SM-S918B as `1.0.38
(44)` while retaining app data. Automated reader, TypeScript, backend,
release-config, APK manifest, exact-PDF rendering, and geometry extraction
checks passed. Live phone QA also passed the structural checks: playback starts
without a registration sheet, AI Pro no longer overlays prose, Follow keeps the
active wrapped line above the collapsed controls across paragraph and page
transitions, and the already-cached page-50 text now displays/accessibly exposes
`2024.¹¹` rather than `2024.11`. Media playback remained active with no fatal
Android or React Native errors on the immediately preceding 1.0.37 build; the
1.0.38-only canonical-data change passed automated coverage, and its installed
package/version were verified before the phone auto-locked. Final perceptual
judgment of voice stress and pause naturalness remains a human listening check;
no automated test can prove that subjective result.

## 1.0.40 Deterministic rF AI Timing And Play-Crash Fix

The reported spoken `dot` and inconsistent pauses were addressed at the shared
speech boundary, not with phrase-specific substitutions. A paragraph is now
split only at real terminal punctuation (`.`, `!`, `?`, `;`, and `:`), that
punctuation is never sent to Supertonic, generated edge silence is trimmed, and
fixed PCM silence is inserted between the resulting segments. Decimal points
remain in numbers, while abbreviations such as `U.S.` become spoken initials.
This preserves the displayed source text and its highlight mapping; only the
speech projection omits terminal marks and citation superscripts.

The first 1.0.39 candidate set Supertonic's engine-level silence scale to zero.
On the connected Samsung this caused a repeatable native `SIGSEGV` in
`OfflineTts_getSampleRate` as soon as Play initialized the engine. The 1.0.40
fix initializes the engine with the native-safe positive value `0.2`, while
individual punctuation-free generation calls still request zero model silence.
Regression checks pin both values so the unsafe engine configuration cannot be
reintroduced accidentally. Render cache `stitched0.2` invalidates audio made by
the earlier timing paths.

Multipart import errors now retain their quota code, HTTP status, and feature,
so the library opens the plan sheet when the monthly document allowance is
exhausted instead of showing a dead error and silently losing the selection.
The deleted QA book was restored locally from the unchanged phone Download copy
without clearing app data. A side-loaded QA package can display plan options but
cannot complete a real Play purchase unless its signing/install track and
RevenueCat entitlement are configured for Google Play billing.

The QA artifact is `artifacts/readflow-qa-1.0.40-46.apk` (211,241,820 bytes;
SHA-256
`A6F6ACE967380568D9F81B61B81DB508DABDDA621817B9AF8C2F317EF92D5D19`). It
installed over `com.urmiaworks.readflow.qa` as `1.0.40 (46)` while preserving
the restored book. Reader regression, TypeScript, and release-configuration
checks and the backend build passed. Live QA on Samsung SM-S918B opened the
retained `book.pdf` at page 46, started rF AI, changed the control from Play to
Pause, kept the app process alive, and left Android's native crash buffer empty.
Playback was stopped after the smoke test. Perceptual pause quality and absence
of a spoken `dot` remain human listening checks.

## 1.0.41 Authoritative Highlight Text And Heading Repair

Owner screenshots from page 47 showed that `Whoever owns the window` remained
body text and that `uncertainty` could disappear while its paragraph was active,
then return after playback advanced. The missing word was a renderer defect, not
a document or speech-buffer defect: the active row replaced the complete source
paragraph with separate line strings returned by Android `onTextLayout`, and a
native line report can omit text inside nested tappable/reference spans.

The reader now always renders the single complete canonical paragraph. Native
line results supply source ranges and Y/height metadata only; the corresponding
tokens receive the highlight in place. A gap-closing safeguard assigns every
source character to a measured range, so an incomplete native measurement can
neither hide prose nor leave it permanently unhighlighted. No second visual copy
of the paragraph is constructed during playback.

Heading recovery now looks through separator blank lines when examining the
previous and next prose. The exact page-47 structure requires `Whoever owns the
window` to be a heading while both adjacent paragraphs remain body text. The
citation audit also removed colon from the legacy flattened-reference fallback:
semantic digits in `John 3:16`, `12:30`, `4:2`, and `16:9` remain displayed and
spoken, while period/semicolon citation fixtures remain silent.

The QA artifact is `artifacts/readflow-qa-1.0.41-47.apk` (211,241,472 bytes;
SHA-256
`F5D20441D785C05C2132598F5CA4A56CA01E04BFECDB102777F86BD5557E5EF6`). It
installed over `com.urmiaworks.readflow.qa` as `1.0.41 (47)` without clearing
the retained book. Reader regression, TypeScript, release configuration,
backend build, APK manifest, and whitespace checks passed. The phone returned
to its secure PIN screen before the page-47 during-playback visual comparison;
that last connected-phone check requires the owner to unlock it.

## 1.0.42 Structural PDF Headings And Numeric rF AI Speech

The heading repair is no longer tied to a reported English phrase. Native PDF
extraction now infers the page's body typography and marks only short lines
that combine three independent layout signals: larger type, a dedicated
full-line font, and vertical separation from surrounding prose. The private
marker is removed at the mobile reflow boundary, so it can affect only the
row's structural `heading` kind and can never enter display, copy, AI context,
or speech. A complete audit of the owner's 133-page PDF found 131 legitimate
headings, including `Whoever owns the window` and `Measurement, ranking, and
the crowd`; ordinary italic and continuation lines no longer became headings.
The generic sentence-structure fallback remains for already cached extracts.

rF AI now receives generic English word forms for numeric glyphs before local
synthesis. Integers, grouped numbers, decimals, dates, ranges, ordinals,
percentages, scaled values, and dollar/pound/euro amounts are covered. The
reported real-book examples become `seven hundred forty three`, `seven point
four million`, `twenty three thousand four hundred twenty one`, and `one point
one two billion dollars`. This transformation is speech-only; the exact source
digits remain displayed and available to copy and AI.

The QA artifact is `artifacts/readflow-qa-1.0.42-48.apk` (211,248,384 bytes;
SHA-256
`267EEE7608EECC8ABC20670C64F2AFE0C24F6C46FD7671925AC94F706CA65A67`). APK
inspection verified `com.urmiaworks.readflow.qa`, `1.0.42 (48)`, the required
foreground audio permissions, and no recording permission. It installed with
`adb install -r`; Android retained the original first-install timestamp and the
existing 133-page book. On Samsung SM-S918B the book opened at its saved page,
page 48 displayed `Measurement, ranking, and the crowd` as a bold wrapping
heading, rF AI entered active playback without a native or JavaScript crash,
and playback was then paused. Reader regression, mobile/QA TypeScript, release
configuration, backend build, the real-PDF heading audit, and APK inspection
all passed. New imports receive the font-geometry marker after the matching
backend source is deployed; the installed build's fallback repairs the retained
pre-marker cache immediately.

## 1.0.43 QA Reviewer Import Entitlement Repair

The side-by-side QA app previously granted Reviewer access only inside the
mobile UI. Import requests still reached the backend without a server-verifiable
Reviewer signal, so RevenueCat resolved the tester as Free and rejected files
larger than 20 MB. Version `1.0.43 (49)` makes the QA contract explicit:

- only a separately packaged build with `expo.extra.qaReviewerMode=true` sends
  `x-readflow-qa-reviewer: 1`;
- only an internal backend with `ENTITLEMENTS_DEV_OVERRIDE=true` honors that
  marker, and it resolves directly to the cost-free `reviewer` tier before a
  RevenueCat lookup;
- tracked production `app.json` never enables the QA flag, and both public
  Render blueprints keep `ENTITLEMENTS_DEV_OVERRIDE=false`;
- internal blueprints default to `DEV_DEFAULT_TIER=reviewer`, not `ai_pro`, so
  QA cannot accidentally unlock OCR, text AI, or Cloud AI vendor spend.

Reviewer QA therefore has unlimited local library/rF AI use for practical
testing, up to the server's 200 MB absolute per-file safety cap and 5,000 pages
per document. OCR, text AI, and Cloud AI remain disabled. Automated release
checks pin both halves of this contract and fail if production configuration
can request the override.

The signed side-by-side artifact is
`artifacts/readflow-qa-1.0.43-49.apk` (211,248,420 bytes; SHA-256
`37C1D9FB3759CBFADD79D2329684A11E3E37934894F675D55CD69A010EB0393C`).
APK inspection verified package `com.urmiaworks.readflow.qa`, version
`1.0.43 (49)`, the required foreground-service permissions, and no recording
permission. It was installed in place on Samsung SM-S918B without clearing the
existing library and launched without an AndroidRuntime or ReactNativeJS crash.

For the current side-by-side tester cycle, the live Render service temporarily
uses `ENTITLEMENTS_DEV_OVERRIDE=true` with `DEV_DEFAULT_TIER=free`. This is a
deliberate narrow combination: a QA build carrying
`x-readflow-qa-reviewer: 1` resolves to Reviewer, while a normal RevenueCat
request and a request with no app-user id both remain Free. On 2026-07-22 the
three live probes returned, respectively, `reviewer/dev-override/200 MB`,
`free/revenuecat/20 MB`, and `free/dev-override/20 MB`; OCR, text AI, and Cloud
AI were false for Reviewer. A real 28,280,226-byte PDF (`nytt vedlegg.pdf`)
that previously exceeded the Free limit uploaded successfully with HTTP 200
and returned 124 extracted pages. Disable the temporary Render override after
the side-by-side QA cycle; public Play builds should use RevenueCat or the
signed reviewer-access flow instead of the QA marker.

## 1.0.44 Long-Book rF AI Memory And Heading Repair

A retained 712-page PDF exposed a pathological Contents paragraph containing
thousands of characters separated mostly by em dashes. Version `1.0.43 (49)`
queued several native Supertonic renders for it, reached about 2.30 GB total
PSS / 1.60 GB native heap, and left Stop/Back apparently frozen while queued
synthesis continued.

Version `1.0.44 (50)` bounds this path without shortening ordinary prose:

- rF AI prefetches one clip instead of six;
- every queued and in-flight render carries a cancellation epoch invalidated by
  Stop/Pause, so stale audio cannot be cached or played;
- leaving the reader or changing voice disposes the provider and calls the
  native engine's `destroy()`, preventing one model copy from accumulating per
  open/read/exit cycle;
- em-dash-separated Contents/index entries become natural local speech clauses;
- any remaining unbroken local request is losslessly split at a clause or word
  boundary at no more than 260 characters;
- headings with Roman numerals are normalized only at the speech boundary, so
  `BOOK I`, `CHAPTER IV`, `PART XII`, and standalone `III` are spoken as numeric
  headings while ordinary first-person `I` remains unchanged.

Connected-phone stress QA on Samsung SM-S918B used the exact retained Contents
page. The final installed build stabilized at about 494 MB total PSS after 20
seconds instead of growing past 2 GB, and Stop followed immediately by Back
returned to the shelf. A repeated open/read/exit test then reached about 568 MB
on the first session and 448 MB on the second; after pending native generation
returned and disposal completed, the process fell to about 267 MB rather than
stacking a second engine at roughly 823 MB. Direct tap-to-read on the visible
`BOOK II` heading entered rF AI playback, while automated speech-boundary tests
verify `BOOK I`/`BOOK II` are sent as `BOOK 1`/`BOOK 2` without changing their
displayed text. Focused logs contained no fatal exception, ANR, out-of-memory
error, or ReactNativeJS error.

The signed side-by-side artifact is
`artifacts/readflow-qa-1.0.44-50.apk` (211,252,232 bytes; SHA-256
`A9770926EA10C28E123EC918086FAD792E9DBAE513CF48FCE355E0092E8E1A9D`).
It is package `com.urmiaworks.readflow.qa` and was installed in place without
clearing the retained library or downloaded rF AI model.

## 1.0.45 Independent Speech Text Intelligence

Version `1.0.45 (51)` separates canonical displayed document text from the
mapped representation sent to Device, rF AI, or Cloud AI speech. The new
replaceable module lives under
`mobile/src/services/text-intelligence/`; its full contract and upgrade path
are documented in `TEXT_INTELLIGENCE_ARCHITECTURE.md`.

The offline pipeline combines safe deterministic normalization with a compact
multilingual contextual classifier. It uses nearby segments, source/layout
metadata, and generic Unicode/script features to interpret prose, headings,
dialogue, lists, tables, formulas, and suspicious artifacts. Output includes
boundaries, language/pronunciation metadata, pauses, emphasis, confidence,
fallback reason, and a character-level map to the unchanged visible source.
Reader look-ahead uses the module's bounded 96-entry cache and never analyzes a
whole book.

An optional backend endpoint exists for difficult AI Pro/Power cases, guarded
by the existing app key, AI entitlement, rate limit, cache, and monthly AI
quota. It is deliberately disabled in Reader until an explicit paid setting is
added. Normal offline reading, Free, and Reader Plus therefore do not call it.
Both client and server reject online output that omits, reorders, summarizes,
or invents lexical content.

This feature does not bundle a multilingual generative model and does not make
the English rF AI voice multilingual. It adds negligible app size. OCR language
data and actual TTS voice packs remain separate. Regression fixtures cover
Persian/Chinese scripts, mixed-language metadata, unfamiliar structures,
source-offset fidelity, heading-only Roman pronunciation, the exact `would
have` report, and rejection of unsafe online text.

The final signed side-by-side artifact is
`artifacts/readflow-qa-1.0.45-51.apk` (211,367,136 bytes; 201.58 MiB; SHA-256
`9D4905EBD2F0ED235EEBC4EF5F65CF1BB10D25E6B39277961CCE8EE43E2B5C1C`). It is
114,904 bytes (112.21 KiB) larger than `1.0.44 (50)`.

### 2026-07-22 Text-Intelligence Phone QA

The final `1.0.45 (51)` QA APK was installed in place on Samsung SM-S918B as
`com.urmiaworks.readflow.qa`, preserving its retained library and downloaded rF
AI pack. The app opened the retained 283-page Rousseau book at page 9. rF AI
entered playback, the coral highlight covered one current wrapped line, and it
remained anchored while the prepared speech advanced through the unchanged
displayed paragraph. Focused logcat contained no fatal exception, ANR,
ReactNativeJS error, or out-of-memory error.

The first Follow reposition briefly exposed an empty viewport before the
existing render window recovered. That behavior belongs to the reader scroll
system, not the text preparation mapping, and remains a phone regression item.
This session verified runtime playback and source-map highlighting, not audible
quality for every fixture. Before production, a person must still listen to an
unfamiliar heading, list, table/formula, mixed-language sample, and a complete
page-boundary sentence.

## 1.0.49 Naturalness And Responsive rF AI Candidate

Version `1.0.49 (55)` addresses the 2026-07-22 report that rF AI took too long
to begin after tapping text, paused for too long during reading, and sounded
cut into unnatural blocks.

The investigation found four generic pipeline problems rather than a corrupt
book:

- the 260-character safety guard was being applied to a complete paragraph,
  even when that paragraph had safe sentence punctuation;
- rF AI waited for the complete multi-sentence paragraph WAV before starting;
- Reader treated ordinary sentence pauses as structural paragraph pauses and
  could add a second delay after audio already contained one;
- the React Native Supertonic bridge discarded the JavaScript `extra.lang`
  generation metadata, so the model never received the explicit language hint.

Normal punctuated paragraphs now remain one logical reading and highlighting
unit up to the 1,000-character soft cap. rF AI queues punctuation-safe sentence
renders for the current paragraph first, begins playback when sentence one is
ready, and renders the following sentences while it speaks. The 260-character
guard remains only for a genuinely unbroken sentence. Each sentence WAV owns
one deterministic trailing pause; Reader adds separate delay only for a real
heading or another structural boundary. Text-relative progress keeps the
visible line mapped across the progressive audio tracks. Render cache version
`segments0.6` invalidates audio from both the old rhythm and the incomplete
language-hint candidate.

The installed `1.0.46` audio history gave a useful objective baseline: ordinary
sentence-track transitions arrived about 0.7-0.95 seconds after the prior track
stopped, with isolated gaps around 2.5 and 5.3 seconds when the next synthesis
was not ready. Version `1.0.48` began a ready next track 50 ms before the prior
track's padded tail ends instead of waiting for Expo's delayed completion event.
Long sentences may be rendered as meaning-preserving clauses only at a safe
comma (target 150 characters, minimum 55, maximum 190), with an 85 ms pause;
automated tests prove that the lexical token stream is unchanged. The local
engine also receives an explicit English language hint instead of relying on
automatic inference. The dependency patch routes that metadata through native
`generateWithConfig`; the regression gate verifies the bridge so reinstalling
dependencies cannot silently remove it. These changes affect only speech audio,
never displayed or copied book text.

Automated fidelity tests confirm that body preparation preserves the complete
reported page-58 paragraph containing `Ashoka`, `Iraq Inquiry`, `Britain`,
`United Nations`, and `Ukraine`, and the page-39 phrase containing `would have`.
The compact classifier no longer upgrades ordinary body prose to a heading
merely because it appears near a heading. The displayed text, copied text, AI
context, and saved positions remain the canonical source; only the speech
projection is transformed.

The English Supertonic pack still has one currently tested local speaker
(`sid 0`). Exact text retention does not guarantee that every uncommon name or
homograph will sound human. Do not add book-specific word substitutions. A
future pronunciation lexicon/model upgrade must remain replaceable and must
preserve source mapping. Final naturalness and proper-name pronunciation are
human-listening gates, not claims made by automated tests.

Connected-phone tracing of `1.0.48 (54)` measured about 3.4 seconds from a cold
tap to audio and about 1.2 seconds for the same cached passage. Eight consecutive
track boundaries had no multi-second synthesis stall, but most still spent
about 0.48-0.67 seconds between Android's stop and start events because Expo
created the next player only at handoff. `1.0.49 (55)` keeps memory bounded by
pre-creating exactly one standby player while the current segment plays, then
consumes that player at handoff. This changes player readiness, not text context,
segment size, or displayed content.

The signed side-by-side artifact is
`artifacts/readflow-qa-1.0.49-55.apk` (211,370,540 bytes; 201.58 MiB; SHA-256
`7FE00D41521064D0F62A490915087A535095A5E05C5DCB0DEA211054CA3794D9`). It is
package `com.urmiaworks.readflow.qa`, version `1.0.49 (55)`, has no microphone
permission, and was installed in place on Samsung SM-S918B while preserving the
retained library and rF AI model. Static release and fidelity gates pass.
Cold/warm tap-to-audio timing, five-sentence continuity, and human naturalness
remain connected-phone gates; ADB cannot bypass the phone's secure lock when it
engages during a long build.

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
set `expo.extra.qaReviewerMode=true`; it sends the internal QA marker and
receives the same cost-free Reviewer tier without a token only from a backend
whose development override is enabled. It must use
`com.urmiaworks.readflow.qa`, never the production package. Rotate both secrets
if the access code is shared outside the intended review group.

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
- `QUALITY_SUPPORT_AND_RISK_REGISTER.md`: language/document behavior, known
  limitations, monitoring, support triage, subscription tracing, and promotions.
- `MARKETING_PLAY_STORE.md`: Play/website marketing copy and claims limits.
- `PRIVACY_POLICY_DRAFT.md`, `TERMS_OF_USE_DRAFT.md`,
  `PLAY_DATA_SAFETY_DRAFT.md`: legal/app-content drafts.

## Current Follow-Ups

Owner's numbered priorities, independent text-intelligence layer, and
progressive rF AI playback are in the current `1.0.50 (57)` source. The
standalone reviewer build passed startup and progressive runtime playback.
These items remain for human audible/lifecycle verification before production:

1. Confirm Free/Reader Plus beta limits against the production backend after it
   is deployed.
2. Audibly confirm the page-39 `would have` sentence and page-58 proper names
   with a fresh `segments0.6` render.
3. Test AI Pro/Power lock, Home, notification controls, headset controls, and
   process recreation; also confirm Free/Reader Plus stop outside the app.
4. Measure cold and warm tap-to-audio latency, then listen through at least five
   consecutive sentences for generation starvation or a duplicated pause.

- Configure `REVIEWER_ACCESS_CODE` and `REVIEWER_TOKEN_SECRET` in Render, then
  add the code and navigation path to Play Console App access instructions.
- Production AAB `1.0.50 (57)` is available on Google Play. Monitor first
  production devices, Play Android Vitals, RevenueCat events, and tester
  purchase/restore results; the older
  `artifacts/readflow-1.0.29-35.aab` does not contain the final repairs.
- Finish license-tester purchase, restore, cancel, expiry, and entitlement tests.
- Improve over-limit UX so quota/file-too-long states open an upgrade prompt.
- Deploy the `1.0.30` canonical plan changes before relying on the revised Free
  and Reader Plus limits. Free-tier ads remain an undecided follow-up.
- Add a custom API domain instead of the confusing Render legacy subdomain.
- Commit or organize Play listing graphics from `pic/` if they should be kept.
- Build iOS only after App Store Connect products and RevenueCat iOS app setup.
- Monitor Render/OpenAI costs and keep AI/Cloud AI allowances within the cost
  model in `COST_MODEL.md`.
