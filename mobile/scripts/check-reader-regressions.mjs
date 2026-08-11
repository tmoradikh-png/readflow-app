import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1")), "..");

function loadTypeScript(relativePath, modules = {}) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (Object.hasOwn(modules, id)) return modules[id];
    throw new Error(`Unexpected runtime import ${id} in ${relativePath}`);
  };
  new Function("exports", "module", "require", "__filename", "__dirname", output)(
    module.exports,
    module,
    localRequire,
    filename,
    path.dirname(filename)
  );
  return module.exports;
}

const textModule = loadTypeScript("src/services/TextReflow.ts");
const speechModule = loadTypeScript("src/services/SpeechChunk.ts", {
  "./TextReflow": textModule,
});
const normalizationModule = loadTypeScript("src/services/SpeechNormalization.ts");
const compactTextModelModule = loadTypeScript(
  "src/services/text-intelligence/CompactMultilingualModel.ts"
);
const deterministicTextModule = loadTypeScript(
  "src/services/text-intelligence/DeterministicSpeechNormalizer.ts",
  { "../SpeechNormalization": normalizationModule }
);
const hybridTextModule = loadTypeScript(
  "src/services/text-intelligence/HybridTextIntelligence.ts",
  {
    "./CompactMultilingualModel": compactTextModelModule,
    "./DeterministicSpeechNormalizer": deterministicTextModule,
  }
);
const planModule = loadTypeScript("../backend/src/config/plans.ts");
const pdfExtractionModule = loadTypeScript("../backend/src/services/pdfExtract.ts", {
  "pdf-parse/lib/pdf-parse.js": async () => ({ numpages: 0 }),
});
const { TextReflow, classifyVisualPage } = textModule;
const { buildSpeechChunk, resumeSpeechOffset } = speechModule;
const {
  buildLocalSpeechSegments,
  normalizeHeadingForSpeech,
  normalizeEnglishNumbersForSpeech,
  normalizeLocalSpeechText,
} = normalizationModule;
const { renderPdfTextItems, containsRasterImageOperators } = pdfExtractionModule;
const { CompactMultilingualModel } = compactTextModelModule;
const { HybridTextIntelligence } = hybridTextModule;

assert.equal(containsRasterImageOperators([1, 10, 85]), true);
assert.equal(containsRasterImageOperators([1, 10, 42]), false);

const visualCaptionPage = {
  page: 15,
  source: "native",
  text: [
    "Task Unit Bruiser SEALs unleash lethal machine gun fire and 40mm grenades",
    "on insurgents during a clearance operation in southeast Ramadi.",
    "(Photo courtesy of the authors)",
  ].join("\n"),
};
assert.deepEqual(classifyVisualPage(visualCaptionPage), {
  preserve: true,
  suppressSpeech: true,
  reason: "caption",
});

const corruptCoverPage = {
  page: 1,
  source: "native",
  text: "Jean. -Jacques\nRousseau _\nThe Reveries\n| Solitary Walker",
};
assert.deepEqual(classifyVisualPage(corruptCoverPage), {
  preserve: true,
  suppressSpeech: true,
  reason: "corrupt",
});

const compactTablePage = {
  page: 30,
  source: "native",
  text: [
    "Quarter  Revenue  Cost",
    "Q1       120      80",
    "Q2       135      82",
    "Q3       142      91",
    "Q4       160      96",
    "Total    557      349",
  ].join("\n"),
};
assert.equal(classifyVisualPage(compactTablePage).reason, "table");

const sparseReadablePage = {
  page: 31,
  source: "native",
  text: "A final thought closes the chapter.\nIt remains ordinary readable prose.",
};
assert.deepEqual(classifyVisualPage(sparseReadablePage), {
  preserve: true,
  suppressSpeech: false,
  reason: "sparse",
});

const notesSectionRows = TextReflow.buildSentences([
  {
    page: 1,
    source: "native",
    text: "The walk ends with this complete body paragraph.\n\nNOTES\n1. Editorial history that must not enter reflow.",
  },
  {
    page: 2,
    source: "native",
    text: "First Walk 10\nThis is a continuation of the editorial note.\n2. Another note.",
  },
  {
    page: 3,
    source: "native",
    text: "SECOND WALK\n\nThe next walk begins with ordinary body prose.",
  },
], { preserveOriginalPages: true });
const notesSectionText = notesSectionRows.map((row) => row.text).join(" ");
assert.match(notesSectionText, /The walk ends with this complete body paragraph\./);
assert.match(notesSectionText, /SECOND WALK[\s\S]*The next walk begins/);
assert.doesNotMatch(
  notesSectionText,
  /Editorial history|continuation of the editorial note|Another note/,
  "explicit multi-page notes must stay out of reflow until the next Walk"
);
const numberedBodyRows = TextReflow.buildSentences([
  {
    page: 1,
    source: "native",
    text: "1. First instruction remains part of the body.\n2. Second instruction remains too.",
  },
]);
assert.match(
  numberedBodyRows.map((row) => row.text).join(" "),
  /First instruction[\s\S]*Second instruction/,
  "ordinary numbered body text must not be mistaken for footnotes"
);

assert.deepEqual(
  classifyVisualPage({
    page: 282,
    source: "native",
    hasRasterImage: true,
    text: "ABOUT THE AUTHORS\n" + "The authors' biographies remain readable prose. ".repeat(18),
  }),
  { preserve: true, suppressSpeech: false, reason: "sparse" },
  "a mixed portrait and biography page must preserve its artwork without silencing prose"
);

const visualRows = TextReflow.buildSentences(
  [corruptCoverPage, { page: 2, source: "native", text: "The readable chapter begins here." }],
  { preserveOriginalPages: true }
);
assert.equal(visualRows[0].visualPage, true);
assert.equal(visualRows[0].suppressSpeech, true);
assert.equal(
  buildSpeechChunk(0, visualRows, { mode: "local", pageCap: 10 })?.text,
  "The readable chapter begins here.",
  "corrupted visual pages must remain visible but be skipped by speech"
);
const longSilentVisualRun = Array.from({ length: 2_000 }, (_, index) => ({
  id: index,
  page: index + 1,
  pageSentenceIndex: 0,
  paragraphIndex: 0,
  key: `${index + 1}:visual`,
  text: "",
  kind: "body",
  visualPage: true,
  suppressSpeech: true,
}));
longSilentVisualRun.push({
  id: 2_000,
  page: 2_001,
  pageSentenceIndex: 0,
  paragraphIndex: 0,
  key: "2001:0",
  text: "Readable prose resumes.",
  kind: "body",
});
assert.equal(
  buildSpeechChunk(0, longSilentVisualRun, { mode: "local", pageCap: 3_000 })?.text,
  "Readable prose resumes.",
  "large runs of scanned visual pages must be skipped without recursive stack growth"
);
const { AI_ECONOMICS, TIERS, estimatedMonthlyContributionUsd } = planModule;

