import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { DEFAULT_VOICE, isVoiceMode, type VoiceMode } from "../core/voice.ts";

const KEY = "voice-mode";

/** The voice mode: Full until the stored one is read, and kept when it changes (spec voice-guidance). */
export function useVoiceMode(): [VoiceMode, (mode: VoiceMode) => void] {
  const [mode, setMode] = useState<VoiceMode>(DEFAULT_VOICE);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY)
      .then((stored) => {
        if (live && isVoiceMode(stored)) setMode(stored);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const change = (next: VoiceMode) => {
    setMode(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  };
  return [mode, change];
}
