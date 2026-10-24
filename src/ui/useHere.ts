import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLon } from "../core/types.ts";

export type Here = { status: "locating" | "denied" | "unknown" | "ready"; pos: LatLon | null };

const LOCATE_TIMEOUT_MS = 8000;

/** Where the phone is, for the home screen: the last known position at once, then a fresh one (spec home-screen). */
export function useHere() {
  const [here, setHere] = useState<Here>({ status: "locating", pos: null });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const locate = useCallback(async () => {
    const set = (next: Here) => alive.current && setHere((h) => ({ ...next, pos: next.pos ?? h.pos }));
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return set({ status: "denied", pos: null });
      const known = await Location.getLastKnownPositionAsync().catch(() => null);
      if (known) set({ status: "ready", pos: [known.coords.latitude, known.coords.longitude] });
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
        new Promise<null>((r) => setTimeout(() => r(null), LOCATE_TIMEOUT_MS)),
      ]);
      if (fresh) set({ status: "ready", pos: [fresh.coords.latitude, fresh.coords.longitude] });
      else if (!known) set({ status: "unknown", pos: null });
    } catch {
      set({ status: "unknown", pos: null });
    }
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  return { here, locate };
}
