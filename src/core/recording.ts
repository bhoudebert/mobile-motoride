import { haversineM } from "./geo.ts";
import { slugify } from "./gpx.ts";
import { Elevation, type MotionReading } from "./instruments.ts";
import type { Fix, RoadbookOrigin } from "./types.ts";
import { t } from "./i18n/index.ts";

/** Fixes worse than this are not kept (spec ride-recording). */
export const MIN_ACCURACY_M = 50;
/** Standing still: a fix within this of the last kept one adds nothing. */
export const STILL_M = 5;
/** A track shorter than this is not a ride. */
export const MIN_RIDE_M = 50;
/** The track is written to the phone this often while it runs. */
export const CHECKPOINT_MS = 60_000;

export interface TrackPoint {
  lat: number;
  lon: number;
  /** Milliseconds since 1970, from the GPS. */
  time: number;
  speedMps: number | null;
  /** Metres above sea level, when the GPS gave it. */
  altitudeM?: number;
  /** From the phone's sensors, when lean or braking was on and the phone calibrated (spec ride-recording, instruments). */
  leanDeg?: number;
  lateralG?: number;
  brakingG?: number;
  turnRate?: number;
}

export type RideState = "completed" | "stopped" | "recovered";
export const STATES_OF_RIDE: readonly RideState[] = ["completed", "stopped", "recovered"];

/** What the list of rides needs, kept beside the track so the list never reads the track. */
export interface RideMeta {
  id: string;
  roadbookId: string;
  roadbookName: string;
  origin?: RoadbookOrigin;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  points: number;
  state: RideState;
  /** Height gained, when the GPS gave altitudes; the peak leans, when lean was on. */
  climbM?: number;
  peakLeftDeg?: number;
  peakRightDeg?: number;
}

/** Whether a fix goes into the track: a good one, and not the same place again. */
export function keeps(last: TrackPoint | null, fix: Fix): boolean {
  if (fix.accuracyM !== null && fix.accuracyM > MIN_ACCURACY_M) return false;
  if (!last) return true;
  if (fix.time <= last.time) return false;
  return haversineM([last.lat, last.lon], [fix.lat, fix.lon]) > STILL_M || (fix.speedMps ?? 0) > 1;
}

export const pointOf = (fix: Fix, motion: MotionReading | null = null): TrackPoint => ({
  lat: fix.lat,
  lon: fix.lon,
  time: fix.time,
  speedMps: fix.speedMps,
  ...(typeof fix.altitudeM === "number" && Number.isFinite(fix.altitudeM) ? { altitudeM: fix.altitudeM } : {}),
  ...(motion
    ? {
        leanDeg: motion.leanDeg,
        lateralG: motion.lateralG,
        brakingG: motion.brakingG,
        turnRate: motion.turnRate,
      }
    : {}),
});

/** The climb, and the peak leans, of a track: only what the track has the readings for. */
export function summarizeTrack(points: TrackPoint[]): Pick<RideMeta, "climbM" | "peakLeftDeg" | "peakRightDeg"> {
  const out: Pick<RideMeta, "climbM" | "peakLeftDeg" | "peakRightDeg"> = {};
  if (points.some((p) => p.altitudeM !== undefined)) {
    const e = new Elevation();
    let climb = 0;
    for (const p of points) climb = e.push(p.altitudeM, p.lat, p.lon, p.speedMps).climbM;
    out.climbM = Math.round(climb);
  }
  const leans = points.flatMap((p) => (p.leanDeg === undefined ? [] : [p.leanDeg]));
  if (leans.length > 0) {
    out.peakLeftDeg = Math.round(Math.max(0, ...leans));
    out.peakRightDeg = Math.round(Math.max(0, ...leans.map((l) => -l)));
  }
  return out;
}

