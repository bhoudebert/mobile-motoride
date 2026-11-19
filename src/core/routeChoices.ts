import type { TrafficLevel } from "./traffic.ts";
import { cumulativeDistances, pointAt, snapToLine } from "./track.ts";
import type { LatLon } from "./types.ts";

// ---- The routes offered to a rider going to a place (spec destination-routing, ADR 0053)

/** The three ways asked for, in the order that names a route when two follow the same road. */
export const ROUTE_KINDS = ["fastest", "noMotorway", "shortest"] as const;
export type RouteKind = (typeof ROUTE_KINDS)[number];

/** A route as the routing service answers it. */
export interface RouteCandidate {
  kind: RouteKind;
  line: LatLon[];
  /** Seconds, by the road's own speeds. */
  timeS: number;
  lengthM: number;
}

/** A route with what the traffic adds to it. */
export interface RouteChoice extends RouteCandidate {
  /** Seconds the jams on it add. */
  delayS: number;
  /** A point of it is closed. */
  closed: boolean;
  /** `timeS` and `delayS`. */
  totalS: number;
}

/** Two routes are one road when their lengths are within this share and nearly all of one lies near the other. */
const SAME_LENGTH_SHARE = 0.05;
const SAME_NEAR_M = 150;
const SAME_ON_SHARE = 0.9;
const SAMPLES = 24;

function onOther(a: RouteCandidate, b: RouteCandidate): number {
  const cum = cumulativeDistances(b.line);
  const total = cum[cum.length - 1] ?? 0;
  const aCum = cumulativeDistances(a.line);
  const aTotal = aCum[aCum.length - 1] ?? 0;
  let on = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const p = pointAt(a.line, aCum, (aTotal * i) / SAMPLES);
    if (snapToLine(b.line, cum, p).offsetM <= SAME_NEAR_M) on++;
  }
  return total > 0 ? on / (SAMPLES + 1) : 0;
}

/** The routes, once each road: of two on nearly the same road, the one named first in `ROUTE_KINDS` stays. */
export function distinctRoutes(candidates: RouteCandidate[]): RouteCandidate[] {
  const ordered = [...candidates].sort((a, b) => ROUTE_KINDS.indexOf(a.kind) - ROUTE_KINDS.indexOf(b.kind));
  const kept: RouteCandidate[] = [];
  for (const c of ordered) {
    const same = kept.some(
      (k) =>
        Math.abs(k.lengthM - c.lengthM) <= Math.max(k.lengthM, c.lengthM) * SAME_LENGTH_SHARE &&
        onOther(c, k) >= SAME_ON_SHARE &&
        onOther(k, c) >= SAME_ON_SHARE,
    );
    if (!same) kept.push(c);
  }
  return kept;
}

/** Where traffic is asked about a route: at most 8 points over its first 60 km, 2 to 10 km apart. */
export const CHOICE_AHEAD_M = 60_000;
export const CHOICE_MAX_POINTS = 8;
const CHOICE_MIN_SPACING_M = 2000;
const CHOICE_MAX_SPACING_M = 10_000;

export interface ChoicePoint {
  lat: number;
  lon: number;
  /** The length of the route this point stands for. */
  spanM: number;
}

export function choicePoints(line: LatLon[]): ChoicePoint[] {
  const cum = cumulativeDistances(line);
  const total = cum[cum.length - 1] ?? 0;
  const reach = Math.min(total, CHOICE_AHEAD_M);
  const spacing = Math.max(CHOICE_MIN_SPACING_M, Math.min(CHOICE_MAX_SPACING_M, reach / (CHOICE_MAX_POINTS - 1)));
  const out: ChoicePoint[] = [];
  for (let d = 0; d <= reach && out.length < CHOICE_MAX_POINTS; d += spacing) {
    const [lat, lon] = pointAt(line, cum, d);
    out.push({ lat, lon, spanM: Math.min(spacing, Math.max(total - d, 0)) });
  }
  return out;
}

/** What a level does to the time of the part of the route it stands for: it takes this many times as long. */
export const TRAFFIC_SLOW_FACTOR = 1.4;
export const TRAFFIC_HEAVY_FACTOR = 2.5;

/** The seconds the levels add to a route, and whether a point of it is closed. */
export function trafficDelay(
  route: RouteCandidate,
  points: ChoicePoint[],
  levels: TrafficLevel[],
): { delayS: number; closed: boolean } {
  const speed = route.timeS > 0 ? route.lengthM / route.timeS : 0;
  let delayS = 0;
  let closed = false;
  points.forEach((p, i) => {
    const level = levels[i];
    if (level === "closed") closed = true;
    const factor = level === "slow" ? TRAFFIC_SLOW_FACTOR : level === "heavy" ? TRAFFIC_HEAVY_FACTOR : 1;
    if (speed > 0 && factor > 1) delayS += (p.spanM / speed) * (factor - 1);
  });
  return { delayS: Math.round(delayS), closed };
}

/**
 * The routes ranked by their time with the traffic, the one to select first; a route with a closed point comes after the ones that are
 * not closed. `traffic` holds the levels of each route's points (in the order of the candidates), or null for none known.
 */
export function rankRoutes(
  candidates: RouteCandidate[],
  traffic: Array<{ points: ChoicePoint[]; levels: TrafficLevel[] } | null> | null,
): RouteChoice[] {
  const choices = candidates.map((c, i): RouteChoice => {
    const known = traffic?.[i];
    const { delayS, closed } = known ? trafficDelay(c, known.points, known.levels) : { delayS: 0, closed: false };
    return { ...c, delayS, closed, totalS: c.timeS + delayS };
  });
  return choices.sort(
    (a, b) =>
      Number(a.closed) - Number(b.closed) ||
      a.totalS - b.totalS ||
      ROUTE_KINDS.indexOf(a.kind) - ROUTE_KINDS.indexOf(b.kind),
  );
}
