import { Platform } from "react-native";

export interface LocalNeuralVoiceStatus {
  supportedDevice: boolean;
  engineInstalled: boolean;
  title: string;
  detail: string;
}

/**
 * Product path for a future offline neural TTS engine.
 *
 * Best current candidate: Kokoro via react-native-executorch. It needs native
 * modules, New Architecture, and a model/resource fetcher, so this Expo build
 * exposes the option honestly but keeps playback on stable device/cloud TTS.
 */
export function getLocalNeuralVoiceStatus(): LocalNeuralVoiceStatus {
  const supportedDevice =
    Platform.OS === "ios"
      ? Number.parseInt(String(Platform.Version), 10) >= 17
      : Platform.OS === "android"
        ? Number(Platform.Version) >= 33
        : false;

  return {
    supportedDevice,
    engineInstalled: false,
    title: supportedDevice ? "Phone looks compatible" : "Phone may be too old",
    detail: supportedDevice
      ? "Offline AI voice needs the native Kokoro/ExecuTorch engine in a future build. It will use battery and CPU but no cloud allowance."
      : "Offline AI voice needs a newer phone. Device voice still works without any ReadFlow cost.",
  };
}