/** "Climb 412 m · Lean 38° L · 41° R" for the list of rides; null when there is nothing to say. */
export function rideExtras(meta: RideMeta): string | null {
  const parts: string[] = [];
  if (meta.climbM !== undefined) parts.push(t("rec.climb", { m: meta.climbM }));
  if (meta.peakLeftDeg !== undefined && meta.peakRightDeg !== undefined)
    parts.push(t("rec.lean", { left: meta.peakLeftDeg, right: meta.peakRightDeg }));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function trackDistanceM(points: TrackPoint[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++)
    m += haversineM([points[i - 1]!.lat, points[i - 1]!.lon], [points[i]!.lat, points[i]!.lon]);
  return m;
}

/** A track that is worth keeping: two points and at least 50 m. */
export const worthKeeping = (points: TrackPoint[]): boolean =>
  points.length >= 2 && trackDistanceM(points) >= MIN_RIDE_M;

const two = (n: number) => String(n).padStart(2, "0");

/** "2026-10-19T09-30-05-pays-des-collines": sorts by date and names the roadbook. */
export function rideId(startedAt: number, roadbookName: string): string {
  const d = new Date(startedAt);
  const stamp = `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}T${two(d.getUTCHours())}-${two(d.getUTCMinutes())}-${two(d.getUTCSeconds())}`;
  return `${stamp}-${slugify(roadbookName).slice(0, 40)}`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const iso = (ms: number) => new Date(ms).toISOString();

export const NS = "https://github.com/bhoudebert/mobile-motoride";

/** The ride as a GPX 1.1: the track, and in the metadata the roadbook it followed (spec ride-recording). */
export function rideToGpx(meta: RideMeta, points: TrackPoint[]): string {
  const attrs = [
    `roadbook="${esc(meta.roadbookId)}"`,
    `name="${esc(meta.roadbookName)}"`,
    ...(meta.origin
      ? [
          `source="${esc(meta.origin.app)}"`,
          ...(meta.origin.roadbook !== undefined ? [`sourceRoadbook="${meta.origin.roadbook}"`] : []),
          ...(meta.origin.ride !== undefined ? [`sourceRide="${meta.origin.ride}"`] : []),
          ...(meta.origin.name !== undefined ? [`sourceName="${esc(meta.origin.name)}"`] : []),
        ]
      : []),
    `state="${meta.state}"`,
    `distanceM="${Math.round(meta.distanceM)}"`,
    `startedAt="${iso(meta.startedAt)}"`,
    `endedAt="${iso(meta.endedAt)}"`,
    ...(meta.climbM !== undefined ? [`climbM="${meta.climbM}"`] : []),
    ...(meta.peakLeftDeg !== undefined ? [`peakLeftDeg="${meta.peakLeftDeg}"`] : []),
    ...(meta.peakRightDeg !== undefined ? [`peakRightDeg="${meta.peakRightDeg}"`] : []),
  ].join(" ");
  const title = `${meta.roadbookName}, ${iso(meta.startedAt).slice(0, 10)}`;
  const trkpts = points
    .map((p) => {
      const ext = [
        p.speedMps !== null ? `<motoride:speed>${p.speedMps.toFixed(1)}</motoride:speed>` : "",
        p.leanDeg !== undefined ? `<motoride:lean>${p.leanDeg.toFixed(1)}</motoride:lean>` : "",
        p.lateralG !== undefined ? `<motoride:latg>${p.lateralG.toFixed(2)}</motoride:latg>` : "",
        p.brakingG !== undefined ? `<motoride:brakeg>${p.brakingG.toFixed(2)}</motoride:brakeg>` : "",
        p.turnRate !== undefined ? `<motoride:turn>${p.turnRate.toFixed(3)}</motoride:turn>` : "",
      ].join("");
      return (
        `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">` +
        (p.altitudeM !== undefined ? `<ele>${p.altitudeM.toFixed(1)}</ele>` : "") +
        `<time>${iso(p.time)}</time>` +
        (ext ? `<extensions>${ext}</extensions>` : "") +
        `</trkpt>`
      );
    })
    .join("\n      ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoRide" xmlns="http://www.topografix.com/GPX/1/1" xmlns:motoride="${NS}">
  <metadata>
    <name>${esc(title)}</name>
    <time>${iso(meta.startedAt)}</time>
    <extensions><motoride:ride ${attrs}/></extensions>
  </metadata>
  <trk>
    <name>${esc(title)}</name>
    <trkseg>
      ${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const STATES: readonly string[] = ["completed", "stopped", "recovered"];

export const serializeMeta = (meta: RideMeta): string => JSON.stringify({ v: 1, ...meta });

/** The meta of a ride read back; null for anything that is not one. */
export function parseMeta(text: string): RideMeta | null {
  try {
    const r = JSON.parse(text) as Record<string, unknown>;
    if (
      r["v"] !== 1 ||
      typeof r["id"] !== "string" ||
      typeof r["roadbookId"] !== "string" ||
      typeof r["roadbookName"] !== "string" ||
      !finite(r["startedAt"]) ||
      !finite(r["endedAt"]) ||
      !finite(r["distanceM"]) ||
      !finite(r["points"]) ||
      typeof r["state"] !== "string" ||
      !STATES.includes(r["state"])
    )
      return null;
    const { v: _v, ...meta } = r;
    for (const k of ["climbM", "peakLeftDeg", "peakRightDeg"]) if (k in meta && !finite(meta[k])) delete meta[k];
    return meta as unknown as RideMeta;
  } catch {
    return null;
  }
}

/** The label of a ride's state, in the language in use. */
export const RIDE_STATE_LABEL: Record<RideState, string> = {
  get completed() {
    return t("rec.state.completed");
  },
  get stopped() {
    return t("rec.state.stopped");
  },
  get recovered() {
    return t("rec.state.recovered");
  },
};

/** "2 h 05", "48 min". */
export function durationText(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${two(min % 60)}` : `${min} min`;
}
