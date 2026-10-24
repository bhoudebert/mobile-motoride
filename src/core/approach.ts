import { haversineM } from "./geo.ts";
import { prepareRoadbook } from "./roadbook.ts";
import { cumulativeDistances, pointAt, snapToLine } from "./track.ts";
import type { LatLon, PreparedRoadbook } from "./types.ts";

/** Farther than this from the line, the rider is taken to the start first (spec ride-navigation). */
export const APPROACH_MIN_M = 150;
/** Back to the route: the point to rejoin is this far along the line from the nearest one. */
export const REJOIN_AHEAD_M = 150;

/** Distance from a position to the roadbook line. */
export function distanceToLineM(rb: PreparedRoadbook, pos: LatLon): number {
  return snapToLine(rb.roadbook.line, rb.cumulativeM, pos).offsetM;
}

export function needsApproach(rb: PreparedRoadbook, pos: LatLon): boolean {
  return distanceToLineM(rb, pos) > APPROACH_MIN_M;
}

/**
 * The approach followed by the roadbook as one line, so corners, maneuvers,
 * instructions, bearing and warnings need no second code path (ADR 0008).
 * `approach` is the routed way in, or a straight line when none was found.
 *
 * `name` names the point the rider chose to go to, when they skipped one (spec live-corrections).
 *
 * `joinM` is where on the original roadbook the approach leads: 0 for the start, or a later point to rejoin the
 * route after leaving it (ADR 0012), in which case what lies before it is dropped. `rb` is always the whole roadbook.
 */
export function withApproach(
  rb: PreparedRoadbook,
  approach: LatLon[],
  direct: boolean,
  joinM = 0,
  target: "start" | "route" = "start",
  name?: string,
): PreparedRoadbook {
  const join = Math.min(Math.max(joinM, 0), rb.totalM);
  const line = rb.roadbook.line;
  const first = join > 0 ? pointAt(line, rb.cumulativeM, join) : line[0]!;
  const rest =
    join > 0
      ? line.slice(
          rb.cumulativeM.findIndex((d) => d > join) < 0 ? line.length : rb.cumulativeM.findIndex((d) => d > join),
        )
      : line.slice(1);

  const last = approach[approach.length - 1];
  const lead = last && haversineM(last, first) < 1 ? approach.slice(0, -1) : approach;
  const approachCumulative = cumulativeDistances([...lead, first]);
  const approachM = approachCumulative[approachCumulative.length - 1] ?? 0;
  const shift = (m: number) => approachM + Math.max(0, m - join);

  const prepared = prepareRoadbook({
    ...rb.roadbook,
    line: [...lead, first, ...rest],
    limits: undefined,
    cameras: undefined,
    junctions: undefined,
    countries: undefined,
  });
  return {
    ...prepared,
    // What was on the roadbook keeps its place, moved along by the approach; what was ridden is gone.
    stops: rb.stops.filter((s) => s.atM >= join - 1).map((s) => ({ ...s, atM: shift(s.atM) })),
    limitSegments: rb.limitSegments
      .filter((l) => l.endM > join)
      .map((l) => ({ ...l, startM: shift(l.startM), endM: shift(l.endM) })),
    countrySegments: rb.countrySegments
      .filter((c) => c.endM > join)
      .map((c) => ({ ...c, startM: shift(c.startM), endM: shift(c.endM) })),
    zones: rb.zones
      .filter((z) => z.atM >= join)
      .map((z) => ({ ...z, atM: shift(z.atM), startM: shift(z.startM), endM: shift(z.endM) })),
    junctions: rb.junctions.filter((j) => j.atM >= join).map((j) => ({ ...j, atM: shift(j.atM), endM: shift(j.endM) })),
    loop: rb.loop,
    approachM,
    approachDirect: direct,
    approachTarget: target,
    ...(name ? { approachName: name } : {}),
    joinM: join,
  };
}
