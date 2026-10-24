import { unproject } from "./geo.ts";
import { policyOf } from "./cameraPolicy.ts";
import { needsApproach } from "./approach.ts";
import { planSkip, startChoices } from "./skip.ts";
import { bearingAt, pointAt, snapToLine } from "./track.ts";
import type { Fix, LatLon, PreparedJunction, PreparedRoadbook } from "./types.ts";

/** Scripted GPS for development builds (spec ride-navigation, ADR 0014). */
export const REPLAY_SCENARIOS = [
  "ride",
  "approach",
  "startfrom",
  "join",
  "offroute",
  "wrongway",
  "skip",
  "zone",
  "roundabout",
  "lanes",
] as const;
export type ReplayScenario = (typeof REPLAY_SCENARIOS)[number];

export interface ReplayPhase {
  seconds: number;
  at: LatLon;
  speedMps: number;
  headingDeg: number | null;
}

/** `mobilemotoride://replay/approach` gives "approach"; anything else gives null. */
export function parseReplayLink(url: string | null | undefined): ReplayScenario | null {
  const m = /^mobilemotoride:\/\/replay\/([a-z]+)\/?(?:[?#].*)?$/.exec(url ?? "");
  const name = m?.[1];
  return (REPLAY_SCENARIOS as readonly string[]).includes(name ?? "") ? (name as ReplayScenario) : null;
}

const HOLD_S = 3600;
const OFFSET_M = 250;
const APPROACH_M = 3000;

const clampM = (rb: PreparedRoadbook, m: number) => Math.min(Math.max(m, 0), rb.totalM);
const on = (rb: PreparedRoadbook, m: number) => pointAt(rb.roadbook.line, rb.cumulativeM, clampM(rb, m));
const lineBearing = (rb: PreparedRoadbook, m: number) => bearingAt(rb.roadbook.line, rb.cumulativeM, clampM(rb, m));

/** A point `distM` to the side of the line at `m`, the side that is really away from it. */
function beside(rb: PreparedRoadbook, m: number, distM: number): LatLon | null {
  const from = on(rb, m);
  const bearing = lineBearing(rb, m);
  for (const side of [90, -90]) {
    const rad = (((bearing + side) % 360) * Math.PI) / 180;
    const p = unproject([Math.sin(rad) * distM, Math.cos(rad) * distM], from);
    if (snapToLine(rb.roadbook.line, rb.cumulativeM, p).offsetM > 100) return p;
  }
  return null;
}

/** Whether a scenario rides through the made-up junctions of `withDemoJunctions`. */
export const needsDemoJunctions = (scenario: ReplayScenario) => scenario === "roundabout" || scenario === "lanes";

/**
 * A roadbook with a roundabout (the second of three exits) a quarter of the way and a four-lane
 * road at three fifths, for the scripted rides that show junction guidance in a development build, since no bundled
 * roadbook carries junctions yet. Never used for a real ride.
 */
export function withDemoJunctions(rb: PreparedRoadbook): PreparedRoadbook {
  const index = (m: number) =>
    Math.max(
      0,
      rb.cumulativeM.findIndex((d) => d >= m),
    );
  const ringAt = rb.totalM * 0.25;
  const lanesAt = rb.totalM * 0.6;
  const ring: PreparedJunction = {
    kind: "roundabout",
    at: index(ringAt),
    to: index(ringAt + 60),
    // As a file would give them once read: in the order right-hand traffic meets them (right, ahead, left).
    exits: [105, 20, 275],
    exit: 2,
    atM: ringAt,
    endM: ringAt + 60,
  };
  const lanes: PreparedJunction = {
    kind: "lanes",
    at: index(lanesAt),
    count: 4,
    use: [0, 1],
    turns: ["left", "through", "through", "right"],
    atM: lanesAt,
    endM: lanesAt,
  };
  return { ...rb, junctions: [ring, lanes] };
}

/**
 * The positions of a scenario, as phases: each holds a position for a number of seconds, the last for an hour, so the
 * screen settles. Null when the roadbook cannot play it (no danger zone, nothing to skip, nowhere off the line).
 */
export function replayPhases(rb: PreparedRoadbook, scenario: ReplayScenario): ReplayPhase[] | null {
  const m = Math.min(1000, rb.totalM / 3);
  switch (scenario) {
    case "ride":
      return [{ seconds: HOLD_S, at: on(rb, m), speedMps: 15, headingDeg: lineBearing(rb, m) }];
    case "approach": {
      const start = rb.roadbook.line[0]!;
      const far = unproject([0, APPROACH_M], start);
      return needsApproach(rb, far) ? [{ seconds: HOLD_S, at: far, speedMps: 0, headingDeg: null }] : null;
    }
    case "startfrom":
      // Like the approach, with the third route point chosen as the place to start from (replayStartIndex).
      return startChoices(rb).length >= 3 ? replayPhases(rb, "approach") : null;
    case "join": {
      // Beside the road between the second and third route points: the nearest next point is the third.
      const points = startChoices(rb);
      if (points.length < 3) return null;
      const between = (points[1]!.atM + points[2]!.atM) / 2;
      const off = beside(rb, between, 300);
      return off && needsApproach(rb, off) ? [{ seconds: HOLD_S, at: off, speedMps: 0, headingDeg: null }] : null;
    }
    case "offroute": {
      // The first place along the roadbook where 250 m to one side really is away from the line.
      for (let at = m; at < rb.totalM; at += 700) {
        const off = beside(rb, at, OFFSET_M);
        if (off) {
          return [
            { seconds: 3, at: on(rb, at), speedMps: 0, headingDeg: null },
            { seconds: HOLD_S, at: off, speedMps: 0, headingDeg: null },
          ];
        }
      }
      return null;
    }
    case "wrongway":
      return [{ seconds: HOLD_S, at: on(rb, m), speedMps: 8, headingDeg: (lineBearing(rb, m) + 180) % 360 }];
    case "skip": {
      const at = Math.min(100, rb.totalM / 4);
      return planSkip(rb, at) ? [{ seconds: HOLD_S, at: on(rb, at), speedMps: 0, headingDeg: null }] : null;
    }
    case "roundabout":
    case "lanes": {
      const j = withDemoJunctions(rb).junctions[scenario === "roundabout" ? 0 : 1]!;
      const reach = scenario === "roundabout" ? [280, 140, 0] : [560, 280, 0];
      const stage = (back: number, seconds: number): ReplayPhase => {
        const at = Math.max(0, j.atM - back);
        return { seconds, at: on(rb, at), speedMps: 12, headingDeg: lineBearing(rb, at) };
      };
      return [...reach.map((back) => stage(back, 4)), stage(-100, HOLD_S)];
    }
    case "zone": {
      const zone = rb.zones[0];
      if (!zone) return null;
      const policy = policyOf(zone.country);
      if (policy === "off") return null;
      // Where the warning is due: 550 m before a camera that may be placed, inside a zone that may not.
      const at = policy === "exact" ? Math.max(0, zone.atM - 550) : zone.startM + 50;
      return [{ seconds: HOLD_S, at: on(rb, at), speedMps: 10, headingDeg: lineBearing(rb, at) }];
    }
  }
}

/** The fix `secondsElapsed` into a script, at clock time `time`. */
export function replayFixAt(phases: ReplayPhase[], secondsElapsed: number, time: number): Fix {
  let left = secondsElapsed;
  let phase = phases[phases.length - 1]!;
  for (const p of phases) {
    if (left < p.seconds) {
      phase = p;
      break;
    }
    left -= p.seconds;
  }
  return {
    lat: phase.at[0],
    lon: phase.at[1],
    speedMps: phase.speedMps,
    headingDeg: phase.headingDeg,
    accuracyM: 5,
    time,
  };
}

/** The route point a scenario starts from, as an index into the route points; null for a scenario that starts at the start. */
export function replayStartIndex(scenario: ReplayScenario): number | null {
  return scenario === "startfrom" ? 2 : null;
}

/** The `join` scenario shows the join card; every other scripted ride goes where its script says without asking. */
export function replayAsks(scenario: ReplayScenario): boolean {
  return scenario === "join";
}
