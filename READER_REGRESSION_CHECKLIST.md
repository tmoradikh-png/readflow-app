# readFlow Reader Regression Checklist

Updated: 2026-08-05

This is the permanent reader/audio bug ledger. Every change to document
reflow, scrolling, saved position, bookmarks, voice, highlighting, lifecycle,
or entitlements must run the automated gate and then check the relevant phone
cases below. Do not delete resolved rows; regressions have previously returned
after unrelated reader changes.

## Automated Gate

From `mobile/`:

```powershell
npm run check:reader-regressions
npx tsc --noEmit
npm run check:release
```

`check:release` now includes the reader regression script. It verifies source-
paragraph layout, bounded long-paragraph continuity with exact word retention,
page-boundary sentence continuity, silent reference markers, clean speech
normalization, text-intelligence structure/fidelity/fallback behavior, Unicode
source mapping, progressive local-AI sentence playback, and the Android
Supertonic 3 runtime/model configuration.

## Permanent Regression Matrix

| ID | User-visible failure | Required behavior | Current implementation / test |
| --- | --- | --- | --- |
| RF-R01 | Opening or resuming visibly scrolls through many pages | Mount close to the saved page without animated travel | Stable page-relative start position and bounded render window; phone check required each candidate |
| RF-R02 | Last read opens at the wrong location or page 1 | Persist the visible page, sentence-within-page, and text preview on stop/back/background | `ReadingPosition` plus visible-anchor persistence |
| RF-R03 | Bookmark saves the audio row instead of the visible location, or cannot jump back | Save the visible anchor and jump directly | `Bookmarks`, `BookmarkPanel`, and direct window seed; test add/jump/delete |
| RF-R04 | Go to page lands on the wrong page or does nothing | Resolve the first stable sentence on the requested page; explain OCR-only pages | Reader direct page resolver and queued OCR jump |
| RF-R05 | Scrolling jumps backward, shakes, or gets stuck at a page boundary | Manual scrolling remains continuous and never expands the list by a large amount | Stable keys, bounded backward/forward expansion, no animated recovery |
| RF-R06 | Lock/unlock or rotation makes the reader race up and down | Preserve one anchor and perform at most one quiet restore | Layout signature and bounded restore logic; test lock, unlock, portrait, landscape |
| RF-R07 | Highlight is missing, one paragraph behind, or accumulates line by line | Exactly one rendered line is highlighted and it follows the audible text | Independent active-line rows plus source-offset mapping |
| RF-R08 | rF/Cloud voice omits the end of a paragraph | Let the audio finish and retain a tail guard before handoff | Provider tail guards; listen to the final five words of several chunks |
| RF-R09 | Long silence occurs between rF/Cloud chunks | Queue the current paragraph's safe sentences first, start as soon as sentence one is ready, then prefetch the next paragraph | Progressive rF AI generation/playback, provider cache, and reusable player; phone timing gate required |
| RF-R10 | Chapter/title looks or sounds like body text | Render a separate heading and read only its displayed words at a slower rate with a short trailing pause | Structured heading units and distinct typography; no invisible spoken cue |
| RF-R11 | A sentence split between PDF pages is read as two bad fragments | Keep the page divider visually but synthesize the unfinished sentence as one audio unit | `SpeechChunk` cross-page continuation; automated fixture covers pages 42-43 |
| RF-R12 | rF AI omits small words such as `would have`, `to`, `as`, or `evidence` | Preserve the exact speech text and use the model designed to reduce skip/repeat failures | Android Supertonic 3, clean normalization, exact page-39/page-58 chunk fidelity tests, explicit language metadata through native `generateWithConfig`, and render cache `segments0.6`; human listening remains required |
| RF-R13 | Footnote/reference numbers are body-sized or spoken | Display common markers as superscripts and remove them from every voice input, including adjacent citations flattened into one digit run | Reference marker/source-map pipeline; automated `communities.2` and `.11013` checks |
| RF-R14 | Voice reads page numbers, repeated headers, watermarks, or footnote blocks | Remove non-book boilerplate before rendering and speech | `stripNonReadingLines` and repeated-line detection; multilingual sample check |
| RF-R15 | Wrong voice silently substitutes Device voice | Show the selected engine, require its entitlement/model, and show an upgrade/download explanation | Voice panel gating and provider fallback notice |
| RF-R16 | Reading continues after leaving the app on Free/Reader Plus | Stop immediately outside the foreground | App-state gate remains mandatory for these tiers and Device voice |
| RF-R17 | AI Pro/Power or reviewer access stops on lock or app switch | rF AI and Cloud AI continue with lock-screen media controls | Conditional Expo background audio; test lock, Home, pause/resume, notification |
| RF-R18 | Screen turns off during active foreground reading | Keep the display awake while `isPlaying` is true | `expo-keep-awake`; verify on Samsung without the external ADB helper |
| RF-R19 | Purchased plan still displays Free | Refresh RevenueCat and bypass stale backend entitlement cache after purchase/restore | CustomerInfo listener and forced entitlement refresh/retry |
| RF-R20 | Free/Reader Plus accidentally incur OCR/OpenAI cost | Free: one native-text book, 300-page cap, 5 rF AI minutes/day. Reader Plus: native-text reading plus 30 downloaded rF AI minutes/day; no OCR/Cloud AI/text AI. AI Pro/Power rF AI is unlimited | Backend canonical plan and mobile fallback; exercise server gates |
| RF-R21 | OCR/fix can be launched repeatedly with no progress or stop control | One job per book with progress and pause/resume/stop | Global `OcrLoader` job state and controls |
| RF-R22 | Deleting a book intermittently fails | Stop related OCR work, remove cached/original files, then remove metadata | Library delete flow; test during idle and after OCR stop |
| RF-R23 | RTL/native text imports in the wrong order or with corrupt filler characters | Preserve logical RTL order and clean only known extraction artifacts | Backend multilingual extraction and `TextReflow` repairs; rerun Persian fixture |
| RF-R24 | Page-43 `Loyalty that refuses` is formatted and spoken as body text | Render it as a separate heading and read exactly those displayed words more slowly | Sentence-case heading recovery plus exact manuscript fixture |
| RF-R25 | rF AI omits `and` in `emperors, and people` | The conjunction must be clearly audible while displayed and synthesized prose stay unchanged | Supertonic 3 plus an assertion that reported prose receives no phrase-specific rewrite |
| RF-R26 | rF AI stutters or reduces words such as `become`, `his`, or `belonged` | Avoid repeated/omitted syllables without mutating individual phrases | Supertonic 3 replaces phrase patches; repeat-listening QA remains mandatory |
| RF-R27 | rF AI player handoffs between short chunks create audible glitches | Keep a paragraph as one logical reading/highlight unit while progressively playing punctuation-safe sentence WAVs with deterministic embedded pauses | Ordinary punctuated paragraphs remain intact up to the 1,000-character soft cap; 260 characters guards only a genuinely unbroken sentence |
| RF-R28 | A 1,000-word paragraph creates an unbounded native bridge payload or loses text | Use bounded grammatical clips and resume at an exact in-paragraph source offset | Automated multi-clip reassembly must reproduce every source word exactly; pathological unbroken local-AI requests use a lossless safety split |
| RF-R29 | Reflowed text looks far more fragmented than the source book | Render native PDF source paragraphs as wrapping paragraph blocks | Backend preserves geometry-derived paragraph gaps; `TextReflow` retains them and conservatively recovers older cached hard wraps; page-45 fixture must render exactly six source paragraphs |
| RF-R30 | Correct book wording is mistaken for TTS invention and patched away | Compare the rendered PDF, extracted text, and manuscript before changing prose | Page-44/45 source verification keeps `the United States Army` and `the later leaders` unchanged |
| RF-R31 | A revised PDF reuses text from an older file with the same name and page count | Key the library, parsed-text cache, OCR pages, and bookmarks by a fingerprint of the selected file bytes | Import two same-name/same-page-count files with different content; they must receive different `rf2:md5-...` document ids and never merge cached OCR |
| RF-R32 | A missing rF AI voice pack opens the plans/registration page | Explain the one-time local download and return to Voice without suggesting registration or purchase | Reader uses `ThemedNotice` for `localVoiceReady === false`; automated source check forbids routing this setup state through the upgrade sheet |
| RF-R33 | Follow lets the highlighted line move below the visible reader and under the controls | Track the measured wrapped line inside its paragraph and re-anchor before it reaches the viewport edge | `keepActiveLineVisible` uses native line Y/height plus the live FlatList viewport; test long paragraphs with controls collapsed and expanded |
| RF-R34 | The floating AI/AI Pro launcher covers book words | Reader controls must never overlay prose | AI/AI Pro is an in-flow button in the fixed page-navigation strip; no reader FAB remains |
| RF-R35 | A raised citation after a number becomes normal text or is spoken as `dot/point eleven` | Preserve font-size/baseline superscript geometry, make legacy cached text canonical, and remove only the marker from speech | Backend converts raised 5-point items beside 11-point body text to Unicode superscripts; legacy `2024.11 This` is canonicalized for display/copy/speech/highlighting/AI context, with a true-decimal counterexample automated |
| RF-R36 | The voice says words that are not displayed | Speech input must be a mapped projection of visible source prose, except that displayed citation markers remain intentionally silent | Invisible `Title` cue removed; chunk text and source-offset map are the single speech source |
| RF-R37 | rF AI says `dot` or applies irregular model-controlled sentence gaps | Never send true terminal punctuation to Supertonic; append one deterministic PCM pause to each punctuation-safe segment without adding a second Reader pause | `buildLocalSpeechSegments` retains decimals/abbreviations, removes terminal marks, and emits fixed period/question/semicolon/colon durations; exact fixtures cover the reported page-46 prose |
| RF-R38 | Pressing Play crashes Android while rF AI initializes | Construct the native TTS engine with a valid positive silence scale, even though segment generation uses no model silence | Engine scale `0.2` and segment scale `0` are pinned by source regression checks; each QA candidate must start Play with an empty native crash buffer |
| RF-R39 | Words disappear from a paragraph while its active line is highlighted, then return later | The displayed paragraph must always come from its complete canonical source text | Android line measurements provide highlight ranges only; the renderer decorates tokens inside the single authoritative paragraph and never reconstructs visible prose from native line fragments |
| RF-R40 | An isolated sentence-case title surrounded by blank lines renders as ordinary body text | Look through separator blank lines when evaluating the neighboring prose and retain the isolated title as a heading | Exact page-47 fixture requires `Whoever owns the window` to be a heading while both adjacent paragraphs remain body text |
| RF-R41 | Verse, time, ratio, schedule, or score numbers after a colon disappear or become silent as citations | A colon followed by digits is semantic content, not a flattened footnote marker | Citation fallback excludes colons; fixtures preserve and speak `John 3:16`, `12:30`, `4:2`, and `16:9` exactly |
| RF-R42 | A real PDF title such as `Measurement, ranking, and the crowd` renders as body text | Detect headings from the PDF's typography and layout, independent of a particular title's wording or punctuation | Backend requires larger size, a dedicated full-line font, and vertical separation; real-book audit covers all 133 pages and an italic-body counterexample prevents false headings |
| RF-R43 | rF AI misreads or skips 3+ digit values and currency such as `$1.12 billion` | Convert English numeric glyphs into unambiguous words only at the local speech boundary | Generic speech-only normalization covers integers, grouped values, decimals, years, ordinals, ranges, percentages, scaled quantities, and `$`/`£`/`€`; displayed/copy/AI source text remains exact |
| RF-R44 | QA Reviewer sees the Free 20 MB import limit | A side-by-side QA build must receive the backend Reviewer tier for imports without unlocking vendor-cost features | Passed API gate 2026-07-22: QA marker returned Reviewer/200 MB and a real 27 MB, 124-page PDF extracted with HTTP 200; normal and missing-id probes stayed Free; connected-phone picker confirmation remains the final UI gate |
| RF-R45 | A newly imported long book cannot start rF AI and Back/Stop leave the reader hung | Keep local synthesis memory bounded, invalidate every queued render on Stop, and destroy the native engine when leaving the reader | rF AI prefetches only one clip, queued work carries a cancellation epoch, em-dash contents entries become short clauses, remaining unbroken requests are capped at 260 characters, and repeated open/read/exit cycles must release rather than stack Supertonic engines; phone gate uses the retained 712-page book |
| RF-R46 | A compact heading such as `BOOK I` is skipped or pronounced as letters | Recognize broad structural heading forms and make Roman numbering unambiguous without rewriting body prose | Typography markers plus multilingual heading patterns and short isolated-line recovery; heading-only speech normalization covers marker-plus-Roman and standalone Roman forms |
| RF-R47 | Every newly discovered book format requires another phrase-specific voice patch | Interpret each short speech segment from its layout, neighboring context, script, and structural features | Independent hybrid text-intelligence engine plus compact multilingual contextual classifier; unfamiliar list/table/dialogue/formula fixtures are permanent |
| RF-R48 | Improving pronunciation changes displayed text or breaks highlighting | Keep the canonical displayed book unchanged and map every prepared speech character to its source offset | `SpeakableText.sourceOffsets`; tests cover Roman heading expansion, list-marker removal, table separators, and exact display-source retention |
| RF-R49 | Ambiguous text silently triggers paid AI or an online rewrite drops words | Offline preparation remains the default; online fallback is explicit, entitled, capped, and fidelity-checked | Reader pins `allowOnlineFallback:false`; mobile and backend reject output that changes lexical token order/content |
| RF-R50 | A multilingual preparation feature is mistaken for multilingual OCR or rF voices | Handle structure across Unicode scripts without claiming unsupported extraction or pronunciation | Script/language metadata is universal; OCR packs and TTS voice-language support remain separate product capabilities |
| RF-R51 | Tapping text takes many seconds to speak, or rF AI stalls mid-paragraph | Begin playback after the first safe sentence is synthesized and render the remaining sentences during playback | Progressive `segments0.6` pipeline; safe long-comma clauses shorten synthesis starvation, one bounded standby player removes player creation from handoff, and source checks pin text fidelity/progress; measure cold and warm tap latency on every phone candidate |
| RF-R52 | rF AI silently stops while Listen still appears active, or skips the next block after an audio failure | Detect missing playback progress and stop at the retained source offset with an explicit retry notice | Local playback watchdog plus Reader source checks prohibit local-error auto-advance; connected-phone QA must leave the highlight and resume point at the interrupted words |
| RF-R53 | A paid subscriber repeatedly sees purchase prompts or temporarily appears Free | Apply an active RevenueCat tier immediately and never let a stale backend response downgrade it | Client tier snapshots mirror backend limits, current/lower plan purchases are disabled, and backend refresh continues for vendor-cost enforcement |
| RF-R54 | OCR/native imports mix running headers, footers, and page labels into body prose | Remove repeated furniture only from the first/last three nonblank page lines, including changing digit/Roman patterns | Four-page regression fixture removes `Rousseau - Reveries 7` and `Preface vii` patterns while retaining body numbers and `BOOK VII` |
| RF-R55 | Tables and figures disappear in reflow view | Keep the stored source PDF available as an Original/Reflow reader mode; original visuals are never sent to speech | Source check pins the native PDF viewer and disables listening controls in Original mode; test a figure and table on the connected phone |
| RF-R56 | App remains light on a dark phone or offers no appearance override | Default to system appearance and persist explicit System/Light/Dark selection | Theme context updates all main UI surfaces and status bars; test live system switching plus both overrides |
| RF-R57 | rF AI finishes one clip after phone lock and then stops because JavaScript is suspended | Keep the generated-audio scheduler alive with an Android media-playback foreground service for eligible playback only | Source checks pin the service type and Reader lifecycle; lock the connected phone and verify at least five clip handoffs before unlocking |
| RF-R58 | Reopening a saved location jumps several pages backward | Restore the saved page and sentence before allowing backward window expansion | Earlier-page prep starts only after a deliberate user scroll; connected-phone force-stop/reopen retained page 8 and the same sentence |
| RF-R59 | Next/Previous in Original mode opens an OCR upgrade gate on scanned pages | Original-mode navigation must move directly through source PDF pages without text extraction or OCR | Connected-phone test navigated scanned `Confessions` pages 1-5 and rendered page 5 without a paywall |
| RF-R60 | rF AI stops after several minutes with `AudioTrack` `-12`/`-20` errors | Reuse a bounded pair of native players instead of allocating one ExoPlayer/AudioTrack per short clip | Source checks pin one allocation site, a two-player cap, outgoing-player recycling, and disposal release; connected-phone gate requires 10 minutes without the warning or error signatures |
| RF-R61 | Photos, covers, charts, or tables disappear in Reflow, while corrupted cover text is displayed or spoken | Render the exact retained source PDF page inline for visual layouts, keep dense prose reflowed, and silence only corrupt/visual furniture | Local classifier handles cached books; backend raster hint handles future imports. Fixtures cover captions, tables, short prose, corrupted covers, mixed portrait/prose, and speech skipping; phone checks passed on Extreme pages 15/30, Rousseau page 1, and Confessions page 1 |

