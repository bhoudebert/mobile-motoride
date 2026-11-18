import { haversineM, project } from "./geo.ts";
import { angleDiff } from "./heading.ts";
import { isWaypoint } from "./skip.ts";
import { snapToLine } from "./track.ts";
import type { LatLon, PreparedRoadbook } from "./types.ts";

/** Nearer the line than this, a rider who left it has missed a turn: the way back is the nearest point of the line. */
export const REJOIN_NEAR_M = 500;
/** A place of the line the rider already passed costs this much more, so a rider is sent on, not back. */
export const REJOIN_BEHIND_COST = 1.5;
/** The cost of a place at the very end of the line, over one at the start: a few per cent, only a tie-breaker. */
export const REJOIN_LATE_COST = 0.1;
/** A new place replaces the one being ridden to only when it costs this share of it or less. */
export const REJOIN_KEEP_SHARE = 0.6;
/** A place of the line still counts as ahead this far behind the rider's last place on it. */
const REACHED_SLACK_M = 15;

/** The place of the line a rider far from the roadbook should go to (spec ride-navigation, "Back to the route"). */
export interface RejoinChoice {
  /** Where it lies on the ride's line. */
  atM: number;
  /** The route point the rider meets next from there. */
  name: string;
}

/** The route point met first from `atM` on, or the last one. */
function nextPointFrom(ride: PreparedRoadbook, atM: number): string {
  const points = ride.stops.filter(isWaypoint);
  return (points.find((s) => s.atM >= atM - REACHED_SLACK_M) ?? points[points.length - 1])?.name ?? "";
}

/**
 * Where the last leg of a loop that comes back to its start begins, else Infinity. Its end is where the ride starts: a
 * rider who has not ridden the loop is not sent to its finish.
 */
function lastLegStartM(ride: PreparedRoadbook): number {
  const line = ride.roadbook.line;
  const first = line[0];
  const last = line[line.length - 1];
  if (!first || !last || haversineM(first, last) > REJOIN_NEAR_M) return Infinity;
  const points = ride.stops.filter(isWaypoint);
  return points.length > 1 ? points[points.length - 2]!.atM : Infinity;
}

/**
 * What it costs to go to the line at `atM`, `x` metres east and `y` north of the rider: the straight distance, up to
 * twice that when it lies behind the rider's heading (a rider with no heading is taken as sideways to everything), and
 * more again when it is a place of the line already passed.
 */
function cost(
  x: number,
  y: number,
  atM: number,
  reachedM: number,
  headingDeg: number | null,
  totalM: number,
  lastLegM: number,
): number {
  const away = Math.hypot(x, y);
  const bearing = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  const turn = headingDeg === null ? 0.5 : angleDiff(headingDeg, bearing) / 180;
  // A little more for a place further along: of two equal places (a loop closes on its start) the first one wins.
  const late =
    atM < reachedM - REACHED_SLACK_M ? REJOIN_BEHIND_COST : 1 + (REJOIN_LATE_COST * atM) / Math.max(totalM, 1);
  const home = atM > lastLegM && reachedM <= lastLegM ? REJOIN_BEHIND_COST : 1;
  return away * (1 + turn) * late * home;
}

/**
 * Where a rider far from the roadbook should rejoin it: the place of the line that is cheapest to go to, ahead of the
 * rider and near beating behind and near (so a rider who skipped a point is sent on, not back to it). The route points
 * before it count as passed. The place being ridden to is kept unless another costs clearly less, so it does not hop as
 * the rider moves (a loop that closes on itself has two places at the same distance). Null for a rider near the line
 * (the nearest point of the line is then the way back).
 *
 * @param keepAtM the place chosen before, if the rider is still on the way to it
 */
export function chooseRejoinTarget(
  ride: PreparedRoadbook,
  reachedM: number,
  pos: LatLon,
  headingDeg: number | null,
  keepAtM: number | null = null,
): RejoinChoice | null {
  const { line, cumulativeM } = { line: ride.roadbook.line, cumulativeM: ride.cumulativeM };
  if (snapToLine(line, cumulativeM, pos).offsetM <= REJOIN_NEAR_M) return null;
  const lastLegM = lastLegStartM(ride);
  let bestAt = 0;
  let bestCost = Infinity;
  let keepCost = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = project(line[i]!, pos);
    const b = project(line[i + 1]!, pos);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(1, Math.max(0, (-a[0] * dx - a[1] * dy) / len2)) : 0;
    const segM = (cumulativeM[i + 1] ?? 0) - (cumulativeM[i] ?? 0);
    const atM = (cumulativeM[i] ?? 0) + segM * t;
    const c = cost(a[0] + dx * t, a[1] + dy * t, atM, reachedM, headingDeg, ride.totalM, lastLegM);
    if (c < bestCost) {
      bestCost = c;
      bestAt = atM;
    }
    if (keepAtM !== null && keepAtM >= (cumulativeM[i] ?? 0) && keepAtM <= (cumulativeM[i + 1] ?? 0)) {
      const kt = segM > 0 ? (keepAtM - (cumulativeM[i] ?? 0)) / segM : 0;
      keepCost = cost(a[0] + dx * kt, a[1] + dy * kt, keepAtM, reachedM, headingDeg, ride.totalM, lastLegM);
    }
  }
  if (!Number.isFinite(bestCost)) return null;
  const atM =
    keepAtM !== null && Number.isFinite(keepCost) && bestCost > keepCost * REJOIN_KEEP_SHARE ? keepAtM : bestAt;
  return { atM, name: nextPointFrom(ride, atM) };
}