const planByKey = Object.fromEntries(TIERS.map((tier) => [tier.key, tier]));
assert.equal(planByKey.free.limits.localVoiceSecondsPerDay, 5 * 60);
assert.equal(planByKey.reader_plus.limits.localVoiceSecondsPerDay, 30 * 60);
assert.equal(planByKey.ai_pro.limits.localVoiceSecondsPerDay, 0);
assert.equal(planByKey.power.limits.localVoiceSecondsPerDay, 0);
assert.equal(planByKey.reviewer.limits.localVoiceSecondsPerDay, 0);
assert.equal(planByKey.reader_plus.features.ocr, false);
assert.equal(planByKey.reader_plus.features.ai, false);
assert.equal(planByKey.reader_plus.features.cloudVoice, false);
assert.equal(planByKey.ai_pro.limits.cloudVoiceCharsPerMonth, 20_000);
assert.equal(planByKey.ai_pro.limits.maxPages, 2_500);
assert.equal(planByKey.ai_pro.products.monthly.priceUsd, 10.99);
assert.equal(planByKey.power.limits.ocrPagesPerMonth, 2_500);
assert.equal(planByKey.power.limits.aiActionsPerMonth, 400);
assert.equal(planByKey.power.limits.cloudVoiceCharsPerMonth, 100_000);
assert.equal(planByKey.power.products.monthly.priceUsd, 19.99);
assert.equal(planByKey.power.products.yearly.priceUsd, 179.99);
assert.ok(
  estimatedMonthlyContributionUsd(planByKey.ai_pro, "monthly") >=
    AI_ECONOMICS.minMonthlyContributionUsd.ai_pro
);
assert.ok(
  estimatedMonthlyContributionUsd(planByKey.power, "monthly") >=
    AI_ECONOMICS.minMonthlyContributionUsd.power
);
assert.ok(planByKey.ai_pro.limits.maxPages >= planByKey.reader_plus.limits.maxPages);
assert.ok(planByKey.power.limits.maxPages >= planByKey.ai_pro.limits.maxPages);

// Speech preparation is independent from rendering. It uses context and
// structure, preserves lexical content, and maps every spoken character back
// to the unchanged displayed source.
const textIntelligence = new HybridTextIntelligence(new CompactMultilingualModel());
const headingSource = "BOOK II";
const preparedHeading = await textIntelligence.prepare({
  rawText: headingSource,
  before: [{ text: "The preceding chapter closes here.", kind: "body" }],
  after: [{ text: "A new argument begins here.", kind: "body" }],
  layout: { kind: "heading", isolated: true, page: 43 },
  language: "en-US",
});
assert.equal(headingSource, "BOOK II", "displayed heading source must remain unchanged");
assert.equal(preparedHeading.text, "BOOK 2");
assert.equal(preparedHeading.structure.kind, "heading");
assert.equal(preparedHeading.sourceOffsets.length, preparedHeading.text.length);
assert.ok(preparedHeading.sourceOffsets.every((offset) => offset >= 0 && offset < headingSource.length));
assert.ok(preparedHeading.emphasis.some((item) => item.reason === "heading"));

const unfamiliarPersianHeading = "وفاداری که امتناع می‌کند";
const preparedPersianHeading = await textIntelligence.prepare({
  rawText: unfamiliarPersianHeading,
  before: [{ text: "این بند در اینجا پایان می‌یابد.", kind: "body" }],
  after: [{ text: "بحث تازه از اینجا آغاز می‌شود.", kind: "body" }],
  layout: { kind: "heading", isolated: true },
  language: "fa-IR",
});
assert.equal(preparedPersianHeading.text, unfamiliarPersianHeading);
assert.equal(preparedPersianHeading.structure.kind, "heading");
assert.equal(preparedPersianHeading.language.primary, "fa");
assert.ok(preparedPersianHeading.language.scripts.includes("Arabic"));

const preparedList = await textIntelligence.prepare({
  rawText: "• Preserve every meaningful word",
  before: [{ text: "Requirements", kind: "heading" }],
  after: [{ text: "• Keep reading offline", kind: "body" }],
  layout: { kind: "body", isolated: true },
  language: "en",
});
assert.equal(preparedList.structure.kind, "list");
assert.equal(preparedList.text, "Preserve every meaningful word");
assert.equal(preparedList.boundaries[0]?.kind, "item");

const preparedTable = await textIntelligence.prepare({
  rawText: "Norway | 12 | Active",
  before: [{ text: "Country | Users | Status", kind: "body" }],
  after: [{ text: "Sweden | 8 | Active", kind: "body" }],
  layout: { kind: "body" },
  language: "en",
});
assert.equal(preparedTable.structure.kind, "table");
assert.equal(preparedTable.text, "Norway, 12, Active");
assert.equal(preparedTable.sourceOffsets.length, preparedTable.text.length);

const exactReportedPhrase =
  "In a very small community, dependence would have been difficult to escape.";
const preparedReportedPhrase = await textIntelligence.prepare({
  rawText: exactReportedPhrase,
  before: [{ text: "The sentence before remains nearby.", kind: "body" }],
  after: [{ text: "The sentence after remains nearby.", kind: "body" }],
  layout: { kind: "body" },
  language: "en",
});
assert.equal(preparedReportedPhrase.text, exactReportedPhrase);
assert.match(preparedReportedPhrase.text, /would have/);

const exactPage58Paragraph =
  "Ashoka could not restore the people his edict said had been killed. The Iraq Inquiry could not return Britain to early 2003. A United Nations resolution could name aggression but did not, by naming it, end the invasion of Ukraine.";
const preparedPage58Paragraph = await textIntelligence.prepare({
  rawText: exactPage58Paragraph,
  before: [{ text: "After the name", kind: "heading" }],
  after: [{ text: "Naming remains necessary because unnamed violence is easier to repeat.", kind: "body" }],
  layout: { kind: "body", page: 58 },
  language: "en-US",
});
assert.equal(
  preparedPage58Paragraph.text,
  exactPage58Paragraph,
  "speech preparation must preserve unfamiliar names and every meaningful word"
);

const shortBodyNearHeading = await textIntelligence.prepare({
  rawText: "This remains ordinary body prose.",
  before: [{ text: "A nearby chapter heading", kind: "heading" }],
  after: [{ text: "The following body paragraph continues here.", kind: "body" }],
  layout: { kind: "body", isolated: false },
  language: "en-US",
});
assert.equal(
  shortBodyNearHeading.structure.kind,
  "prose",
  "short body prose must not inherit heading emphasis from nearby structure"
);

const mixedLanguage = await textIntelligence.prepare({
  rawText: "ReadFlow keeps فارسی terms in their original wording.",
  layout: { kind: "body" },
  language: "en",
});
assert.equal(mixedLanguage.language.mixed, true);
assert.ok(mixedLanguage.pronunciation.some((hint) => hint.language === "ar"));