## Connected-Phone Candidate Gate

1. Install exactly one QA package and confirm its version under App info.
2. Open the retained long book directly near page 39 without visible travel.
3. Scroll page 38 to 43 in both directions. Watch for bounce, blocked boundaries,
   or a jump to an earlier page.
4. Add a bookmark at the visible location, move away, jump back, force-stop,
   reopen, and verify Last read.
5. Start rF AI before page 39. Confirm one-line highlighting and audibly verify
   `dependence would have been difficult to escape`.
6. Continue across an unfinished sentence at a page boundary. It must sound like
   one sentence with no page-turn pause.
7. On page 43, verify `Loyalty that refuses` has heading typography, starts on
   its own line, and is read without any extra word before it.
8. On page 43, verify the complete phrase `emperors, and people inside` is
   audible. On page 42, verify `must not become innocence` includes all words
   and both syllables of `become`.
9. Confirm inline reference digits are raised and silent; page numbers and
   repeated headers must also stay silent.
10. On Free/Reader Plus, lock or leave the app and confirm audio stops. On AI Pro,
   Power, or reviewer access with rF/Cloud voice, confirm it continues and media
   controls appear.
11. Run one clean PDF, one scanned/OCR PDF, one DOCX, and one RTL PDF through
    import/open/delete before promoting the build.
