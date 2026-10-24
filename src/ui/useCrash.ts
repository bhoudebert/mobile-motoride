import { Accelerometer } from "expo-sensors";
import { useEffect, useRef } from "react";
import { CrashDetector } from "../core/crash.ts";
import { useAlertFlow } from "./useAlertFlow.ts";

const SENSOR_MS = 50;

/**
 * Watches a ride on the phone's GPS for a crash (spec crash-detection, ADR 0039): the accelerometer and the GPS speed go to the
 * detector, and what it finds starts the alert. Only while `watching`: detection is on and a real ride is running.
 * `tellFollowers` and `clearFollowers` are the live share's alert; they say whether anyone was told.
 */
export function useCrash(options: {
  watching: boolean;
  speedMps: number | null;
  tellFollowers: () => boolean;
  clearFollowers: () => void;
}) {
  const { watching, speedMps, tellFollowers, clearFollowers } = options;
  const flow = useAlertFlow(tellFollowers, clearFollowers);
  const speed = useRef(speedMps);
  speed.current = speedMps;
  const startRef = useRef(flow.start);
  startRef.current = flow.start;
  const busy = useRef(false);
  busy.current = flow.alert !== null;

  useEffect(() => {
    if (!watching) return;
    const detector = new CrashDetector();
    Accelerometer.setUpdateInterval(SENSOR_MS);
    const sub = Accelerometer.addListener((a) => {
      const e = detector.push({ t: Date.now(), a: { x: a.x, y: a.y, z: a.z }, speedMps: speed.current });
      if (e && !busy.current) startRef.current(false);
    });
    return () => sub.remove();
  }, [watching]);

  return flow;
}
