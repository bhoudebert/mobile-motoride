import type { LimitSegment, PreparedRoadbook } from "./types.ts";

/** Over the limit only beyond this, so GPS speed noise does not flash the sign (spec speed-limits). */
export const OVER_LIMIT_TOLERANCE_KMH = 2;
export const NEXT_LIMIT_LOOKAHEAD_M = 800;
export const ZONE_LOOKAHEAD_M = 600;

export interface SpeedLimit {
  /** Null when the roadbook has no limit for this stretch. */
  kmh: number | null;
  /** A tagged limit (true) or an assumed default (false). */
  posted: boolean;
  road?: string;
  /** Held over from the last known stretch across a gap in the data. */
  carried: boolean;
  /** The next different limit ahead within 800 m. */
  next: { kmh: number; distanceM: number } | null;
}

export const UNKNOWN_LIMIT: SpeedLimit = { kmh: null, posted: false, carried: false, next: null };

/** Index of the last segment starting at or before `m`, or -1 (binary search: the segments are in order). */
function lastStartingAtOrBefore(segments: LimitSegment[], m: number): number {
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid]!.startM <= m) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/**
 * The limit where the rider is, and the next different one ahead (spec speed-limits). Across a gap in the data the
 * last known limit is held, marked assumed; it is unknown only before the first known stretch.
 */
export function limitAt(rb: PreparedRoadbook, progressM: number): SpeedLimit {
  const segments = rb.limitSegments;
  if (segments.length === 0) return UNKNOWN_LIMIT;
  const i = lastStartingAtOrBefore(segments, progressM);
  const last = i >= 0 ? segments[i]! : null;
  const inside = last !== null && progressM < last.endM;
  let next: SpeedLimit["next"] = null;
  for (let j = i + 1; j < segments.length; j++) {
    const s = segments[j]!;
    const distanceM = s.startM - progressM;
    if (distanceM > NEXT_LIMIT_LOOKAHEAD_M) break;
    if (s.kmh !== last?.kmh) {
      next = { kmh: s.kmh, distanceM: Math.max(0, distanceM) };
      break;
    }
  }
  if (!last) return { ...UNKNOWN_LIMIT, next };
  return {
    kmh: last.kmh,
    posted: inside && last.posted,
    carried: !inside,
    ...(last.road ? { road: last.road } : {}),
    next,
  };
}

/** Over the limit: a known limit, a known speed, and more than the tolerance above it. */
export function isOver(speedMps: number | null, limitKmh: number | null): boolean {
  if (speedMps === null || limitKmh === null) return false;
  return speedMps * 3.6 > limitKmh + OVER_LIMIT_TOLERANCE_KMH;
}
