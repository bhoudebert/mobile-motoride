import { Platform, StatusBar } from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";

/** What an iPhone with a notch needs when the system cannot say (a build without the native module): the smallest cut-out. */
const IOS_FALLBACK = 47;

const iosTop = (): number => {
  try {
    return initialWindowMetrics?.insets.top ?? IOS_FALLBACK;
  } catch {
    return IOS_FALLBACK;
  }
};

/**
 * Room to leave at the top of a screen for the system: the status bar on Android, the notch or Dynamic Island on iOS, where
 * `StatusBar.currentHeight` does not exist and a button put at the top is under the camera (spec ride-navigation).
 */
export const TOP_INSET = Platform.OS === "ios" ? iosTop() : (StatusBar.currentHeight ?? 0);
