import { Platform } from "react-native";

export const LOCAL_NEURAL_MODEL_ID = "sherpa-onnx-supertonic-tts-int8-2026-03-06";
export const LOCAL_NEURAL_VOICE_ID = "supertonic-reader-int8";
export const LOCAL_NEURAL_MODEL_NAME = "Supertonic Reader";
export const LOCAL_NEURAL_MODEL_TYPE = "supertonic";
export const LOCAL_NEURAL_SPEAKER_ID = 0;
export const LOCAL_NEURAL_MODEL_SIZE_BYTES = Math.round(80.8 * 1024 * 1024);

export interface LocalNeuralVoiceStatus {
  supportedDevice: boolean;
  nativeAvailable: boolean;
  modelDownloaded: boolean;
  engineInstalled: boolean;
  modelId: string;
  modelName: string;
  modelSizeBytes: number;
  title: string;
  detail: string;
}

export interface LocalNeuralDownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percent: number;
  phase?: "downloading" | "extracting";
}

export function getLocalNeuralVoiceStatus(): LocalNeuralVoiceStatus {
  const supportedDevice = isSupportedDevice();

  return {
    supportedDevice,
    nativeAvailable: false,
    modelDownloaded: false,
    engineInstalled: false,
    modelId: LOCAL_NEURAL_MODEL_ID,
    modelName: LOCAL_NEURAL_MODEL_NAME,
    modelSizeBytes: LOCAL_NEURAL_MODEL_SIZE_BYTES,
    title: supportedDevice ? "Checking rF AI" : "Phone may be too old",
    detail: supportedDevice
      ? "Checking whether the native rF AI engine and voice model are ready on this phone."
      : "rF AI needs a newer phone. Phone voice still works on Reader Plus and higher without cloud AI cost.",
  };
}

export async function loadLocalNeuralVoiceStatus(): Promise<LocalNeuralVoiceStatus> {
  const supportedDevice = isSupportedDevice();
  const base = getLocalNeuralVoiceStatus();
  if (!supportedDevice) return base;

  try {
    const download = await import("react-native-sherpa-onnx/download");
    const category = download.ModelCategory.Tts;
    const downloaded = await download.isModelDownloadedByCategory(category, LOCAL_NEURAL_MODEL_ID);

    return buildStatus({
      supportedDevice,
      nativeAvailable: true,
      modelDownloaded: downloaded,
      modelSizeBytes: LOCAL_NEURAL_MODEL_SIZE_BYTES,
    });
  } catch {
    return buildStatus({
      supportedDevice,
      nativeAvailable: false,
      modelDownloaded: false,
      modelSizeBytes: LOCAL_NEURAL_MODEL_SIZE_BYTES,
    });
  }
}

export async function downloadLocalNeuralVoice(
  onProgress?: (progress: LocalNeuralDownloadProgress) => void
): Promise<LocalNeuralVoiceStatus> {
  if (!isSupportedDevice()) {
    throw new Error("This phone is below the minimum version for rF AI.");
  }

  const download = await import("react-native-sherpa-onnx/download");
  const category = download.ModelCategory.Tts;

  await download.refreshModelsByCategory(category, {
    cacheTtlMinutes: 60 * 24,
    maxRetries: 2,
  });

  await download.ensureModelByCategory(category, LOCAL_NEURAL_MODEL_ID, {
    deleteArchiveAfterExtract: true,
    onProgress: (progress) => {
      onProgress?.({
        bytesDownloaded: progress.bytesDownloaded,
        totalBytes: progress.totalBytes,
        percent: progress.percent,
        phase: progress.phase,
      });
    },
  });

  return loadLocalNeuralVoiceStatus();
}

export async function getLocalNeuralModelPath(): Promise<string> {
  const download = await import("react-native-sherpa-onnx/download");
  const path = await download.getLocalModelPathByCategory(
    download.ModelCategory.Tts,
    LOCAL_NEURAL_MODEL_ID
  );
  if (!path) {
    throw new Error("rF AI voice model is not downloaded.");
  }
  return path;
}

export function formatLocalModelSize(bytes = LOCAL_NEURAL_MODEL_SIZE_BYTES): string {
  const mb = bytes / (1024 * 1024);
  return `${Math.max(1, Math.round(mb))} MB`;
}

function isSupportedDevice(): boolean {
  if (Platform.OS === "ios") {
    return Number.parseInt(String(Platform.Version), 10) >= 13;
  }
  if (Platform.OS === "android") {
    return Number(Platform.Version) >= 24;
  }
  return false;
}

function buildStatus({
  supportedDevice,
  nativeAvailable,
  modelDownloaded,
  modelSizeBytes,
}: {
  supportedDevice: boolean;
  nativeAvailable: boolean;
  modelDownloaded: boolean;
  modelSizeBytes: number;
}): LocalNeuralVoiceStatus {
  const modelSize = formatLocalModelSize(modelSizeBytes);
  const engineInstalled = supportedDevice && nativeAvailable && modelDownloaded;
  let title = "rF AI";
  let detail = "";

  if (!supportedDevice) {
    title = "Phone may be too old";
    detail =
      "rF AI needs Android 7 or newer, or iOS 13 or newer. Phone voice still works on Reader Plus and higher without cloud AI cost.";
  } else if (!nativeAvailable) {
    title = "Needs the new app build";
    detail =
      "Install the next native build to enable rF AI. Phone voice still works on eligible plans.";
  } else if (!modelDownloaded) {
    title = "Download rF AI";
    detail = `Download ${LOCAL_NEURAL_MODEL_NAME} once (about ${modelSize}). It then reads on this phone with no OpenAI cost.`;
  } else {
    title = "Ready on this phone";
    detail = `${LOCAL_NEURAL_MODEL_NAME} is downloaded. It reads locally, uses battery and CPU, and has no cloud voice cost.`;
  }

  return {
    supportedDevice,
    nativeAvailable,
    modelDownloaded,
    engineInstalled,
    modelId: LOCAL_NEURAL_MODEL_ID,
    modelName: LOCAL_NEURAL_MODEL_NAME,
    modelSizeBytes,
    title,
    detail,
  };
}
