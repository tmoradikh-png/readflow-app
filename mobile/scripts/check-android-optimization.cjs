const assert = require("node:assert/strict");
const fs = require("node:fs");
const { setReleaseProperties, optimizeBuildGradle } = require("../plugins/withAndroidReleaseOptimization");

const original = [{ type: "comment", value: "preserve" },
  { type: "property", key: "hermesEnabled", value: "true" },
  { type: "property", key: "android.enableMinifyInReleaseBuilds", value: "false" }];
const properties = setReleaseProperties(original);
assert.deepEqual(setReleaseProperties(properties), properties);
assert.equal(properties.find(item => item.key === "android.enableMinifyInReleaseBuilds").value, "true");
assert.equal(properties.find(item => item.key === "android.enableShrinkResourcesInReleaseBuilds").value, "true");
assert.deepEqual(properties.slice(0, 2), original.slice(0, 2));
for (const quote of ['"', "'"]) {
  const input = `proguardFiles getDefaultProguardFile(${quote}proguard-android.txt${quote}), ${quote}proguard-rules.pro${quote}`;
  const result = optimizeBuildGradle(input);
  assert.match(result, /proguard-android-optimize\.txt/);
  assert.match(result, /"readflow-release\.pro"/);
  assert.deepEqual(optimizeBuildGradle(result), result);
}
assert.throws(() => optimizeBuildGradle("unexpected template"));
assert.throws(() => optimizeBuildGradle('getDefaultProguardFile("proguard-android.txt")'));
const rules = fs.readFileSync("native/readflow-release.pro", "utf8");
assert.match(rules, /com\.k2fsa\.sherpa\.onnx/);
assert.match(rules, /java\.lang\.Integer invoke\(float\[\]\)/);
assert.match(rules, /-keep\s+@interface\s+expo\.modules\.kotlin\.records\.Field\s*\{\s*\*;\s*\}/);
assert.doesNotMatch(rules, /-dont(?:obfuscate|shrink|optimize)\b/);
const importer = fs.readFileSync("native/readflow-offline/android/src/main/java/com/urmiaworks/readflow/offline/ReadFlowOfflineModule.java", "utf8");
assert.doesNotMatch(importer, /resources\.getXObject\(|new PDImageXObject/);
assert.match(importer, /6000000\.0/);
const reader = fs.readFileSync("src/components/Reader.tsx", "utf8");
assert.match(reader, /paddingLeft: insets\.left, paddingRight: insets\.right/);
assert.doesNotMatch(reader, /<ExpoStatusBar[^>]*(backgroundColor|translucent)=/);
console.log("Android release optimization configuration checks passed (not device QA).");
