import type { Feature, FeatureCollection, LineString } from "geojson";
import { pointAt, resample } from "./track.ts";
import type { LatLon } from "./types.ts";

// ---- Traffic on the road ahead (spec traffic, ADR 0040): the server tells how fast the traffic goes at a few points

export type TrafficLevel = "free" | "slow" | "heavy" | "closed" | "unknown";
const LEVELS: readonly TrafficLevel[] = ["free", "slow", "heavy", "closed", "unknown"];

/** Points are asked every 10 km up to 60 km ahead (at most 7, the server takes 8). */
export const TRAFFIC_SPACING_M = 10_000;
export const TRAFFIC_AHEAD_M = 60_000;

export interface TrafficPoint {
  /** Distance ahead of the rider. */
  distM: number;
  /** Distance along the roadbook. */
  atM: number;
  lat: number;
  lon: number;
}

/** The points of the roadbook to ask about: here and every 10 km ahead up to 60 km or the finish. */
export function trafficPoints(
  line: LatLon[],
  cumulativeM: number[],
  progressM: number,
  totalM: number,
): TrafficPoint[] {
  const here = Math.max(0, Math.min(progressM, totalM));
  const reach = Math.min(TRAFFIC_AHEAD_M, totalM - here);
  const out: TrafficPoint[] = [];
  for (let d = 0; d <= reach; d += TRAFFIC_SPACING_M) {
    const [lat, lon] = pointAt(line, cumulativeM, here + d);
    out.push({ distM: d, atM: here + d, lat, lon });
  }
  return out;
}

export interface TrafficReading {
  point: TrafficPoint;
  level: TrafficLevel;
}

/** The levels of a server's answer in the order of the points asked; null when it is not what was asked. */
export function parseTraffic(body: unknown, count: number): TrafficLevel[] | null {
  const points = typeof body === "object" && body !== null ? (body as { points?: unknown }).points : undefined;
  if (!Array.isArray(points) || points.length !== count) return null;
  const out: TrafficLevel[] = [];
  for (const p of points) {
    const level = (p as { level?: unknown } | null)?.level;
    out.push(LEVELS.includes(level as TrafficLevel) ? (level as TrafficLevel) : "unknown");
  }
  return out;
}

/** Slow, heavy and closed are what the rider is told of and what is drawn. */
export const isJam = (level: TrafficLevel): level is "slow" | "heavy" | "closed" =>
  level === "slow" || level === "heavy" || level === "closed";

export interface TrafficOutlook {
  readings: TrafficReading[];
  /** The first jam ahead (here included); null when the points ahead are free or unknown. */
  first: TrafficReading | null;
  /** Whether any point is known (not "unknown"). */
  known: boolean;
}

export function outlookOfTraffic(readings: TrafficReading[]): TrafficOutlook {
  return {
    readings,
    first: readings.find((r) => isJam(r.level)) ?? null,
    known: readings.some((r) => r.level !== "unknown"),
  };
}

export interface TrafficStretch {
  fromM: number;
  toM: number;
  level: "slow" | "heavy" | "closed";
}

/**
 * The stretches to colour: each jam point stands for half the spacing on each side of it (never behind the rider nor past the
 * finish), and neighbouring points of the same level join up.
 */
export function trafficStretches(readings: TrafficReading[], progressM: number, totalM: number): TrafficStretch[] {
  const half = TRAFFIC_SPACING_M / 2;
  const out: TrafficStretch[] = [];
  for (const r of readings) {
    if (!isJam(r.level)) continue;
    const fromM = Math.max(progressM, r.point.atM - half);
    const toM = Math.min(totalM, r.point.atM + half);
    if (toM <= fromM) continue;
    const last = out[out.length - 1];
    if (last && last.level === r.level && fromM <= last.toM + 1) last.toM = toM;
    else out.push({ fromM, toM, level: r.level });
  }
  return out;
}

/** The stretches as lines for the map, each with its `level`. */
export function trafficCollection(
  line: LatLon[],
  cumulativeM: number[],
  stretches: TrafficStretch[],
): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = stretches.map((s) => {
    const inside = resample(line, cumulativeM, 100)
      .filter((p) => p.distM > s.fromM && p.distM < s.toM)
      .map((p) => p.point);
    const coords = [pointAt(line, cumulativeM, s.fromM), ...inside, pointAt(line, cumulativeM, s.toM)];
    return {
      type: "Feature",
      properties: { level: s.level },
      geometry: { type: "LineString", coordinates: coords.map(([lat, lon]) => [lon, lat]) },
    };
  });
  return { type: "FeatureCollection", features };
}
