import type { FeatureCollection, LineString, Point } from "geojson";
import { haversineM } from "./geo.ts";
import type { TrackPoint } from "./recording.ts";
import type { LatLon } from "./types.ts";

// ---- Reading a ride back from its GPX (spec ride-review, ADR 0034)

const num = (s: string | undefined): number | null => {
  if (s === undefined) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const tag = (body: string, name: string): string | undefined =>
  new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`).exec(body)?.[1];
const attr = (open: string, name: string): string | undefined => new RegExp(`\\b${name}="([^"]*)"`).exec(open)?.[1];

/**
 * The points of a recorded ride: position, time, altitude and the `motoride:` readings when the file has them. A point without a
 * position or a time is left out; anything else in the file is ignored.
 */
export function parseRideGpx(text: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const m of text.matchAll(/<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g)) {
    const lat = num(attr(m[1]!, "lat"));
    const lon = num(attr(m[1]!, "lon"));
    const body = m[2] ?? "";
    const time = Date.parse(tag(body, "time") ?? "");
    if (lat === null || lon === null || !Number.isFinite(time)) continue;
    const p: TrackPoint = { lat, lon, time, speedMps: num(tag(body, "motoride:speed")) };
    const ele = num(tag(body, "ele"));
    if (ele !== null) p.altitudeM = ele;
    const lean = num(tag(body, "motoride:lean"));
    if (lean !== null) p.leanDeg = lean;
    const latg = num(tag(body, "motoride:latg"));
    if (latg !== null) p.lateralG = latg;
    const brake = num(tag(body, "motoride:brakeg"));
    if (brake !== null) p.brakingG = brake;
    const turn = num(tag(body, "motoride:turn"));
    if (turn !== null) p.turnRate = turn;
    points.push(p);
  }
  return points;
}

// ---- The figures

/** A stop longer than this does not count as moving, and is shortened in the replay. */
export const STOP_S = 30;
const MOVING_GAP_S = 60;
const MOVING_MPS = 1;
/** A rise or a fall counts only once it exceeds this, so GPS noise does not add up (spec instruments). */
const ALTITUDE_STEP_M = 3;

/** The speed at a point: the one the GPS gave, else the one the last two points make. */
export function speedAt(points: TrackPoint[], i: number): number {
  const p = points[i]!;
  if (p.speedMps !== null && Number.isFinite(p.speedMps)) return Math.max(0, p.speedMps);
  const q = points[i - 1];
  if (!q) return 0;
  const dt = (p.time - q.time) / 1000;
  return dt > 0 ? haversineM([q.lat, q.lon], [p.lat, p.lon]) / dt : 0;
}

export interface Peak {
  value: number;
  /** The index of the point in the track. */
  index: number;
}

export interface Review {
  distanceM: number;
  durationMs: number;
  movingMs: number;
  /** Average over the time moving, km/h; null when it never moved. */
  avgKmh: number | null;
  maxKmh: number;
  /** Null when the GPS gave no altitudes. */
  climbM: number | null;
  descentM: number | null;
  minAltitudeM: number | null;
  maxAltitudeM: number | null;
  /** Null unless the gauges were on. */
  peakLeft: Peak | null;
  peakRight: Peak | null;
  maxLateralG: number | null;
  brake: Peak | null;
  accel: Peak | null;
}

const best = (points: TrackPoint[], pick: (p: TrackPoint) => number | undefined): Peak | null => {
  let found: Peak | null = null;
  points.forEach((p, index) => {
    const v = pick(p);
    if (v !== undefined && Number.isFinite(v) && v > 0 && (found === null || v > found.value))
      found = { value: v, index };
  });
  return found;
};

