import fs from "node:fs";
import path from "node:path";

const mobileDir = path.resolve(process.cwd());
const repoRoot = path.resolve(mobileDir, "..");

const appJsonPath = path.join(mobileDir, "app.json");
const easJsonPath = path.join(mobileDir, "eas.json");
const androidDirPath = path.join(mobileDir, "android");
const iosDirPath = path.join(mobileDir, "ios");
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
const ios = expo.ios || {};
const extra = expo.extra || {};
const easJson = JSON.parse(readUtf8(easJsonPath));
const EXPECTED_VERSION = "1.0.25";
const EXPECTED_ANDROID_VERSION_CODE = 25;
const EXPECTED_IOS_BUILD_NUMBER = "25";
const EXPECTED_API_URL = "https://readflow-backend-internal.onrender.com";

// 0) This repo releases as a managed Expo app. A local generated android/
// directory makes EAS ignore android.package/versionCode from app.json and can
// reintroduce stale permissions such as RECORD_AUDIO.
if (fs.existsSync(androidDirPath)) {
  fail("mobile/android exists. Move or remove the generated native directory before EAS release builds.");
} else {
  pass("No local Android native directory will override app.json");
}
if (fs.existsSync(iosDirPath)) {
  fail("mobile/ios exists. Move or remove the generated native directory before EAS iOS release builds.");
} else {
  pass("No local iOS native directory will override app.json");
}

// 1) applicationId
if (android.package === "com.urmiaworks.readflow") {
  pass("applicationId is com.urmiaworks.readflow");
} else {
  fail(`applicationId expected com.urmiaworks.readflow but got ${android.package || "(missing)"}`);
}

// 2) Android/iOS store identifiers and build numbers
if (android.versionCode === EXPECTED_ANDROID_VERSION_CODE) {
  pass(`Android versionCode is ${EXPECTED_ANDROID_VERSION_CODE}`);
} else {
  fail(`Android versionCode expected ${EXPECTED_ANDROID_VERSION_CODE} but got ${String(android.versionCode)}`);
}

if (ios.bundleIdentifier === "com.urmiaworks.readflow") {
  pass("iOS bundleIdentifier is com.urmiaworks.readflow");
} else {
  fail(`iOS bundleIdentifier expected com.urmiaworks.readflow but got ${ios.bundleIdentifier || "(missing)"}`);
}

if (String(ios.buildNumber || "") === EXPECTED_IOS_BUILD_NUMBER) {
  pass(`iOS buildNumber is ${EXPECTED_IOS_BUILD_NUMBER}`);
} else {
  fail(`iOS buildNumber expected ${EXPECTED_IOS_BUILD_NUMBER} but got ${String(ios.buildNumber || "(missing)")}`);
}

// 3) versionName
if (expo.version === EXPECTED_VERSION) {
  pass(`versionName is ${EXPECTED_VERSION}`);
} else {
  fail(`versionName expected ${EXPECTED_VERSION} but got ${expo.version || "(missing)"}`);
}

// 4) apiUrl points to the converted production Render service.
// Render kept the original onrender.com subdomain after the service was renamed
// from readflow-backend-internal to readflow-backend. Do not point public builds
// at readflow-backend.onrender.com unless that suspended legacy service is
// recovered or replaced.
const apiUrl = String(process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || "").trim();
if (/^https:\/\/.+\.onrender\.com\/?$/i.test(apiUrl)) {
  pass("apiUrl points to Render HTTPS URL");
} else {
  fail("apiUrl must be a non-empty Render HTTPS URL like https://<service>.onrender.com");
}
if (apiUrl.replace(/\/$/, "") === EXPECTED_API_URL) {
  pass("apiUrl points to the converted production Render service");
} else {
  fail(`apiUrl expected ${EXPECTED_API_URL}; do not use the suspended readflow-backend.onrender.com URL`);
}

