import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "traffic";

/**
 * Traffic on or off, kept when it changes (spec traffic). Off asks nothing of the server, so nothing is asked before the stored
 * choice is known: `ready` turns true once it is read.
 */
export function useTrafficEnabled(): [boolean, (on: boolean) => void, boolean] {
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
