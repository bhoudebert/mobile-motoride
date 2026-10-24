import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { addRecent, parseRecents, type Recent } from "../core/recents.ts";

const KEY = "recents";

/** The recent rides, newest first, kept between launches (spec home-screen). */
export function useRecents() {
  const [recents, setRecents] = useState<Recent[]>([]);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((text) => alive && setRecents(parseRecents(text)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const save = (list: Recent[]) => AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
  const remember = useCallback((entry: Recent) => {
    // Written from what is on the phone, so a ride remembered right before leaving the screen is not lost.
    return AsyncStorage.getItem(KEY)
      .then((text) => addRecent(parseRecents(text), entry))
      .catch(() => [entry])
      .then((list) => {
        setRecents(list);
        return save(list);
      });
  }, []);
  const clear = useCallback(() => {
    setRecents([]);
    return AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);
  return { recents, remember, clear };
}