const preparedDialogue = await textIntelligence.prepare({
  rawText: "“Nothing meaningful may be omitted,” she replied.",
  before: [{ text: "They paused at the doorway.", kind: "body" }],
  after: [{ text: "Then the conversation continued.", kind: "body" }],
  layout: { kind: "body" },
  language: "en",
});
assert.equal(preparedDialogue.structure.kind, "dialogue");
assert.equal(preparedDialogue.text, '"Nothing meaningful may be omitted," she replied.');
assert.ok(preparedDialogue.emphasis.some((item) => item.reason === "dialogue"));

const preparedFormula = await textIntelligence.prepare({
  rawText: "E = mc² + ΔE",
  before: [{ text: "The relationship is written as follows.", kind: "body" }],
  after: [{ text: "The variables are defined below.", kind: "body" }],
  layout: { kind: "body", isolated: true },
  language: "en",
});
assert.equal(preparedFormula.structure.kind, "formula");
assert.match(preparedFormula.text, /E = mc2 \+ ΔE/);

const preparedChineseList = await textIntelligence.prepare({
  rawText: "• 保留作者的每一个词",
  before: [{ text: "要求", kind: "heading" }],
  after: [{ text: "• 保持离线阅读", kind: "body" }],
  layout: { kind: "body", isolated: true },
  language: "zh-CN",
});
assert.equal(preparedChineseList.structure.kind, "list");
assert.equal(preparedChineseList.text, "保留作者的每一个词");
assert.ok(preparedChineseList.language.scripts.includes("Han"));

const rejectingOnlineFallback = new HybridTextIntelligence(new CompactMultilingualModel(), {
  id: "unsafe-test-fallback",
  async prepare() {
    return { text: "invented summary", structure: "prose", confidence: 0.99 };
  },
});
const suspiciousSource = "@@@ preserved words must remain @@@";
const rejectedOnline = await rejectingOnlineFallback.prepare({
  rawText: suspiciousSource,
  layout: { kind: "body" },
  language: "en",
  allowOnlineFallback: true,
});
assert.equal(rejectedOnline.text, suspiciousSource);
assert.equal(rejectedOnline.fallback.usedOnline, false);

const unicodeMapped = await textIntelligence.prepare({
  rawText: "Read 📘 section ².",
  language: "en-US",
  layout: { kind: "body", source: "native" },
});
assert.equal(unicodeMapped.sourceOffsets.length, unicodeMapped.text.length);
assert.ok(
  unicodeMapped.sourceOffsets.every(
    (offset) => offset >= 0 && offset < "Read 📘 section ².".length
  )
);

const pronunciationMetadata = await textIntelligence.prepare({
  rawText: "The U.S. total was $1.12 billion.",
  language: "en-US",
  layout: { kind: "body", source: "native" },
});
assert.ok(pronunciationMetadata.pronunciation.some((hint) => hint.mode === "letters"));
assert.ok(pronunciationMetadata.pronunciation.some((hint) => hint.mode === "number"));
assert.equal(pronunciationMetadata.text, "The U.S. total was $1.12 billion.");

const throwingEngine = new HybridTextIntelligence({
  id: "throwing-local-test",
  interpret() {
    throw new Error("test model failure");
  },
});
const identityFallback = await throwingEngine.prepare({
  rawText: "Keep every original word.",
  language: "en-US",
});
assert.equal(identityFallback.text, "Keep every original word.");
assert.equal(identityFallback.fallback.required, true);
assert.equal(identityFallback.structure.kind, "unknown");
assert.equal(identityFallback.sourceOffsets.length, identityFallback.text.length);

// Native PDF paragraphs are visual rows. They must no longer be exploded into
// one row per sentence, which made ordinary books look highly fragmented.
const paragraphFixture = TextReflow.buildSentences([
  {
    page: 11,
    source: "native",
    text: "The first paragraph begins. It ends here.\n\nThe second paragraph starts now.",
  },
]);
assert.equal(paragraphFixture.length, 2, "native text must retain its two source paragraphs");
assert.equal(paragraphFixture[0].text, "The first paragraph begins. It ends here.");
assert.equal(paragraphFixture[1].text, "The second paragraph starts now.");

const firstParagraph = buildSpeechChunk(0, paragraphFixture, {
  mode: "local",
  pageCap: 300,
});
assert.equal(firstParagraph?.spans.length, 1, "one paragraph must use one mapped visual span");
assert.equal(firstParagraph?.nextIndex, 1, "the next paragraph must remain queued");
assert.equal(firstParagraph?.nextOffset, 0);
assert.equal(firstParagraph?.text, "The first paragraph begins. It ends here.");

const cachedPage45 = TextReflow.buildSentences([
  {
    page: 45,
    source: "native",
    text: [
      "The medal can be evidence of learning. It can also become a flattering ending: the institution",
      "places the dissenter inside its approved history and points to him as evidence of its values. But",
      "the delay belongs to the meaning of the honor. So do the civilians who did not live to see any",
      "correction. Recognition matters; it does not travel backward in time.",
      "This is the illusion of moral arrival in institutional form. We inherit the corrected story and",
      "identify ourselves with the correction. We forget how long the truth was unwelcome. We praise",
      "the courage after the courage no longer threatens us, then treat that praise as evidence that we",
      "would have acted courageously when it did.",
      "My Lai also warns against speaking of a government or an army as if it were one mind. The same",
      "institution contained the soldiers who killed, the crew who intervened, the officers who helped",
      "halt the operation, the officials who obscured the truth, the investigators who documented it,",
      "and the later leaders who honored refusal. The Army did this can be accurate at one level and",
      "dangerously incomplete at another. Institutions coordinate action, but individuals still decide",
      "where to place their hands.",
      "That morning, Thompson placed his helicopter on the ground between armed men who",
      "belonged to him and unarmed people who did not.",
      "The aircraft did not end war, abolish obedience, or prove that a modern person is better than an",
      "ancient one. It occupied a few meters of earth. On one side stood the power of the group. On the",
      "other stood people the group had decided not to see.",
      "For a moment, loyalty had to choose where to land. It did not land by itself.",
    ].join("\n"),
  },
]);
assert.equal(
  cachedPage45.length,
  6,
  "older hard-wrapped PDF text must recover the six visible source paragraphs on page 45"
);
assert.match(cachedPage45[2].text, /and the later leaders who honored refusal/);

// A page divider is not a spoken boundary when one sentence crosses it. Only
// the completing sentence is appended; later text on the new page stays queued.
const splitPages = TextReflow.buildSentences([
  {
    page: 42,
    source: "native",
    text: "A complete sentence.\n\nThe system depends on a very small",
  },
  {
    page: 43,
    source: "native",
    text: "community, dependence would have been difficult to escape. Next sentence.",
  },
]);
assert.equal(splitPages.length, 3, "fixture should retain three source paragraphs");
assert.equal(splitPages[1].page, 42);
assert.equal(splitPages[2].page, 43);

