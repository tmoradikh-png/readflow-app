const fs = require("fs");
const path = require("path");
const { withAppBuildGradle, withGradleProperties } = require("@expo/config-plugins");

function setReleaseProperties(properties) {
  const values = {
    "android.enableMinifyInReleaseBuilds": "true",
    "android.enableShrinkResourcesInReleaseBuilds": "true",
  };
  const result = properties.filter(item => !(item.type === "property" && item.key in values));
  for (const [key, value] of Object.entries(values)) result.push({ type: "property", key, value });
  return result;
}

function optimizeBuildGradle(source) {
  const optimized = source.replace(/getDefaultProguardFile\(["']proguard-android(?:-optimize)?\.txt["']\)/g,
    'getDefaultProguardFile("proguard-android-optimize.txt")');
  if (!optimized.includes('getDefaultProguardFile("proguard-android-optimize.txt")')) {
    throw new Error("Android release template changed: cannot enable the optimizing R8 configuration.");
  }
  const rules = '"readflow-release.pro"';
  if (optimized.includes(rules)) return optimized;
  const result = optimized.replace(/(proguardFiles[^\r\n]*["']proguard-rules\.pro["'])/, `$1, ${rules}`);
  if (!result.includes(rules)) throw new Error("Cannot attach readFlow JNI keep rules to the release build");
  return result;
}

module.exports = function withAndroidReleaseOptimization(config) {
  config = withGradleProperties(config, mod => {
    mod.modResults = setReleaseProperties(mod.modResults);
    return mod;
  });
  return withAppBuildGradle(config, mod => {
    if (mod.modResults.language !== "groovy") throw new Error("Unsupported Android Gradle format");
    mod.modResults.contents = optimizeBuildGradle(mod.modResults.contents);
    fs.copyFileSync(path.join(mod.modRequest.projectRoot, "native/readflow-release.pro"),
      path.join(mod.modRequest.platformProjectRoot, "app/readflow-release.pro"));
    return mod;
  });
};

module.exports.setReleaseProperties = setReleaseProperties;
module.exports.optimizeBuildGradle = optimizeBuildGradle;