12. In the side-by-side QA build, import a native-text PDF larger than 20 MB.
    It must be accepted as Reviewer (up to the 200 MB safety cap) without
    enabling OCR, text AI, or Cloud AI.
13. In the retained 712-page book, start rF AI on the long Contents paragraph,
    press Stop, and immediately press Back. The shelf must open promptly, the
    process must not continue allocating queued synthesis memory, and replay
    must still work after reopening the book. Repeat the open/read/exit cycle;
    native model memory must fall after pending generation returns instead of
    increasing by one full engine on every visit.
14. Read `BOOK I`, `CHAPTER IV`, a sentence-case title, and an ordinary sentence
   beginning with `I`. The headings must be distinct and complete; the body
   pronoun must remain unchanged.
15. Read an unfamiliar bullet list, a pipe-separated table row, dialogue, and a
   formula. Confirm pauses/structure are natural and no meaningful word is lost.
16. Read Persian or Arabic, Cyrillic, and CJK native-text samples with suitable
   Device voices. The displayed source must remain exact and the app must not
   imply that the English rF AI pack supports those languages.
17. During transformed speech (for example `BOOK II`), verify the highlighted
   line remains anchored to the visible source and does not drift.
18. Keep the phone offline and confirm normal preparation/playback works. No
   `/api/text-intelligence` request is allowed unless a future paid online
   fallback setting is explicitly enabled.