const deviceBoundary = buildSpeechChunk(1, splitPages, {
  mode: "device",
  pageCap: 300,
});
assert.ok(deviceBoundary, "device speech chunk should be created");
assert.equal(deviceBoundary.spans.length, 2, "unfinished sentence should cross the page divider");
assert.equal(
  deviceBoundary.text,
  "The system depends on a very small community, dependence would have been difficult to escape."
);
assert.equal(deviceBoundary.nextIndex, 2, "continuation remains anchored to its paragraph");
assert.ok(deviceBoundary.nextOffset > 0, "later text in the continuation paragraph stays queued");
assert.equal(splitPages[2].text.slice(deviceBoundary.nextOffset), "Next sentence.");

const afterBoundary = buildSpeechChunk(2, splitPages, {
  mode: "device",
  pageCap: 300,
  firstOffset: deviceBoundary.nextOffset,
});
assert.equal(afterBoundary?.text, "Next sentence.");
assert.equal(afterBoundary?.nextIndex, 3);
assert.equal(afterBoundary?.nextOffset, 0);

const completedPages = TextReflow.buildSentences([
  { page: 7, source: "native", text: "This sentence is complete." },
  { page: 8, source: "native", text: "A new sentence begins here." },
]);
const completedChunk = buildSpeechChunk(0, completedPages, { mode: "device", pageCap: 300 });
assert.equal(completedChunk?.spans.length, 1, "completed sentences must retain the page pause");

// Exceptionally long paragraphs restart inside the same visual row and neither
// repeat nor omit text, including when each individual sentence is pathological.
const sentenceA = `${"Careful reading protects every quiet word ".repeat(11)}today.`;
const sentenceB = `${"Natural pacing protects every quiet word ".repeat(11)}again.`;
const sentenceC = `${"Complete boundaries protect every quiet word ".repeat(11)}always.`;
const longParagraphText = `${sentenceA} ${sentenceB} ${sentenceC}`;
const longParagraph = TextReflow.buildSentences([
  { page: 9, source: "native", text: longParagraphText },
]);
assert.equal(longParagraph.length, 1, "a long native paragraph stays one visual row");

let longParagraphIndex = 0;
let longParagraphOffset = 0;
const longParagraphClips = [];
for (let guard = 0; guard < 20 && longParagraphIndex < longParagraph.length; guard++) {
  const chunk = buildSpeechChunk(longParagraphIndex, longParagraph, {
    mode: "local",
    pageCap: 300,
    firstOffset: longParagraphOffset,
  });
  assert.ok(chunk);
  assert.ok(chunk.text.length <= 260);
  longParagraphClips.push(chunk.text);
  longParagraphIndex = chunk.nextIndex;
  longParagraphOffset = chunk.nextOffset;
}
assert.equal(longParagraphIndex, 1);
assert.equal(
  longParagraphClips.join(" "),
  longParagraphText,
  "chunking a long paragraph must not repeat, omit, or rewrite a word"
);

// A roughly 1,000-word paragraph is bounded into multiple logical reading
// units, while each sentence remains a small native render. Reassembling every
// unit must reproduce the exact text sent to speech.
const thousandWordText = Array.from(
  { length: 100 },
  (_, index) => `Careful readers preserve every small word in sentence number ${index + 1}.`
).join(" ");
const thousandWordParagraph = TextReflow.buildSentences([
  { page: 10, source: "native", text: thousandWordText },
]);
let offset = 0;
let index = 0;
const clips = [];
for (let guard = 0; guard < 100 && index < thousandWordParagraph.length; guard++) {
  const chunk = buildSpeechChunk(index, thousandWordParagraph, {
    mode: "local",
    pageCap: 300,
    firstOffset: offset,
  });
  assert.ok(chunk, "every long-paragraph continuation must build");
  clips.push(chunk.text);
  assert.ok(chunk.text.length <= 1000, "local logical reading units stay bounded");
  assert.ok(
    buildLocalSpeechSegments(chunk.text).every((segment) => segment.text.length <= 260),
    "every punctuated native render stays within the hard sentence guard"
  );
  assert.ok(
    chunk.nextIndex > index || chunk.nextOffset > offset,
    "each continuation must make forward progress"
  );
  index = chunk.nextIndex;
  offset = chunk.nextOffset;
}
assert.equal(index, 1, "the complete long paragraph must eventually advance");
assert.ok(clips.length > 1, "a 1,000-word-class paragraph must use bounded clips");
assert.equal(clips.join(" "), thousandWordText, "bounded clips must preserve every source word");

const multiSentenceParagraphText = [
  "The first complete sentence preserves its natural place in the paragraph.",
  "The second complete sentence remains part of the same logical reading unit.",
  "The third complete sentence allows playback to begin before the full paragraph is rendered.",
  "The fourth complete sentence keeps every source word and reaches the paragraph ending.",
].join(" ");
assert.ok(multiSentenceParagraphText.length > 260);
const multiSentenceParagraph = TextReflow.buildSentences([
  { page: 11, source: "native", text: multiSentenceParagraphText },
]);
const multiSentenceChunk = buildSpeechChunk(0, multiSentenceParagraph, {
  mode: "local",
  pageCap: 300,
});
assert.equal(multiSentenceChunk?.text, multiSentenceParagraphText);
assert.equal(multiSentenceChunk?.nextIndex, 1);
assert.equal(multiSentenceChunk?.nextOffset, 0);

const resumeText = "The first sentence is complete. The second sentence is still playing. The third waits.";
assert.equal(resumeSpeechOffset(resumeText, 8), 0, "early pause resumes the first sentence");
assert.equal(
  resumeText.slice(resumeSpeechOffset(resumeText, 52)),
  "The second sentence is still playing. The third waits.",
  "pause inside a long visual paragraph resumes the current sentence, not the whole paragraph"
);

// A pathological sentence must be bounded for local synthesis so native memory
// cannot grow without limit. Every source word remains present across chunks.
const oneLongSentence = `${"One grammatical sentence keeps its own natural continuity ".repeat(25)}today.`;
const oneLongSentenceRows = TextReflow.buildSentences([
  { page: 12, source: "native", text: oneLongSentence },
]);
let longSentenceIndex = 0;
let longSentenceOffset = 0;
const longSentenceClips = [];
for (let guard = 0; guard < 10 && longSentenceIndex < oneLongSentenceRows.length; guard++) {
  const chunk = buildSpeechChunk(longSentenceIndex, oneLongSentenceRows, {
    mode: "local",
    pageCap: 300,
    firstOffset: longSentenceOffset,
  });
  assert.ok(chunk, "every pathological-sentence continuation must build");
  assert.ok(chunk.text.length <= 260, "one local native request must stay within the hard guard");
  longSentenceClips.push(chunk.text);
  longSentenceIndex = chunk.nextIndex;
  longSentenceOffset = chunk.nextOffset;
}
assert.equal(longSentenceIndex, 1);
assert.equal(longSentenceClips.join(" "), oneLongSentence);

const marker = TextReflow.speechText("communities.2 The evidence", "body");
assert.equal(marker.text, "communities. The evidence", "footnote marker must stay silent");

