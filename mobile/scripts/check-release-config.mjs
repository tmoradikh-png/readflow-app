import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const { expo } = JSON.parse(read("app.json"));
const eas = JSON.parse(read("eas.json"));
const pkg = JSON.parse(read("package.json"));
const qa = process.argv.includes("--qa");
function check(ok, message) {
  console.log(`${ok ? "OK" : "FAIL"}: ${message}`);
  if (!ok) process.exitCode = 1;
}
function plugin(name) {
  return expo.plugins.find(value => Array.isArray(value) && value[0] === name)?.[1];
}

check(expo.version === "1.0.69" && expo.android.versionCode === 76, "Candidate is 1.0.69 (76)");
check(expo.android.package === "com.urmiaworks.readflow", "Android package unchanged");
check(expo.extra.eas.projectId === "097b0b5a-db90-46b4-b434-60836687b429", "Existing EAS project");
check(["apiUrl", "appKey", "revenueCatAndroidApiKey", "revenueCatIosApiKey"].every(key => !(key in expo.extra)),
  "No server or subscription configuration in the app");
check(!pkg.dependencies["react-native-purchases"] && pkg.dependencies["readflow-offline"],
  "Direct optional support billing and local document processing");
check(read(".gitignore").split(/\r?\n/).includes("/android"), "Generated Android build tree is excluded from EAS/Git");
check(!fs.existsSync(path.join(root, ".easignore")), "No separate EAS ignore file overrides source exclusions");

const permissions = expo.android.permissions;
check(new Set(permissions).size === permissions.length, "No duplicate Android permissions");
for (const name of ["android.permission.FOREGROUND_SERVICE", "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK", "com.android.vending.BILLING"]) {
  check(permissions.includes(name), `Required permission: ${name}`);
}
for (const name of ["android.permission.RECORD_AUDIO", "android.permission.FOREGROUND_SERVICE_MICROPHONE"]) {
  check(!permissions.includes(name) && expo.android.blockedPermissions.includes(name), `Unused permission blocked: ${name}`);
}
const audio = plugin("expo-audio");
check(audio?.recordAudioAndroid === false && audio?.microphonePermission === false, "No microphone access");
check(expo.plugins.includes("./plugins/withAndroidReleaseManifestCleanup"), "Release manifest cleanup enabled");
check(expo.plugins.includes("./plugins/withSherpaCodegenGradleFix"), "Existing rF AI native build fix retained");

const ads = plugin("react-native-google-mobile-ads");
check(ads?.androidAppId === "ca-app-pub-5199768562686629~3386452834", "Registered AdMob Android app");
check(ads?.delayAppMeasurementInit === true, "Ad measurement delayed until consent");
check(expo.extra.admobBannerId === "ca-app-pub-5199768562686629/1338873995", "Registered library banner");
check(qa || expo.extra.adsTestMode === false, "Production requires deliberate live-ad configuration after QA");
check(!qa || expo.extra.adsTestMode === true, "QA must use test ads");
const adSource = read("src/components/LibraryAds.tsx");
check(/AdsConsent\.requestInfoUpdate/.test(adSource) && /info\.canRequestAds/.test(adSource)
  && /showPrivacyOptionsForm/.test(adSource), "Consent and privacy choices are wired");
check(!/Interstitial|AppOpenAd|RewardedAd/.test(adSource), "No interrupting ad formats");
check(!/LibraryAds|BannerAd|mobileAds/.test(read("src/components/Reader.tsx")), "No ads in the reader");

for (const name of ["internal", "production"]) {
  const profile = eas.build[name];
  check(profile.distribution === "store" && profile.android.buildType === "app-bundle", `${name} produces an AAB`);
  check(profile.autoIncrement === false, `${name} keeps the reviewed version code`);
}
const importer = read("src/services/PDFParser.ts");
check(/NativeModules\.ReadFlowOffline/.test(importer) && !/fetch\(|XMLHttpRequest|axios/.test(importer),
  "Document import uses the on-device engine");
const app = read("App.tsx");
check(/const entitlement = FREE_ENTITLEMENT/.test(app) && !/RevenueCat|purchaseTier|restorePurchases|fetch\(/.test(app),
  "Reading does not depend on subscriptions or a backend");
const billing = read("native/readflow-offline/android/src/main/java/com/urmiaworks/readflow/offline/ReadFlowSupportModule.java");
check(/readflow_support_1/.test(billing) && !/ProductType\.SUBS/.test(billing)
  && /consumeAsync/.test(billing), "Optional support uses a consumable one-time product");
check(!/sk-[a-zA-Z0-9]{16,}/.test(JSON.stringify(expo)), "No OpenAI secret in the app configuration");

if (process.exitCode) console.error("Configuration checks failed. Do not submit.");
else console.log("Configuration checks passed. Native/device QA and store/account checks are still required.");
