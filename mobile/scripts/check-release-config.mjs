import fs from "node:fs";
import path from "node:path";

const mobileDir = path.resolve(process.cwd());
const repoRoot = path.resolve(mobileDir, "..");

const appJsonPath = path.join(mobileDir, "app.json");
const renderYamlPath = path.join(repoRoot, "render.yaml");
const backendRenderYamlPath = path.join(repoRoot, "backend", "render.yaml");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`OK: ${message}`);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

const appJson = JSON.parse(readUtf8(appJsonPath));
const expo = appJson.expo || {};
const android = expo.android || {};
const extra = expo.extra || {};

// 1) applicationId
if (android.package === "com.urmiaworks.readflow") {
  pass("applicationId is com.urmiaworks.readflow");
} else {
  fail(`applicationId expected com.urmiaworks.readflow but got ${android.package || "(missing)"}`);
}

// 2) versionCode
if (android.versionCode === 21) {
  pass("versionCode is 21");
} else {
  fail(`versionCode expected 21 but got ${String(android.versionCode)}`);
}

// 3) versionName
if (expo.version === "1.0.21") {
  pass("versionName is 1.0.21");
} else {
  fail(`versionName expected 1.0.21 but got ${expo.version || "(missing)"}`);
}

// 4) apiUrl points to Render HTTPS URL
const apiUrl = String(extra.apiUrl || "").trim();
if (/^https:\/\/.+\.onrender\.com\/?$/i.test(apiUrl)) {
  pass("apiUrl points to Render HTTPS URL");
} else {
  fail("apiUrl must be a non-empty Render HTTPS URL like https://<service>.onrender.com");
}

// 5) appKey present (must match Render APP_KEY manually)
const appKey = String(extra.appKey || "").trim();
if (appKey.length >= 16) {
  pass("appKey is set (verify it matches Render APP_KEY)");
} else {
  fail("appKey is missing/too short. Set expo.extra.appKey to the same APP_KEY used in Render");
}

// 6) OpenAI key not inside mobile app
const mobileSource = readUtf8(path.join(mobileDir, "src", "config.ts"));
if (/OPENAI_API_KEY|sk-[A-Za-z0-9]/.test(mobileSource)) {
  fail("Possible OpenAI key reference found in mobile source");
} else {
  pass("No OpenAI key reference in mobile config source");
}

// 7) Public release config has ENTITLEMENTS_DEV_OVERRIDE=false
function hasDevOverrideFalse(content) {
  return /-\s*key:\s*ENTITLEMENTS_DEV_OVERRIDE[\s\S]{0,120}?value:\s*"?false"?/m.test(content);
}

const renderYaml = readUtf8(renderYamlPath);
const backendRenderYaml = readUtf8(backendRenderYamlPath);

if (hasDevOverrideFalse(renderYaml) && hasDevOverrideFalse(backendRenderYaml)) {
  pass("Public release blueprints set ENTITLEMENTS_DEV_OVERRIDE=false");
} else {
  fail("Public release blueprint must set ENTITLEMENTS_DEV_OVERRIDE=false in render.yaml and backend/render.yaml");
}

if (process.exitCode) {
  console.error("\nRelease config check failed. Fix the items above before running EAS build.");
} else {
  console.log("\nRelease config check passed. Safe to proceed with build.");
}