const flattenedMarkers = TextReflow.speechText(
  "Its moral imagination may genuinely have widened.11013 To describe all of that",
  "body"
);
assert.equal(
  flattenedMarkers.text,
  "Its moral imagination may genuinely have widened. To describe all of that",
  "adjacent flattened references 1, 10, and 13 must stay silent"
);

const legacyYearMarker = TextReflow.speechText(
  "Public subsidies formed sixty-three percent of recorded party income in 2024.11 This does not remove advantage.",
  "body"
);
assert.equal(
  legacyYearMarker.text,
  "Public subsidies formed sixty-three percent of recorded party income in 2024. This does not remove advantage.",
  "a citation flattened after a year must not be spoken as point/dot eleven"
);
assert.deepEqual(
  TextReflow.referenceMarkers("Income in 2024.11 This continues.", "body").map((marker) => marker.text),
  ["11"],
  "legacy year citations must render as superscripts"
);
const canonicalLegacyYear = TextReflow.buildSentences([
  {
    page: 50,
    source: "native",
    text: "Income in 2024.11 This continues. A real version 2024.11 remains unchanged.",
  },
]);

const edgeBoilerplateRows = TextReflow.buildSentences(
  [7, 8, 9, 10].map((page) => ({
    page,
    source: "native",
    text: `Rousseau - Reveries ${page}\nPreface ${["vii", "viii", "ix", "x"][page - 7]}\nThis is body prose on page ${page}.\n${page === 7 ? "BOOK VII\n" : ""}The body continues without its running furniture.\nAnother ordinary body sentence remains.\n${page}`,
  }))
);
const edgeBoilerplateText = edgeBoilerplateRows.map((row) => row.text).join(" ");
assert.doesNotMatch(edgeBoilerplateText, /Rousseau - Reveries|Preface (?:vii|viii|ix|x)/i);
assert.match(edgeBoilerplateText, /BOOK VII/);
assert.match(edgeBoilerplateText, /body prose on page 7/i);
const longBookFurnitureRows = TextReflow.buildSentences(
  Array.from({ length: 283 }, (_, index) => {
    const page = index + 1;
    const prefacePage = page >= 6 && page <= 15;
    const roman = ["vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi"];
    const romanPage = roman[page - 6];
    const damagedHeader =
      page === 7
        ? "ate Preface"
        : page === 13
          ? "iy Preface"
          : page % 2
            ? `${romanPage} Preface`
            : `Preface ${romanPage}`;
    return {
      page,
      source: "native",
      text: prefacePage
        ? `${damagedHeader}\nPreface body sentence ${page} remains.\n${romanPage}`
        : `Ordinary body sentence ${page} remains.\n${page}`,
    };
  })
);
const longBookFurnitureText = longBookFurnitureRows.map((row) => row.text).join(" ");
assert.doesNotMatch(longBookFurnitureText, /\b(?:vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi) Preface\b|\bPreface (?:vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi)\b/i);
assert.doesNotMatch(longBookFurnitureText, /\b(?:ate|iy) Preface\b/i);
assert.match(longBookFurnitureText, /Preface body sentence 6 remains/);
assert.equal(
  canonicalLegacyYear[0]?.text,
  "Income in 2024.¹¹ This continues. A real version 2024.11 remains unchanged.",
  "legacy references must be canonical for display, copy, speech, highlighting, and AI context"
);
assert.equal(
  TextReflow.speechText("A real version 2024.11 remains part of this sentence.", "body").text,
  "A real version 2024.11 remains part of this sentence.",
  "a real decimal/version must remain visible and spoken"
);
const semanticColonNumbers =
  "John 3:16 begins at 12:30 after a 4:2 score and a 16:9 presentation.";
assert.equal(
  TextReflow.speechText(semanticColonNumbers, "body").text,
  semanticColonNumbers,
  "verse, time, score, ratio, and schedule digits after a colon must remain visible and spoken"
);
assert.deepEqual(
  TextReflow.referenceMarkers(semanticColonNumbers, "body"),
  [],
  "semantic colon numbers must never be classified as citations"
);

const geometryCitation = renderPdfTextItems([
  {
    str: "2024.",
    transform: [11.04, 0, 0, 11.04, 72.024, 373.49],
    width: 28.28448,
    height: 11.04,
  },
  {
    str: "11",
    transform: [5.04, 0, 0, 5.04, 100.34, 375.53],
    width: 4.32,
    height: 5.04,
  },
  {
    str: "This does not remove advantage.",
    transform: [11.04, 0, 0, 11.04, 110.18, 373.49],
    width: 160,
    height: 11.04,
  },
]);
assert.equal(
  geometryCitation,
  "2024.¹¹ This does not remove advantage.",
  "backend extraction must preserve the PDF's smaller raised citation geometry"
);

const typographyStructuredPage = renderPdfTextItems([
  {
    str: "The preceding body paragraph ends here.",
    transform: [11.04, 0, 0, 11.04, 72.024, 250],
    width: 220,
    height: 11.04,
    fontName: "g_body",
  },
  {
    str: "Measurement, ranking, and the crowd",
    transform: [12.96, 0, 0, 12.96, 72.024, 210],
    width: 255,
    height: 12.96,
    fontName: "g_heading",
  },
  {
    str: "Before an election, polls are reported as measurements of public opinion.",
    transform: [11.04, 0, 0, 11.04, 72.024, 175],
    width: 390,
    height: 11.04,
    fontName: "g_body",
  },
]);
assert.match(
  typographyStructuredPage,
  /\uE100Measurement, ranking, and the crowd\uE101/,
  "backend extraction must preserve a full-line PDF typography heading structurally"
);
const typographyStructuredRows = TextReflow.buildSentences([
  { page: 48, source: "native", text: typographyStructuredPage },
]);
assert.equal(
  typographyStructuredRows.find((row) => row.text === "Measurement, ranking, and the crowd")?.kind,
  "heading",
  "mobile reflow must consume structural PDF heading markers without displaying them"
);
const headingVariationRows = TextReflow.buildSentences([
  {
    page: 49,
    source: "native",
    text: [
      "BOOK I",
      "Loyalty that refuses",
      "The chapter body starts here and continues as ordinary prose.",
      "",
      "CHAPTER IV",
      "A Different Kind of Courage",
      "The next chapter body starts here.",
    ].join("\n"),
  },
]);
for (const title of ["BOOK I", "Loyalty that refuses", "CHAPTER IV", "A Different Kind of Courage"]) {
  assert.equal(
    headingVariationRows.find((row) => row.text === title)?.kind,
    "heading",
    `${title} must remain a structural heading`
  );
}
assert.equal(normalizeHeadingForSpeech("BOOK I"), "BOOK 1");
assert.equal(normalizeHeadingForSpeech("Chapter IV: A New Beginning"), "Chapter 4: A New Beginning");
assert.equal(normalizeHeadingForSpeech("PART XII"), "PART 12");
assert.equal(normalizeHeadingForSpeech("III"), "3");
assert.equal(
  normalizeHeadingForSpeech("I understand the chapter"),
  "I understand the chapter",
  "heading normalization must never rewrite an ordinary first-person I"
);
assert.ok(
  typographyStructuredRows.every((row) => !/[\uE100\uE101]/.test(row.text)),
  "internal heading markers must never reach display, copy, speech, or AI context"
);
const italicBodyPage = renderPdfTextItems([
  {
    str: "The preceding body paragraph ends here.",
    transform: [11.04, 0, 0, 11.04, 72.024, 250],
    width: 220,
    height: 11.04,
    fontName: "g_body",
  },
  {
    str: "The same human refers instead to recurring pressures and dependence.",
    transform: [11.04, 0, 0, 11.04, 72.024, 210],
    width: 390,
    height: 11.04,
    fontName: "g_italic",
  },
  {
    str: "The ordinary body argument continues on the next line.",
    transform: [11.04, 0, 0, 11.04, 72.024, 175],
    width: 320,
    height: 11.04,
    fontName: "g_body",
  },
]);
assert.doesNotMatch(
  italicBodyPage,
  /[\uE100\uE101]/,
  "a full-line italic or alternate body font must not become a structural heading"
);
assert.equal(
  renderPdfTextItems([
    {
      str: "A real decimal 2024.11 stays exact.",
      transform: [11.04, 0, 0, 11.04, 72.024, 373.49],
      width: 180,
      height: 11.04,
    },
  ]),
  "A real decimal 2024.11 stays exact.",
  "geometry extraction must not rewrite ordinary decimals"
);

