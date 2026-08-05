import { Platform } from "react-native";
import BackgroundService, {
  type BackgroundTaskOptions,
} from "react-native-background-actions";

const TASK_OPTIONS: BackgroundTaskOptions = {
  taskName: "readFlowPlayback",
  taskTitle: "readFlow",
  taskDesc: "Read-aloud is playing",
  taskIcon: { name: "ic_launcher", type: "mipmap" },
  color: "#D95D39",
  foregroundServiceType: ["mediaPlayback"],
};

let shouldRun = false;
let transition: Promise<void> = Promise.resolve();

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function keepJavascriptAvailable(): Promise<void> {
  while (BackgroundService.isRunning()) {
    await sleep(1000);
  }
}

async function applyDesiredState(): Promise<void> {
  if (Platform.OS !== "android") return;

  if (shouldRun) {
    if (!BackgroundService.isRunning()) {
      await BackgroundService.start(keepJavascriptAvailable, TASK_OPTIONS);
    }
    return;
  }

  if (BackgroundService.isRunning()) {
    await BackgroundService.stop();
  }
}

/** Keeps Android's JS runtime available while generated audio crosses clip boundaries. */
export function setBackgroundPlaybackActive(active: boolean): Promise<void> {
  shouldRun = active;
  transition = transition.then(applyDesiredState, applyDesiredState).catch((error) => {
    console.warn("Background playback service could not change state", error);
  });
  return transition;
}
