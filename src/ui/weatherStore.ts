import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "weather";

/**
 * Weather on or off, kept when it changes (spec weather). Off asks nothing of the network, so nothing is asked before the stored
 * choice is known: `ready` turns true once it is read.
 */
export function useWeatherEnabled(): [boolean, (on: boolean) => void, boolean] {
  const [on, setOn] = useState(true);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY)
      .then((stored) => {
        if (live && stored === "off") setOn(false);
      })
      .catch(() => {})
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  const change = (next: boolean) => {
    setOn(next);
    AsyncStorage.setItem(KEY, next ? "on" : "off").catch(() => {});
  };
  return [on, change, ready];
}
