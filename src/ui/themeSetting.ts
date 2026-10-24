import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import { DEFAULT_THEME_SETTING, isThemeSetting, resolveScheme, type Scheme, type ThemeSetting } from "../core/theme.ts";
import { getScheme, onScheme, setScheme } from "./theme.ts";

const KEY = "theme";

const apply = (setting: ThemeSetting): void => setScheme(resolveScheme(setting, Appearance.getColorScheme()));

// The phone's look from the first frame, before the stored choice is read.
apply(DEFAULT_THEME_SETTING);

/**
 * The look choice: System until the stored one is read, applied to the whole app at once and kept when it changes (spec
 * appearance). System follows the phone, also while the app runs (day to night). `ready` turns true once the stored choice is
 * in force, so the first screen is not drawn twice.
 */
export function useThemeSetting(): { setting: ThemeSetting; change: (next: ThemeSetting) => void; ready: boolean } {
  const [setting, setSetting] = useState<ThemeSetting>(DEFAULT_THEME_SETTING);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY)
      .then((stored) => {
        if (live && isThemeSetting(stored)) {
          setSetting(stored);
          apply(stored);
        }
      })
      .catch(() => {})
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => apply(setting));
    return () => sub.remove();
  }, [setting]);
  const change = (next: ThemeSetting) => {
    setSetting(next);
    apply(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  };
  return { setting, change, ready };
}

/** The look in use; a component that calls it is drawn again when it changes. */
export const useScheme = (): Scheme => useSyncExternalStore(onScheme, getScheme, getScheme);