/** The figures of a ride from its points. */
export function reviewRide(points: TrackPoint[]): Review {
  let distanceM = 0;
  let movingMs = 0;
  let maxMps = 0;
  const altitudes: number[] = [];
  let hasMotion = false;
  points.forEach((p, i) => {
    const v = speedAt(points, i);
    if (v > maxMps) maxMps = v;
    if (p.altitudeM !== undefined && Number.isFinite(p.altitudeM)) altitudes.push(p.altitudeM);
    if (p.leanDeg !== undefined || p.brakingG !== undefined) hasMotion = true;
    const q = points[i - 1];
    if (!q) return;
    distanceM += haversineM([q.lat, q.lon], [p.lat, p.lon]);
    const dt = (p.time - q.time) / 1000;
    if (dt > 0 && dt <= MOVING_GAP_S && Math.max(v, speedAt(points, i - 1)) >= MOVING_MPS) movingMs += dt * 1000;
  });
  let climb = 0;
  let descent = 0;
  let ref = altitudes[0] ?? 0;
  for (const a of altitudes) {
    if (a - ref > ALTITUDE_STEP_M) {
      climb += a - ref;
      ref = a;
    } else if (ref - a > ALTITUDE_STEP_M) {
      descent += ref - a;
      ref = a;
    }
  }
  const left = hasMotion ? best(points, (p) => p.leanDeg) : null;
  const right = hasMotion ? best(points, (p) => (p.leanDeg === undefined ? undefined : -p.leanDeg)) : null;
  const lateral = hasMotion ? best(points, (p) => (p.lateralG === undefined ? undefined : Math.abs(p.lateralG))) : null;
  return {
    distanceM,
    durationMs: points.length > 1 ? points[points.length - 1]!.time - points[0]!.time : 0,
    movingMs,
    avgKmh: movingMs > 0 ? (distanceM / (movingMs / 1000)) * 3.6 : null,
    maxKmh: maxMps * 3.6,
    climbM: altitudes.length > 0 ? Math.round(climb) : null,
    descentM: altitudes.length > 0 ? Math.round(descent) : null,
    minAltitudeM: altitudes.length > 0 ? Math.min(...altitudes) : null,
    maxAltitudeM: altitudes.length > 0 ? Math.max(...altitudes) : null,
    peakLeft: left,
    peakRight: right,
    maxLateralG: lateral ? lateral.value : null,
    brake: hasMotion ? best(points, (p) => p.brakingG) : null,
    accel: hasMotion ? best(points, (p) => (p.brakingG === undefined ? undefined : -p.brakingG)) : null,
  };
}

// ---- The map

/** The colours of the track by speed, km/h: under 40, 40 to 70, 70 to 100, over 100. */
export const SPEED_STEPS_KMH = [40, 70, 100] as const;
export const speedClass = (kmh: number): 0 | 1 | 2 | 3 =>
  kmh < SPEED_STEPS_KMH[0] ? 0 : kmh < SPEED_STEPS_KMH[1] ? 1 : kmh < SPEED_STEPS_KMH[2] ? 2 : 3;

/** The track as lines, one per run of one speed class, each starting where the last ended so the track has no gap. */
export function traceCollection(points: TrackPoint[]): FeatureCollection<LineString> {
  const features: FeatureCollection<LineString>["features"] = [];
  let run: { cls: number; coords: [number, number][] } | null = null;
  points.forEach((p, i) => {
    const here: [number, number] = [p.lon, p.lat];
    if (i === 0) return;
    const prev: [number, number] = [points[i - 1]!.lon, points[i - 1]!.lat];
    const cls = speedClass(speedAt(points, i) * 3.6);
    if (!run || run.cls !== cls) {
      if (run)
        features.push({
          type: "Feature",
          properties: { speed: run.cls },
          geometry: { type: "LineString", coordinates: run.coords },
        });
      run = { cls, coords: [prev] };
    }
    run.coords.push(here);
  });
  if (run) {
    const r = run as { cls: number; coords: [number, number][] };
    features.push({
      type: "Feature",
      properties: { speed: r.cls },
      geometry: { type: "LineString", coordinates: r.coords },
    });
  }
  return { type: "FeatureCollection", features };
}

export interface Mark {
  kind: "lean" | "brake";
  /** "38° L" or "0.70 G" is written by the screen from these. */
  value: number;
  side?: "left" | "right";
  index: number;
}

/** The points worth a marker: the peak lean and the hardest braking. */
export function marksOf(r: Review): Mark[] {
  const marks: Mark[] = [];
  const lean =
    r.peakLeft && r.peakRight
      ? r.peakLeft.value >= r.peakRight.value
        ? { peak: r.peakLeft, side: "left" as const }
        : { peak: r.peakRight, side: "right" as const }
      : r.peakLeft
        ? { peak: r.peakLeft, side: "left" as const }
        : r.peakRight
          ? { peak: r.peakRight, side: "right" as const }
          : null;
  if (lean) marks.push({ kind: "lean", value: lean.peak.value, side: lean.side, index: lean.peak.index });
  if (r.brake) marks.push({ kind: "brake", value: r.brake.value, index: r.brake.index });
  return marks;
}