// 5) appKey present (must match Render APP_KEY manually)
const appKey = String(process.env.EXPO_PUBLIC_APP_KEY || extra.appKey || "").trim();
if (appKey.length >= 16) {
  pass("appKey is set (verify it matches Render APP_KEY)");
} else {
  fail("appKey is missing/too short. Set expo.extra.appKey to the same APP_KEY used in Render");
}

// 6) Android permissions stay review-friendly for a reader app.
const permissions = Array.isArray(android.permissions) ? android.permissions : [];
const duplicatePermissions = permissions.filter((p, i) => permissions.indexOf(p) !== i);
if (duplicatePermissions.length === 0) {
  pass("Android permissions are not duplicated");
} else {
  fail(`Duplicate Android permissions: ${duplicatePermissions.join(", ")}`);
}
if (permissions.includes("android.permission.RECORD_AUDIO")) {
  fail("RECORD_AUDIO is present but readFlow does not record audio. Remove it before Play release.");
} else {
  pass("No Android microphone permission requested");
}
if (permissions.includes("com.android.vending.BILLING")) {
  pass("Google Play Billing permission is present for subscription builds");
} else {
  fail("Google Play Billing permission is missing. Subscription builds need com.android.vending.BILLING.");
}

function pluginConfig(name) {
  const plugins = Array.isArray(expo.plugins) ? expo.plugins : [];
  for (const plugin of plugins) {
    if (plugin === name) return {};
    if (Array.isArray(plugin) && plugin[0] === name) return plugin[1] || {};
  }
  return null;
}

const audioPlugin = pluginConfig("expo-audio");
if (audioPlugin && audioPlugin.recordAudioAndroid === false && audioPlugin.microphonePermission === false) {
  pass("expo-audio is configured without microphone access");
} else {
  fail("expo-audio must set recordAudioAndroid:false and microphonePermission:false for Play release");
}

const backgroundModes = ios.infoPlist?.UIBackgroundModes;
if (Array.isArray(backgroundModes) && backgroundModes.includes("audio")) {
  fail("iOS background audio mode is enabled even though readFlow is foreground-only");
} else {
  pass("No background-audio mode declared");
}
if (ios.infoPlist?.NSMicrophoneUsageDescription) {
  fail("iOS microphone usage description is present but readFlow does not record audio");
} else {
  pass("No iOS microphone usage description declared");
}
if (ios.infoPlist?.ITSAppUsesNonExemptEncryption === false) {
  pass("iOS export compliance declares no non-exempt encryption");
} else {
  fail("iOS infoPlist must set ITSAppUsesNonExemptEncryption:false for App Store export compliance");
}

// 7) EAS profiles should be explicit for both stores.
const internalProfile = easJson.build?.internal || {};
const productionProfile = easJson.build?.production || {};
if (internalProfile.distribution === "store" && internalProfile.ios?.simulator === false) {
  pass("EAS internal profile is configured for an iOS device App Store/TestFlight archive");
} else {
  fail("EAS internal profile must set distribution:store and ios.simulator:false for iOS TestFlight builds");
}
if (productionProfile.distribution === "store" && productionProfile.ios?.simulator === false) {
  pass("EAS production profile is configured for an iOS device App Store archive");
} else {
  fail("EAS production profile must set distribution:store and ios.simulator:false for iOS App Store builds");
}

// 8) OpenAI key not inside mobile app
const mobileSource = readUtf8(path.join(mobileDir, "src", "config.ts"));
if (/OPENAI_API_KEY|sk-[A-Za-z0-9]/.test(mobileSource)) {
  fail("Possible OpenAI key reference found in mobile source");
} else {
  pass("No OpenAI key reference in mobile config source");
}

// 9) Mobile sends an app-user id so public users do not share one anonymous quota bucket.
const identitySource = readUtf8(path.join(mobileDir, "src", "services", "AppIdentity.ts"));
if (/readflow:appUserId/.test(identitySource) && /x-app-user-id/.test(mobileSource)) {
  pass("Mobile sends a stable app-user id header for backend quotas");
} else {
  fail("Mobile must send x-app-user-id from a stable install identity before public release");
}

// 10) Public release config has ENTITLEMENTS_DEV_OVERRIDE=false
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
