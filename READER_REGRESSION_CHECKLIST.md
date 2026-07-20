# readFlow Reader Regression Checklist

Updated: 2026-07-21

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

`check:release` now includes the reader regression script. It verifies page-
boundary sentence continuity, completed-page separation, silent reference
markers, and the rF AI auxiliary-word repair.

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
| RF-R09 | Long silence occurs between rF/Cloud chunks | Prefetch upcoming chunks and reuse the player | Provider prefetch/cache and reusable players |
| RF-R10 | Chapter/title looks or sounds like body text | Render a separate heading and announce localized `Title` more slowly before body text | Structured heading units, distinct typography, title cue and pause |
| RF-R11 | A sentence split between PDF pages is read as two bad fragments | Keep the page divider visually but synthesize the unfinished sentence as one audio unit | `SpeechChunk` cross-page continuation; automated fixture covers pages 42-43 |
| RF-R12 | rF AI makes `would have` inaudible in the page-39 sentence | Both words must be clearly audible | Local normalization adds a light articulation pause and render cache is versioned `ss0.22` |
| RF-R13 | Footnote/reference numbers are body-sized or spoken | Display common markers as superscripts and remove them from every voice input | Reference marker/source-map pipeline; automated `communities.2` check |
| RF-R14 | Voice reads page numbers, repeated headers, watermarks, or footnote blocks | Remove non-book boilerplate before rendering and speech | `stripNonReadingLines` and repeated-line detection; multilingual sample check |
| RF-R15 | Wrong voice silently substitutes Device voice | Show the selected engine, require its entitlement/model, and show an upgrade/download explanation | Voice panel gating and provider fallback notice |
| RF-R16 | Reading continues after leaving the app on Free/Reader Plus | Stop immediately outside the foreground | App-state gate remains mandatory for these tiers and Device voice |
| RF-R17 | AI Pro/Power or reviewer access stops on lock or app switch | rF AI and Cloud AI continue with lock-screen media controls | Conditional Expo background audio; test lock, Home, pause/resume, notification |
| RF-R18 | Screen turns off during active foreground reading | Keep the display awake while `isPlaying` is true | `expo-keep-awake`; verify on Samsung without the external ADB helper |
| RF-R19 | Purchased plan still displays Free | Refresh RevenueCat and bypass stale backend entitlement cache after purchase/restore | CustomerInfo listener and forced entitlement refresh/retry |
| RF-R20 | Free/Reader Plus accidentally incur OCR/OpenAI cost | Free: one native-text book, 300-page cap, 5 rF AI minutes/day. Reader Plus: native-text reading plus unlimited downloaded rF AI during beta; no OCR/Cloud AI/text AI | Backend canonical plan and mobile fallback; exercise server gates |
| RF-R21 | OCR/fix can be launched repeatedly with no progress or stop control | One job per book with progress and pause/resume/stop | Global `OcrLoader` job state and controls |
| RF-R22 | Deleting a book intermittently fails | Stop related OCR work, remove cached/original files, then remove metadata | Library delete flow; test during idle and after OCR stop |
| RF-R23 | RTL/native text imports in the wrong order or with corrupt filler characters | Preserve logical RTL order and clean only known extraction artifacts | Backend multilingual extraction and `TextReflow` repairs; rerun Persian fixture |
| RF-R24 | Page-43 `Loyalty that refuses` is formatted and spoken as body text | Render it as a separate heading and speak the localized `Title` cue more slowly | Sentence-case heading recovery plus exact manuscript fixture |
| RF-R25 | rF AI omits `and` in `emperors, and people` | The conjunction must be clearly audible while displayed text remains unchanged | Speech-only balanced-clause boundary plus exact manuscript fixture |
| RF-R26 | rF AI pronounces `must not become` as `must not come` on page 42 | Pronounce both syllables of `become` clearly | Speech-only articulation comma plus exact manuscript fixture |

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
   its own line, and is introduced by the spoken `Title` cue.
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

Record the candidate, phone model, entitlement, document/page, and pass/fail in
`HANDOVER_CURRENT.md` after every release QA session.