export function marksCollection(points: TrackPoint[], marks: Mark[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: marks.map((m) => ({
      type: "Feature",
      properties: { kind: m.kind, value: m.value, side: m.side ?? "" },
      geometry: { type: "Point", coordinates: [points[m.index]!.lon, points[m.index]!.lat] },
    })),
  };
}

export const trackBounds = (points: TrackPoint[]): LatLon[] => points.map((p) => [p.lat, p.lon]);

// ---- The profiles

export interface Sample {
  distM: number;
  kmh: number;
  altitudeM: number | null;
  /** The index of the point it stands for. */
  index: number;
}

/** About `n` samples spread evenly over the distance, for the profiles. */
export function profile(points: TrackPoint[], n = 60): Sample[] {
  if (points.length === 0) return [];
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    cum.push(cum[i - 1]! + haversineM([a.lat, a.lon], [b.lat, b.lon]));
  }
  const total = cum[cum.length - 1]!;
  const out: Sample[] = [];
  let i = 0;
  let from = 0;
  for (let k = 0; k < n; k++) {
    const target = total === 0 ? 0 : (total * k) / Math.max(1, n - 1);
    while (i < points.length - 1 && cum[i]! < target) i++;
    // The fastest point of the stretch since the last sample, not only the one point: a profile that skips a peak lies.
    let mps = 0;
    for (let j = from; j <= i; j++) mps = Math.max(mps, speedAt(points, j));
    from = i + 1;
    out.push({ distM: cum[i]!, kmh: mps * 3.6, altitudeM: points[i]!.altitudeM ?? null, index: i });
  }
  return out;
}

// ---- The replay

export interface Timeline {
  /** The replay time of each point, ms: a gap longer than STOP_S counts as STOP_S. */
  at: number[];
  totalMs: number;
}

export function timeline(points: TrackPoint[]): Timeline {
  const at: number[] = [];
  let t = 0;
  points.forEach((p, i) => {
    if (i > 0) t += Math.min(Math.max(0, p.time - points[i - 1]!.time), STOP_S * 1000);
    at.push(t);
  });
  return { at, totalMs: t };
}

export interface ReplayState {
  lat: number;
  lon: number;
  /** Time of day of the ride at this moment, ms since 1970. */
  time: number;
  kmh: number;
  altitudeM: number | null;
  leanDeg: number | null;
  brakingG: number | null;
  /** The point just before, and 0 to 1 over the whole replay. */
  index: number;
  progress: number;
}

/** Where the ride is `replayMs` into its replay: between two points, linearly. */
export function replayAt(points: TrackPoint[], tl: Timeline, replayMs: number): ReplayState | null {
  if (points.length === 0) return null;
  const ms = Math.max(0, Math.min(tl.totalMs, replayMs));
  let i = 0;
  while (i < points.length - 1 && tl.at[i + 1]! <= ms) i++;
  const a = points[i]!;
  const b = points[Math.min(i + 1, points.length - 1)]!;
  const span = tl.at[Math.min(i + 1, points.length - 1)]! - tl.at[i]!;
  const f = span > 0 ? (ms - tl.at[i]!) / span : 0;
  const mix = (x: number, y: number) => x + (y - x) * f;
  const opt = (x: number | undefined, y: number | undefined): number | null =>
    x === undefined ? null : y === undefined ? x : mix(x, y);
  return {
    lat: mix(a.lat, b.lat),
    lon: mix(a.lon, b.lon),
    time: mix(a.time, b.time),
    kmh: mix(speedAt(points, i), speedAt(points, Math.min(i + 1, points.length - 1))) * 3.6,
    altitudeM: opt(a.altitudeM, b.altitudeM),
    leanDeg: opt(a.leanDeg, b.leanDeg),
    brakingG: opt(a.brakingG, b.brakingG),
    index: i,
    progress: tl.totalMs > 0 ? ms / tl.totalMs : 0,
  };
}

export const REPLAY_SPEEDS = [10, 30, 100, 300] as const;
export const DEFAULT_REPLAY_SPEED = 30;
export const nextReplaySpeed = (s: number): number =>
  REPLAY_SPEEDS[(REPLAY_SPEEDS.indexOf(s as (typeof REPLAY_SPEEDS)[number]) + 1) % REPLAY_SPEEDS.length]!;
