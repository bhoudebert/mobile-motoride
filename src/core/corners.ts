import { project } from "./geo.ts";
import { resample } from "./track.ts";
import type { Corner, LatLon, Severity } from "./types.ts";

export const SAMPLE_STEP_M = 10;
const HALF_SPAN = 2; // samples either side: points 20 m apart
const TURN_OVERLAP = HALF_SPAN; // a sample turns over 2 steps of path, neighbours overlap
export const BEND_RADIUS_M = 120;
export const SHARP_RADIUS_M = 60;
export const HAIRPIN_RADIUS_M = 25;
export const MIN_ANGLE_DEG = 30;
export const HAIRPIN_ANGLE_DEG = 100;
export const SHARP_ANGLE_DEG = 45;
const MAX_GAP_M = 30;
const COMFORT_LATERAL_MPS2 = 3;

/** Radius alone is not enough: a sparse GPX line makes small-angle kinks look tight, and junction turns are not reversals. */
export function severityOf(radiusM: number, angleDeg: number): Severity {
  if (radiusM < HAIRPIN_RADIUS_M && angleDeg >= HAIRPIN_ANGLE_DEG) return "hairpin";
  if (radiusM < SHARP_RADIUS_M && angleDeg >= SHARP_ANGLE_DEG) return "sharp";
  return "bend";
}

/** Speed at which a corner is ridden at a comfortable lateral acceleration, in km/h, rounded down to 5. */
export function advisoryKmh(radiusM: number): number {
  const kmh = Math.sqrt(COMFORT_LATERAL_MPS2 * radiusM) * 3.6;
  return Math.max(10, Math.floor(kmh / 5) * 5);
}

interface Sample {
  distM: number;
  radiusM: number;
  turnDeg: number;
  dir: 1 | -1;
}

function circle(a: [number, number], b: [number, number], c: [number, number]): Sample | null {
  const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  if (ab === 0 || bc === 0 || Math.abs(cross) < 1e-9) return null;
  const radiusM = (ab * bc * ca) / (2 * Math.abs(cross));
  const dot = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]);
  const turnDeg = (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
  return { distM: 0, radiusM, turnDeg, dir: cross > 0 ? 1 : -1 };
}

/** Corners of the line that call for a lower speed (ADR 0006, spec corner-warnings). */
export function detectCorners(line: LatLon[], cumulativeM: number[]): Corner[] {
  const pts = resample(line, cumulativeM, SAMPLE_STEP_M);
  if (pts.length < 2 * HALF_SPAN + 1) return [];
  const ref = pts[0]!.point;
  const xy = pts.map((p) => project(p.point, ref));

  const marked: Sample[] = [];
  for (let i = HALF_SPAN; i < pts.length - HALF_SPAN; i++) {
    const s = circle(xy[i - HALF_SPAN]!, xy[i]!, xy[i + HALF_SPAN]!);
    if (s && s.radiusM < BEND_RADIUS_M) marked.push({ ...s, distM: pts[i]!.distM });
  }

  const groups: Sample[][] = [];
  for (const s of marked) {
    const group = groups[groups.length - 1];
    const last = group?.[group.length - 1];
    if (group && last && last.dir === s.dir && s.distM - last.distM <= MAX_GAP_M) group.push(s);
    else groups.push([s]);
  }

  const corners: Corner[] = [];
  for (const g of groups) {
    // Each sample's turn spans 2 steps of path; neighbours overlap, so halve the sum.
    const angleDeg = g.reduce((sum, s) => sum + s.turnDeg, 0) / TURN_OVERLAP;
    if (angleDeg < MIN_ANGLE_DEG) continue;
    const minRadiusM = Math.min(...g.map((s) => s.radiusM));
    corners.push({
      startM: g[0]!.distM - SAMPLE_STEP_M * HALF_SPAN,
      endM: g[g.length - 1]!.distM + SAMPLE_STEP_M * HALF_SPAN,
      minRadiusM,
      direction: g[0]!.dir === 1 ? "left" : "right",
      angleDeg,
      severity: severityOf(minRadiusM, angleDeg),
      advisoryKmh: advisoryKmh(minRadiusM),
    });
  }
  return corners.map((c) => ({ ...c, startM: Math.max(0, c.startM) }));
}
