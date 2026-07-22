# readFlow Text Intelligence

Updated: 2026-07-22

## Purpose

readFlow now maintains two deliberately separate representations:

1. **Display text** is the canonical extracted document text. The reader,
   bookmarks, copy, search, and AI context continue to use it unchanged.
2. **Speakable text** is a short-lived mapped projection prepared only for the
   selected speech engine.

The pipeline is:

```text
Extracted document content
  -> TextReflow display structure
  -> hybrid text intelligence
  -> mapped speakable representation
  -> Device, rF AI, or Cloud AI speech
```

This prevents voice fixes from rewriting a book or destabilizing saved
positions. Every output character keeps a source offset back to the displayed
paragraph, so line highlighting remains anchored after silent or expanded
speech formatting.

## Module Boundary

The replaceable contract is
`mobile/src/services/text-intelligence/types.ts`.

Input includes:

- current raw segment;
- up to two nearby segments on each side;
- page, paragraph, source, and heading metadata when available;
- requested language and reading position;
- an explicit flag for paid online fallback.

Output includes:

- speakable text and source-offset map;
- sentence/clause/item boundaries;
- script/language and mixed-language metadata;
- pronunciation hints;
- pause and emphasis instructions;
- structural interpretation and confidence;
- fallback requirement and provenance.

The reader depends only on `TextIntelligenceEngine`, not on a particular local
model, cloud vendor, or normalization implementation.

## Hybrid Implementation

### 1. Deterministic layer

`DeterministicSpeechNormalizer.ts` handles cases that can be changed safely:
Unicode typography, hidden soft hyphens, visual list markers, table separators,
whitespace, and heading-only Roman numbering. Transformations are mapped and
must not change meaningful word order.

### 2. Compact local contextual model

`CompactMultilingualModel.ts` is a tiny weighted classifier bundled as code. It
uses source structure, neighboring segments, line shape, symbol density, and
Unicode-script-independent features to distinguish prose, headings, dialogue,
lists, tables, formulas, likely artifacts, and unknown/mixed structures. It is
offline, deterministic, adds no model download, and is not tied to one book or
a closed list of reported phrases.

This is intentionally a replaceable first local model, not a claim that a tiny
classifier has large-language-model understanding. A future ONNX or native
model can implement `LocalTextIntelligenceModel` without changing Reader or
the TTS providers.

### 3. Confidence fallback

Low confidence, mixed structure, and likely OCR artifacts are returned with a
fallback reason. Offline reading continues using the conservative mapped text;
it never blocks on a network request. If the replaceable local model itself
fails, the engine returns the exact raw segment with an identity source map so
ordinary reading still works.

### 4. Optional online fallback

`BackendTextIntelligenceFallback.ts` and backend
`POST /api/text-intelligence` provide an optional AI Pro/Power adapter. It is
guarded by the existing text-AI entitlement, app key, rate limit, cache, and
monthly AI-action quota. Both mobile and backend reject output that fails the
lexical-fidelity check.

Reader currently sets `allowOnlineFallback: false`. Do not enable it silently:
add a clear paid setting and usage explanation first. Free, Reader Plus, and
ordinary offline playback therefore make no OpenAI request.

## Prefetch And Responsiveness

The engine caches 96 prepared segments. Reader prepares the current speech
chunk and sends the same small look-ahead used by each TTS provider through the
cache. It does not analyze the complete book. Nearby context is bounded to two
segments before and after the current chunk.

## Fidelity Rules

- Never summarize, simplify, translate, or invent text for speech.
- Never mutate the displayed document to improve pronunciation.
- Never accept an online transformation that drops or reorders lexical tokens.
- Preserve source mapping through every accepted transformation.
- Treat confidence as a reason to fall back conservatively, not permission to
  guess.

## Language And Size Boundaries

The text-intelligence layer handles Unicode scripts together and adds only
source code, so it does not require one preparation package per language. This
does **not** replace OCR language data or TTS voice models:

- native PDF/DOCX extraction remains language-independent where the source has
  a valid text layer;
- scanned documents still require the relevant OCR language support;
- Device and Cloud voices support the languages provided by those engines;
- the current downloadable rF AI voice model is English-only. Other rF voice
  languages still require separately tested voice packs.

## Verification

Run from `mobile/`:

```powershell
npm run check:reader-regressions
npx tsc --noEmit
npm run check:release
```

The permanent fixtures cover unfamiliar English structures, Persian and
Chinese scripts, mixed-script pronunciation metadata, heading-only Roman
normalization, exact retention of `would have`, transformed-source mapping,
non-BMP Unicode mapping, local-model failure recovery, and rejection of an
unsafe online rewrite.

The signed QA APK `artifacts/readflow-qa-1.0.45-51.apk` is 211,367,136 bytes
(201.58 MiB), only 114,904 bytes (112.21 KiB) larger than `1.0.44 (50)`. The
preparation layer therefore adds no language-pack download and no meaningful
installation-size increase. Most of the APK remains the existing native rF AI
runtime and bundled application dependencies.
