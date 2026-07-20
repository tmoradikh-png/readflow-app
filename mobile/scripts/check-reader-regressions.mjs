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
const { TextReflow } = textModule;
const { buildSpeechChunk } = speechModule;
const { normalizeLocalSpeechText } = normalizationModule;

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

assert.equal(splitPages.length, 4, "fixture should produce four visual sentence rows");
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
assert.equal(deviceBoundary.nextIndex, 3, "next speech starts after the page continuation");

const localBoundary = buildSpeechChunk(0, splitPages, {
  mode: "local",
  pageCap: 300,
});
assert.ok(localBoundary);
assert.equal(
  localBoundary.spans.length,
  3,
  "local buffer must include a page continuation even after its ordinary two-row buffer"
);
assert.match(localBoundary.text, /small community, dependence would have been/);

const completedPages = TextReflow.buildSentences([
  { page: 7, source: "native", text: "This sentence is complete." },
  { page: 8, source: "native", text: "A new sentence begins here." },
]);
const completedChunk = buildSpeechChunk(0, completedPages, { mode: "device", pageCap: 300 });
assert.equal(completedChunk?.spans.length, 1, "completed sentences must retain the page pause");

const marker = TextReflow.speechText("communities.2 The evidence", "body");
assert.equal(marker.text, "communities. The evidence", "footnote marker must stay silent");

const auxiliary = normalizeLocalSpeechText(
  "In a very small community, dependence would have been difficult to escape."
);
assert.match(auxiliary, /dependence would, have been/, "rF AI must articulate both auxiliary words");

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
const loyaltyHeading = manuscriptPage43.find((sentence) => sentence.text === "Loyalty that refuses");
assert.equal(loyaltyHeading?.kind, "heading", "page-43 sentence-case title must remain a heading");
assert.equal(
  manuscriptPage43.find((sentence) => sentence.text.startsWith("People who lived"))?.kind,
  "body",
  "page-43 body text must not become a heading"
);

const parallelClause = normalizeLocalSpeechText(
  "People who lived under emperors were not simple believers in emperors, and people inside modern states are not identical with their governments."
);
assert.match(parallelClause, /emperors; and people inside/, "rF AI must retain the page-43 conjunction");

const becomePhrase = normalizeLocalSpeechText(
  "Compassion for the person must not become innocence for the institution."
);
assert.match(becomePhrase, /must not, become innocence/, "rF AI must articulate all of become");

console.log("Reader regression checks passed.");
