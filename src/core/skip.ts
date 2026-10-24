import { haversineM } from "./geo.ts";
import { snapToLine } from "./track.ts";
import type { LatLon, PreparedRoadbook, PreparedStop } from "./types.ts";

/** Below this GPS speed the rider may skip a point: the app asks nothing of a rider who is riding. */
export const SKIP_MAX_SPEED_MPS = 10 / 3.6;

/** What skipping the next route point would do (spec live-corrections). */
export interface SkipPlan {
  /** The route point the roadbook is heading for, which is dropped. */
  skipped: PreparedStop;
  /** The route point after it, where the new route leads. */
  target: PreparedStop;
  /** Where the target lies on the whole roadbook, whatever approach is in front of it now. */
  joinM: number;
}

/** A route point of the loop; planned service stops are not (they lie on the route and are left alone). */
export const isWaypoint = (s: PreparedStop) => s.kind !== "stop";

/**
 * The skip on offer: drop the next route point and go to the one after it. Null when there is none to go to, as
 * for the last point of the roadbook.
 */
export function planSkip(ride: PreparedRoadbook, progressM: number): SkipPlan | null {
  const waypoints = ride.stops.filter(isWaypoint);
  const i = waypoints.findIndex((s) => s.atM > progressM);
  const skipped = i >= 0 ? waypoints[i] : undefined;
  const target = i >= 0 ? waypoints[i + 1] : undefined;
  if (!skipped || !target) return null;
  return { skipped, target, joinM: ride.joinM + Math.max(0, target.atM - ride.approachM) };
}

/** Skipping is refused while moving; an unknown speed is allowed. */
export function canSkipAt(speedMps: number | null): boolean {
  return speedMps === null || speedMps < SKIP_MAX_SPEED_MPS;
}

/** A route point the rider can start the roadbook from (spec ride-control). */
export interface StartChoice {
  name: string;
  /** Distance from the start of the roadbook. */
  atM: number;
}

/** The route points of a roadbook, in riding order; planned service stops are not places to start from. */
export function startChoices(rb: PreparedRoadbook): StartChoice[] {
  return rb.stops.filter(isWaypoint).map((s) => ({ name: s.name, atM: s.atM }));
}

/** Starting from the point at `atM`: how near the rider must be for the ride to begin there at once. */
export const START_HERE_M = 150;

/** A route point offered to a rider who joins the roadbook (spec ride-control). */
export interface JoinChoice extends StartChoice {
  /** Straight-line distance from the rider. */
  distanceM: number;
}

export interface JoinOptions {
  /** The first route point ahead of the rider's nearest point on the roadbook (the last one when past them all). */
  nearest: JoinChoice;
  /** The first route point of the roadbook. */
  first: JoinChoice;
  /** The route points before `nearest`, which going there drops. */
  skipped: string[];
}

/**
 * Where a rider away from the roadbook can join it: the nearest next route point, the start, and what the first
 * skips. Null when the roadbook has no route points.
 */
export function joinOptions(rb: PreparedRoadbook, pos: LatLon): JoinOptions | null {
  const points = rb.stops.filter(isWaypoint);
  if (points.length === 0) return null;
  const progressM = snapToLine(rb.roadbook.line, rb.cumulativeM, pos).progressM;
  // A point within 15 m behind the rider's nearest point is not passed yet: it is still the next one.
  const found = points.findIndex((s) => s.atM >= progressM - 15);
  const i = found >= 0 ? found : points.length - 1;
  const choice = (s: PreparedStop): JoinChoice => ({
    name: s.name,
    atM: s.atM,
    distanceM: haversineM(pos, [s.lat, s.lon]),
  });
  return { nearest: choice(points[i]!), first: choice(points[0]!), skipped: points.slice(0, i).map((s) => s.name) };
}
