import { haversineM } from "./geo.ts";
import { effectiveLimit, type TraceResponse } from "./enrich.ts";
import type { SpeedLimit } from "./limits.ts";
import type { LatLon } from "./types.ts";

/** The speed limit of the road under the rider, found live when the roadbook does not know it (spec speed-limits). */

/** The trail sent for matching: the last few points, at least this far apart. */
export const TRAIL_SPACING_M = 25;
export const TRAIL_POINTS = 6;
/** Asked again after this long and this far, whichever comes last; a rider who has not moved is not asked again. */
export const LIVE_LIMIT_EVERY_MS = 8_000;
export const LIVE_LIMIT_MIN_MOVE_M = 80;
/** A limit older than this is no longer shown. */
export const LIVE_LIMIT_FRESH_MS = 90_000;

export interface LiveLimitState {
  trail: LatLon[];
  asked: { time: number; pos: LatLon } | null;
}

export const newLiveLimitState = (): LiveLimitState => ({ trail: [], asked: null });

/**
 * Keep the trail of the rider, and say whether a request for the limit is due now (it is a service shared by every
 * rider: slow, and only when it is needed). The state is changed in place.
 */
export function dueForLimit(state: LiveLimitState, pos: LatLon, time: number): LatLon[] | null {
  const last = state.trail[state.trail.length - 1];
  if (!last || haversineM(last, pos) >= TRAIL_SPACING_M) state.trail = [...state.trail, pos].slice(-TRAIL_POINTS);
  const { asked } = state;
  if (state.trail.length < 2) return null;
  if (asked && (time - asked.time < LIVE_LIMIT_EVERY_MS || haversineM(asked.pos, pos) < LIVE_LIMIT_MIN_MOVE_M)) {
    return null;
  }
  state.asked = { time, pos };
  return state.trail;
}

/** The limit on the last road of a matched trail, else null. */
export function limitFromTrace(res: TraceResponse): SpeedLimit | null {
  const edge = res.edges.at(-1);
  if (!edge) return null;
  const { kmh, posted } = effectiveLimit(edge, res.admins);
  const road = edge.names?.find((n) => /^[A-Z]{1,2} ?\d/.test(n)) ?? edge.names?.[0];
  return { kmh, posted, carried: false, next: null, ...(road ? { road } : {}) };
}
