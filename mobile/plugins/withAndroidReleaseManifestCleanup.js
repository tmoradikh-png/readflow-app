const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");

const REMOVE_PERMISSIONS = new Set([
  "android.permission.RECORD_AUDIO",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.FOREGROUND_SERVICE_MICROPHONE",
]);

const LIBRARY_MANIFESTS = [
  "node_modules/expo-audio/android/src/main/AndroidManifest.xml",
  "node_modules/@kesha-antonov/react-native-background-downloader/android/src/main/AndroidManifest.xml",
];

const REMOVE_SERVICE_NAMES = [
  "expo.modules.audio.service.AudioRecordingService",
];

const STRIP_FOREGROUND_TYPE_SERVICE_NAMES = [
  "com.eko.ResumableDownloadService",
  "expo.modules.audio.service.AudioControlsService",
  "com.google.android.play.core.assetpacks.ExtractionForegroundService",
];

function cleanManifestText(text) {
  let cleaned = text;
  for (const permission of REMOVE_PERMISSIONS) {
    const escaped = permission.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(
      new RegExp(`\\s*<uses-permission[^>]+android:name="${escaped}"[^>]*(?:/>|>\\s*</uses-permission>)`, "g"),
      ""
    );
  }
  cleaned = cleaned.replace(
    /\s*<service\b(?=[^>]*android:name="\.service\.AudioRecordingService")[^>]*(?:\/>|>[\s\S]*?<\/service>)/g,
    ""
  );
  cleaned = cleaned.replace(/\s+android:foregroundServiceType="[^"]*"/g, "");
  return cleaned;
}

function cleanManifestFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const original = fs.readFileSync(filePath, "utf8");
  const cleaned = cleanManifestText(original);
  if (cleaned !== original) {
    fs.writeFileSync(filePath, cleaned);
  }
}

module.exports = function withAndroidReleaseManifestCleanup(config) {
  config = withDangerousMod(config, [
    "android",
    (config) => {
      for (const manifestPath of LIBRARY_MANIFESTS) {
        cleanManifestFile(path.join(config.modRequest.projectRoot, manifestPath));
      }
      return config;
    },
  ]);

  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = {
      ...(manifest.$ || {}),
      "xmlns:tools": "http://schemas.android.com/tools",
    };

    for (const key of ["uses-permission", "uses-permission-sdk-23"]) {
      if (Array.isArray(manifest[key])) {
        manifest[key] = manifest[key].filter((permission) => {
          const name = permission?.$?.["android:name"];
          return !REMOVE_PERMISSIONS.has(name);
        });
      }
    }
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    for (const permission of REMOVE_PERMISSIONS) {
      const alreadyDeclared = manifest["uses-permission"].some(
        (entry) => entry?.$?.["android:name"] === permission && entry?.$?.["tools:node"] === "remove"
      );
      if (!alreadyDeclared) {
        manifest["uses-permission"].push({
          $: {
            "android:name": permission,
            "tools:node": "remove",
          },
        });
      }
    }

    const application = manifest.application?.[0];
    if (Array.isArray(application?.service)) {
      application.service = application.service
        .filter((service) => service?.$?.["android:name"] !== "expo.modules.audio.service.AudioRecordingService")
        .map((service) => {
          if (service?.$?.["android:foregroundServiceType"]) {
            delete service.$["android:foregroundServiceType"];
          }
          return service;
        });
    }
    if (application) {
      application.service = application.service || [];
      for (const name of REMOVE_SERVICE_NAMES) {
        const alreadyDeclared = application.service.some(
          (service) => service?.$?.["android:name"] === name && service?.$?.["tools:node"] === "remove"
        );
        if (!alreadyDeclared) {
          application.service.push({
            $: {
              "android:name": name,
              "tools:node": "remove",
            },
          });
        }
      }
      for (const name of STRIP_FOREGROUND_TYPE_SERVICE_NAMES) {
        const alreadyDeclared = application.service.some(
          (service) => service?.$?.["android:name"] === name && service?.$?.["tools:remove"] === "android:foregroundServiceType"
        );
        if (!alreadyDeclared) {
          application.service.push({
            $: {
              "android:name": name,
              "tools:remove": "android:foregroundServiceType",
            },
          });
        }
      }
    }

    return config;
  });
};
