import { formatDateTime } from "./i18n/index.ts";

/** The pace taken before the rider has moved, and the bounds a measured pace is kept within, m/s (58, 29 and 108 km/h). */
export const ASSUMED_PACE_MPS = 16;
const MIN_PACE_MPS = 8;
const MAX_PACE_MPS = 30;
/** Below this the rider is standing or crawling and says nothing of the pace. */
const MOVING_MPS = 3;
/** Each fix moves the pace this far towards the speed: about two minutes of riding at one fix a second. */
const SMOOTHING = 0.01;

/** The pace after one more fix: a running average of the speed while moving, unchanged when standing. */
export function nextPace(pace: number | null, speedMps: number | null): number | null {
  if (speedMps === null || speedMps < MOVING_MPS) return pace;
  return pace === null ? speedMps : pace + (speedMps - pace) * SMOOTHING;
}

/** Time left and the moment of arrival for a distance at the pace of the ride so far. */
export function etaOf(remainingM: number, pace: number | null, nowMs: number): { seconds: number; arrivalMs: number } {
  const mps = Math.min(MAX_PACE_MPS, Math.max(MIN_PACE_MPS, pace ?? ASSUMED_PACE_MPS));
  const seconds = Math.round(remainingM / mps / 60) * 60;
  return { seconds, arrivalMs: nowMs + seconds * 1000 };
}

/** "45 min", "2h05": the same words in every language. */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

/** The time of day the way the language writes it ("16:42", "4:42 PM"). */
export const formatClock = (ms: number): string => formatDateTime(ms, { hour: "numeric", minute: "2-digit" });
