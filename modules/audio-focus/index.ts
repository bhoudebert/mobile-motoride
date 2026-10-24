import { requireOptionalNativeModule } from "expo-modules-core";

interface AudioFocusModule {
  requestDuck(): boolean;
  abandon(): boolean;
}

// Not in the dev build until it is rebuilt with this module, and not in tests or on a phone without it: then there is nothing to lower.
const native = requireOptionalNativeModule<AudioFocusModule>("MotoRideAudioFocus");

/** Ask Android to lower other audio (music, a podcast) while the voice speaks; false when it did not or cannot. */
export const requestDuck = (): boolean => {
  try {
    return native?.requestDuck() ?? false;
  } catch {
    return false;
  }
};

/** Let the other audio come back to full volume. */
export const abandon = (): boolean => {
  try {
    return native?.abandon() ?? false;
  } catch {
    return false;
  }
};
