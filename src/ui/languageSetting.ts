import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_LANGUAGE_SETTING,
  getLanguage,
  isLanguageSetting,
  onLanguage,
  resolveLanguage,
  setLanguage,
  type Language,
  type LanguageSetting,
} from "../core/i18n/index.ts";

const KEY = "language";

/** The phone's language as a locale tag ("fr-FR"), read without a native module (ADR 0032). */
export const phoneLocale = (): string => {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return "en";
  }
};

const apply = (setting: LanguageSetting): void => setLanguage(resolveLanguage(setting, phoneLocale()));

// The phone's language from the first frame, before the stored choice is read.
apply(DEFAULT_LANGUAGE_SETTING);

/**
 * The language choice: System until the stored one is read, applied to the whole app at once and kept when it changes
 * (spec languages). `ready` turns true once the stored choice is in force, so the first screen is not drawn twice.
 */
export function useLanguageSetting(): {
  setting: LanguageSetting;
  change: (next: LanguageSetting) => void;
  ready: boolean;
} {
  const [setting, setSetting] = useState<LanguageSetting>(DEFAULT_LANGUAGE_SETTING);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY)
      .then((stored) => {
        if (live && isLanguageSetting(stored)) {
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
  const change = (next: LanguageSetting) => {
    setSetting(next);
    apply(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  };
  return { setting, change, ready };
}

/** The language in use; a component that calls it is drawn again when it changes. */
export const useLanguage = (): Language => useSyncExternalStore(onLanguage, getLanguage, getLanguage);