// Speech normalization is generic only. Reported prose must reach the model
// unchanged instead of accumulating phrase-specific punctuation patches.
const reportedProse =
  "Dependence would have been difficult. People who lived there, and people inside modern states, must not become silent.";
assert.equal(normalizeLocalSpeechText(reportedProse), reportedProse);
assert.equal(
  normalizeEnglishNumbersForSpeech(
    "The study used 743 stations and 23,421 voters, with 7.4 million segments in 2017. The campaign reported $1.12 billion and $1.4 mil."
  ),
  "The study used seven hundred forty three stations and twenty three thousand four hundred twenty one voters, with seven point four million segments in twenty seventeen. The campaign reported one point one two billion dollars and one point four million dollars.",
  "rF AI must receive generic word forms for long numbers, grouped numbers, decimals, years, and scaled currency"
);
assert.equal(
  normalizeEnglishNumbersForSpeech("Version 1.0.41 keeps CO2 and MP3 unchanged."),
  "Version 1.0.41 keeps CO2 and MP3 unchanged.",
  "number normalization must not rewrite dotted versions or alphanumeric identifiers"
);
for (const exactPhrase of [
  "The long return to My Lai",
  "Some public officials treated his action against fellow Americans as the betrayal.",
  "The United States Army awarded Thompson, Andreotta, and Colburn the Soldier's Medal.",
  "The medal can be evidence of learning.",
  "Treat that praise as evidence.",
  "The later leaders who honored refusal.",
  "Armed men who belonged to him.",
]) {
  assert.equal(
    normalizeLocalSpeechText(exactPhrase),
    exactPhrase,
    `reported prose must reach rF AI unchanged: ${exactPhrase}`
  );
}

assert.deepEqual(
  buildLocalSpeechSegments(
    "It is part of an allotment machine, a kleroterion. Citizens placed identification tokens into its columns."
  ),
  [
    { text: "It is part of an allotment machine, a kleroterion", pauseAfterMs: 300 },
    { text: "Citizens placed identification tokens into its columns", pauseAfterMs: 300 },
  ],
  "terminal periods must never reach Supertonic and sentence pauses must be deterministic"
);
assert.deepEqual(
  buildLocalSpeechSegments("A real version 2024.11 remains exact. The U.S. Army continues."),
  [
    { text: "A real version two thousand twenty four point one one remains exact", pauseAfterMs: 300 },
    { text: "The U S Army continues", pauseAfterMs: 300 },
  ],
  "decimal values retain their meaning as words while initialism and sentence dots stay unspoken"
);
assert.equal(
  normalizeLocalSpeechText("In April 1963, by 11:30 p.m., 404 BCE was discussed; the work returned in 1998 and early 2003."),
  "In April nineteen sixty three, by eleven thirty p m, four hundred four B C E was discussed; the work returned in nineteen ninety eight and early two thousand three.",
  "years, times, and historical eras must be explicit word sequences for rF AI"
);
assert.equal(
  normalizeEnglishNumbersForSpeech("the 1920s, 1970s, and 2020s"),
  "the nineteen twenties, nineteen seventies, and twenty twenties"
);
assert.equal(
  normalizeEnglishNumbersForSpeech("Republic 536c-d, 359d-360b, and 188b"),
  "Republic five hundred thirty six C to D, three hundred fifty nine D to three hundred sixty B, and one hundred eighty eight B"
);
assert.deepEqual(
  buildLocalSpeechSegments("First contents entry\u2014Second contents entry\u2014Third entry"),
  [
    { text: "First contents entry", pauseAfterMs: 90 },
    { text: "Second contents entry", pauseAfterMs: 90 },
    { text: "Third entry", pauseAfterMs: 0 },
  ],
  "em-dash contents entries must become small deterministic local-AI clauses"
);
const longCommaSentence =
  "The committee reviewed testimony from every regional office and compared each statement with the archived evidence, while the independent investigators checked the names and dates against the complete public record before publishing their conclusions.";
const responsiveCommaSegments = buildLocalSpeechSegments(longCommaSentence);
assert.ok(
  responsiveCommaSegments.length >= 2 &&
    responsiveCommaSegments[0].pauseAfterMs === 85 &&
    responsiveCommaSegments.every((segment) => segment.text.length <= 190),
  "a long comma-delimited sentence must create responsive natural clauses"
);
assert.deepEqual(
  responsiveCommaSegments.flatMap((segment) => segment.text.match(/[\p{L}\p{N}]+/gu) || []),
  normalizeLocalSpeechText(longCommaSentence).match(/[\p{L}\p{N}]+/gu) || [],
  "responsive clause rendering must preserve every lexical token"
);

const abbreviationSentence =
  `${"A long clause safely approaches the audio boundary without punctuation ".repeat(15)}` +
  "Dr. Thompson continued through the real end of the sentence. A later sentence waits.";
const abbreviationRows = TextReflow.buildSentences([
  { page: 13, source: "native", text: abbreviationSentence },
]);
let abbreviationIndex = 0;
let abbreviationOffset = 0;
const abbreviationClips = [];
for (let guard = 0; guard < 10 && abbreviationIndex < abbreviationRows.length; guard++) {
  const chunk = buildSpeechChunk(abbreviationIndex, abbreviationRows, {
    mode: "local",
    pageCap: 300,
    firstOffset: abbreviationOffset,
  });
  assert.ok(chunk);
  abbreviationClips.push(chunk.text);
  abbreviationIndex = chunk.nextIndex;
  abbreviationOffset = chunk.nextOffset;
}
assert.equal(abbreviationClips.join(" "), abbreviationSentence);
assert.ok(
  abbreviationClips.every((clip) => !/Dr\.$/.test(clip)),
  "a title abbreviation near a safety split must not become a false sentence boundary"
);