19. Stop playback, tap an uncached body sentence, and measure tap-to-audio for
    both a cold paragraph and an immediately repeated warm paragraph. Playback
    must start from sentence one rather than waiting for the complete paragraph.
20. Listen through at least five consecutive sentences in one long paragraph.
    There must be no unexplained mid-sentence silence or duplicated paragraph
    pause, and highlighting must remain one line aligned to the audible words.

Record the candidate, phone model, entitlement, document/page, and pass/fail in
`HANDOVER_CURRENT.md` after every release QA session.

Latest record: `1.0.53 (60)`, Samsung SM-G975F, QA Reviewer. The side-by-side
QA APK retained four imported books. Extreme Ownership pages 15 and 30 rendered
their source photos/captions inline; Rousseau page 1 rendered the real title
cover without exposing its garbled text layer; Confessions page 1 rendered its
scanned cover. Dense following pages remained ordinary reflow. The prior
`1.0.52` microphone-recorded rF AI run continued for 10 minutes, moved from
page 4 through page 13, kept both audio services
foreground, and produced no watchdog notice, crash, or `AudioTrack` `-12`/`-20`
error. A Stop/Play restart then advanced to page 14 for another 60 seconds with
zero matching errors. A phone `Slow charging` system dialog covered the reader
during the latter part of the long run, but page/highlight progression and both
foreground services continued. The earlier `1.0.51` lock, saved-position,
Original/Reflow, theme, OCR-gating, and four-book retention checks remain valid.
The purchase-state fix still needs an internal Play build because the `.qa`
package cannot use production Google Billing. Automated transcription confirmed
speech through the old 4:38 failure boundary; final pronunciation/timbre remains
an owner listening judgment.
