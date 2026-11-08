import { bearingDeg, haversineM } from "./geo.ts";
import { angleDiff } from "./heading.ts";
import { isWaypoint } from "./skip.ts";
import { snapToLine } from "./track.ts";
import type { LatLon, PreparedRoadbook, PreparedStop } from "./types.ts";

/** Nearer the line than this, a rider who left it has missed a turn: the way back is the nearest point of the line. */
export const REJOIN_NEAR_M = 500;
/** A later route point is preferred to the next one only when it costs this share of it or less. */
export const REJOIN_LATER_SHARE = 0.7;
/** A route point not yet reached still counts this far behind the rider's last place on the line. */
const REACHED_SLACK_M = 15;

/** The route point a rider far from the roadbook should go to (spec ride-navigation, "Back to the route"). */
export interface RejoinChoice {
  /** Where the point lies on the ride's line. */
  atM: number;
  name: string;
}

/**
 * The cost of going to a point: its straight-line distance, up to twice that when it lies behind the rider. A rider
 * with no heading is taken as sideways to everything, so only the distance counts for the order.
 */
function cost(pos: LatLon, heading: number | null, s: PreparedStop): number {
  const d = haversineM(pos, [s.lat, s.lon]);
  return d * (1 + (heading === null ? 0.5 : angleDiff(heading, bearingDeg(pos, [s.lat, s.lon])) / 180));
}

/**
 * Where a rider who is far from the roadbook should go: the route point, not yet reached, that is cheapest to go to,
 * the points before it being dropped as for a skip. Ahead of the rider and near beats behind and near; a U-turn is
 * chosen only when the point behind is much nearer. The next point wins unless a later one is clearly cheaper, so a
 * rider between two is not sent past one without reason, and the finish is kept for when no other point is left.
 * Null for a rider near the line (the nearest point of the line is then the way back), or with no point to go to.
 */
export function chooseRejoinTarget(
  ride: PreparedRoadbook,
  reachedM: number,
  pos: LatLon,
  headingDeg: number | null,
): RejoinChoice | null {
  if (snapToLine(ride.roadbook.line, ride.cumulativeM, pos).offsetM <= REJOIN_NEAR_M) return null;
  let candidates = ride.stops.filter(isWaypoint).filter((s) => s.atM > reachedM - REACHED_SLACK_M);
  if (candidates.length > 1) candidates = candidates.slice(0, -1);
  const next = candidates[0];
  if (!next) return null;
  let best = next;
  let bestCost = cost(pos, headingDeg, next);
  const nextCost = bestCost;
  for (const s of candidates.slice(1)) {
    const c = cost(pos, headingDeg, s);
    if (c < bestCost) {
      best = s;
      bestCost = c;
    }
  }
  const chosen = best !== next && bestCost >= nextCost * REJOIN_LATER_SHARE ? next : best;
  return { atM: chosen.atM, name: chosen.name };
}