const manuscriptPage43 = TextReflow.buildSentences([
  {
    page: 43,
    source: "native",
    text:
      "People who lived under emperors were not simple believers in emperors, and people inside\n" +
      "modern states are not identical with their governments. The powerful write in the language of\n" +
      "national unity. Human life is written in smaller and less obedient sentences.\n" +
      "Loyalty that refuses\n" +
      "In April 1963, Martin Luther King Jr. sat in a jail cell in Birmingham, Alabama.",
  },
]);
const loyaltyHeading = manuscriptPage43.find((row) => row.text === "Loyalty that refuses");
assert.equal(loyaltyHeading?.kind, "heading", "page-43 sentence-case title must remain a heading");
assert.equal(
  manuscriptPage43.find((row) => row.text.startsWith("People who lived"))?.kind,
  "body",
  "page-43 body text must not become a heading"
);

const manuscriptPage47 = TextReflow.buildSentences([
  {
    page: 47,
    source: "native",
    text:
      "A democracy becomes vulnerable when it treats that lost uncertainty as proof that every earlier inequality does not matter.\n\n" +
      "Whoever owns the window\n\n" +
      "News does not need to be fabricated in order to serve power. More events occur each day than any outlet can carry.",
  },
]);
assert.equal(
  manuscriptPage47.find((row) => row.text === "Whoever owns the window")?.kind,
  "heading",
  "an isolated sentence-case page-47 title must retain heading structure"
);

const manuscriptPage48 = TextReflow.buildSentences([
  {
    page: 48,
    source: "native",
    text:
      "The citizen may remain honest throughout. That is why honesty alone cannot solve an architecture of attention.\n\n" +
      "Measurement, ranking, and the crowd\n\n" +
      "Before an election, polls are reported as measurements of public opinion.",
  },
]);
assert.equal(
  manuscriptPage48.find((row) => row.text === "Measurement, ranking, and the crowd")?.kind,
  "heading",
  "legacy cached extracts must recover isolated sentence-case headings even when they contain commas"
);
assert.equal(
  manuscriptPage47.find((row) => row.text.startsWith("A democracy becomes"))?.kind,
  "body",
  "the body paragraph before an isolated title must remain body text"
);

const localVoiceSource = fs.readFileSync(path.join(root, "src/services/LocalNeuralVoice.ts"), "utf8");
assert.match(
  localVoiceSource,
  /sherpa-onnx-supertonic-3-tts-int8-2026-05-11/,
  "Android rF AI must use the Supertonic 3 model"
);
const androidRuntimeTag = fs
  .readFileSync(
    path.join(root, "node_modules/react-native-sherpa-onnx/third_party/sherpa-onnx-prebuilt/ANDROID_RELEASE_TAG"),
    "utf8"
  )
  .trim();
assert.equal(androidRuntimeTag, "sherpa-onnx-android-v1.13.2-1");
const dependencyPatch = fs.readFileSync(
  path.join(root, "patches/react-native-sherpa-onnx+0.4.3.patch"),
  "utf8"
);
assert.match(dependencyPatch, /sherpa-onnx-android-v1\.13\.2-1/);

// A revised PDF with the same filename and page count must never receive the
// old edition's parsed-text cache. The exact source bytes now lead every new id,
// and OCR merging rejects any different document identity.
const documentIdentitySource = fs.readFileSync(
  path.join(root, "src/services/DocumentIdentity.ts"),
  "utf8"
);
assert.match(documentIdentitySource, /getInfoAsync\(uri, \{ md5: true \}\)/);
assert.match(documentIdentitySource, /`rf2:\$\{fingerprint\}:\$\{fileName\}:\$\{pageCount\}`/);
const pdfParserSource = fs.readFileSync(path.join(root, "src/services/PDFParser.ts"), "utf8");
assert.match(pdfParserSource, /contentDocumentId\(fileName, data\.pageCount, sourceFingerprint\)/);
const docCacheSource = fs.readFileSync(path.join(root, "src/services/DocCache.ts"), "utf8");
assert.match(docCacheSource, /cached\.docId !== fresh\.docId/);

const readerSource = fs.readFileSync(path.join(root, "src/components/Reader.tsx"), "utf8");
const controlsSource = fs.readFileSync(path.join(root, "src/components/Controls.tsx"), "utf8");
assert.match(
  readerSource,
  /const LOCAL_AI_PREFETCH_AHEAD = 1;/,
  "rF AI must queue only one future native render"
);
assert.match(readerSource, /openLocalVoiceSetupNotice/);
assert.match(readerSource, /voice pack itself does not require registration or a subscription purchase/);
assert.match(readerSource, /<ThemedNotice[\s\S]*visible=\{Boolean\(readerNotice\)\}/);
assert.match(readerSource, /function keepActiveLineVisible/);
assert.match(readerSource, /viewOffset: targetY - lineY/);
assert.match(
  readerSource,
  /function toggleFollow[\s\S]*isUserScrollingRef\.current = false[\s\S]*keepActiveLineVisible/,
  "turning Follow back on must clear a stale manual-scroll guard and re-anchor immediately"
);
assert.match(
  readerSource,
  /recoverTtsProvider\(speakingProvider\)[\s\S]*failedProvider\.dispose[\s\S]*createTTSProvider/,
  "a failed rF AI player pool must be disposed and recreated before retry"
);
assert.match(
  readerSource,
  /reflowPositionBeforeOriginalRef[\s\S]*originalPageRef[\s\S]*leaveOriginalView/,
  "Original and reflow must keep separate page/position anchors"
);
assert.match(
  readerSource,
  /setOriginalMounted\(true\)[\s\S]*pointerEvents=\{showOriginal \? "none" : "auto"\}[\s\S]*originalMounted/,
  "Original and reflow PDF surfaces must remain mounted across view switches"
);
assert.match(
  readerSource,
  /if \(showOriginalRef\.current\) return;/,
  "stale reflow viewability callbacks must not overwrite the Original page"
);
assert.match(
  controlsSource,
  /Theme[\s\S]*\["system", "light", "dark"\][\s\S]*setThemeMode/,
  "reader settings must expose System, Light, and Dark appearance controls"
);
assert.match(
  readerSource,
  /const VisualPdfPage = React\.memo[\s\S]*const source = useMemo[\s\S]*visualPdfStyles\.pdf/,
  "retained visual PDF pages must be isolated from theme-driven reader rerenders"
);
assert.match(readerSource, /style=\{styles\.pageNavAi\}/);
assert.doesNotMatch(readerSource, /styles\.aiFab/);
assert.match(readerSource, /textIntelligence\.prepare\(input\)/);
assert.match(readerSource, /sourceOffsetForSpeech\(speech\.intelligence, spokenOffset\)/);
assert.match(readerSource, /allowOnlineFallback: false/);
assert.doesNotMatch(readerSource, /TITLE_CUES|titleCueFor/);
assert.match(readerSource, /renderTokenText\(tokens, 0, highlightedRange\)/);
assert.match(readerSource, /voiceMode !== "local"[\s\S]*advance\(\)[\s\S]*rF AI paused/);
assert.match(readerSource, /sessionSpeedRef\.current = settingsRef\.current\.speed/);
assert.match(readerSource, /<Pdf[\s\S]*source=\{\{ uri: doc\.sourceUri, cache: true \}\}/);
assert.match(readerSource, /controlsShown && !showOriginal/);
assert.match(
  readerSource,
  /function navigatePage[\s\S]*if \(showOriginalRef\.current\)[\s\S]*setOriginalPage\(target\)[\s\S]*setCurrentPage\(target\)/,
  "Original PDF navigation must show scanned and image pages without invoking OCR gates"
);
assert.match(readerSource, /onPress=\{\(\) => navigatePage\(currentPage [+-] 1\)\}/g);
const viewabilitySection = readerSource.slice(
  readerSource.indexOf("const onViewableItemsChanged"),
  readerSource.indexOf("function onScrollToIndexFailed")
);
assert.doesNotMatch(
  viewabilitySection,
  /pendingBackwardSeedRef/,
  "restoring a saved page must not automatically prepend earlier rows and shift the viewport"
);
const scrollBeginSection = readerSource.slice(
  readerSource.indexOf("function onReaderScrollBeginDrag"),
  readerSource.indexOf("async function speakAt")
);
assert.match(
  scrollBeginSection,
  /pendingBackwardSeedRef\.current[\s\S]*setWindowStart/,
  "earlier rows must remain available when the reader deliberately starts scrolling"
);
assert.doesNotMatch(
  readerSource,
  /function renderMeasuredLines/,
  "highlighting must decorate the authoritative paragraph instead of reconstructing native line fragments"
);

const localProviderSource = fs.readFileSync(
  path.join(root, "src/services/tts/LocalNeuralTTSProvider.ts"),
  "utf8"
);
const sherpaPatchSource = fs.readFileSync(
  path.join(root, "patches/react-native-sherpa-onnx+0.4.3.patch"),
  "utf8"
);
assert.match(localProviderSource, /LOCAL_TTS_ENGINE_SILENCE_SCALE = 0\.2/);
assert.match(localProviderSource, /LOCAL_TTS_SEGMENT_SILENCE_SCALE = 0/);
assert.match(localProviderSource, /silenceScale: LOCAL_TTS_ENGINE_SILENCE_SCALE/);
assert.match(localProviderSource, /silenceScale: LOCAL_TTS_SEGMENT_SILENCE_SCALE/);
assert.match(localProviderSource, /LOCAL_TTS_RENDER_VERSION = "segments0\.6"/);
assert.match(localProviderSource, /LOCAL_TTS_HANDOFF_LEAD_SECONDS = 0\.05/);
assert.match(localProviderSource, /LOCAL_TTS_MAX_PLAYER_COUNT = 2/);
assert.match(localProviderSource, /extra: \{ lang: "en" \}/);
assert.match(
  sherpaPatchSource,
  /options\?\.hasKey\("extra"\) == true[\s\S]*generateWithConfig\(text, config\)/,
  "the Android bridge must pass the rF AI language hint into native Supertonic generation"
);
assert.match(localProviderSource, /generateSpeechSegment/);
assert.match(localProviderSource, /await playSegment\(0\)/);
assert.match(localProviderSource, /textRatio:/);
assert.match(localProviderSource, /armPlaybackWatchdog/);
assert.match(localProviderSource, /rF AI audio stopped responding/);
assert.match(
  localProviderSource,
  /prepareStandby\(index \+ 1\)/,
  "rF AI must prepare the next audio player while the current segment is playing"
);
assert.match(
  localProviderSource,
  /takeStandbyPlayer\(index, result\.uri, mySeq\)/,
  "rF AI must consume the prepared player instead of recreating it at handoff"
);
assert.equal(
  (localProviderSource.match(/createAudioPlayer\(/g) || []).length,
  1,
  "rF AI must allocate players only through its bounded pool"
);
assert.match(
  localProviderSource,
  /this\.playerPool\.size >= LOCAL_TTS_MAX_PLAYER_COUNT/,
  "rF AI must refuse to exceed its two native players"
);
assert.match(
  localProviderSource,
  /this\.recyclePlayer\(outgoingPlayer\)/,
  "rF AI must recycle the outgoing player instead of allocating one player per clip"
);
assert.match(
  readerSource,
  /pause\.reason !== "sentence"/,
  "ordinary sentence punctuation must not receive a second structural pause"
);
assert.match(
  localProviderSource,
  /generationEpoch\+\+;/,
  "Stop and pause must invalidate queued local synthesis"
);
assert.match(
  localProviderSource,
  /await engine\?\.destroy\(\)\.catch/,
  "disposing rF AI must release its native model"
);
assert.match(
  readerSource,
  /if \(provider\.dispose\) void provider\.dispose\(\);/,
  "leaving the reader must dispose native voice providers"
);

assert.match(
  pdfParserSource,
  /Object\.assign\(new Error\(msg\),[\s\S]*code,[\s\S]*status: xhr\.status,[\s\S]*feature/,
  "multipart import errors must retain quota code/status/feature"
);
const librarySource = fs.readFileSync(path.join(root, "src/screens/LibraryScreen.tsx"), "utf8");
const themeSource = fs.readFileSync(path.join(root, "src/theme.ts"), "utf8");
const appSource = fs.readFileSync(path.join(root, "App.tsx"), "utf8");
const backgroundPlaybackSource = fs.readFileSync(
  path.join(root, "src/services/BackgroundPlaybackService.ts"),
  "utf8"
);
assert.match(themeSource, /type ThemeMode = "system" \| "light" \| "dark"/);
assert.match(themeSource, /AsyncStorage\.setItem\(STORAGE_KEY, next\)/);
assert.match(librarySource, /\["system", "light", "dark"\]/);
assert.match(appSource, /entitlementForRevenueCatTier\(purchasedTier\)/);
assert.match(readerSource, /setBackgroundPlaybackActive\(isPlaying && backgroundPlaybackAllowed\)/);
assert.match(backgroundPlaybackSource, /foregroundServiceType: \["mediaPlayback"\]/);
assert.match(backgroundPlaybackSource, /while \(BackgroundService\.isRunning\(\)\)/);
assert.match(
  librarySource,
  /if \(isQuotaError\(e\)\) \{[\s\S]*Monthly document limit reached[\s\S]*setUpgrade/,
  "document quota failures must open the plan sheet instead of ending at an error string"
);

console.log("Reader regression checks passed.");
