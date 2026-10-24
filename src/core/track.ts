import { bearingDeg, haversineM, project } from "./geo.ts";
import type { LatLon } from "./types.ts";

export function cumulativeDistances(line: LatLon[]): number[] {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push((out[i - 1] ?? 0) + haversineM(line[i - 1]!, line[i]!));
  return out;
}

/** Point at `distM` along the line, interpolated inside its segment. */
export function pointAt(line: LatLon[], cumulativeM: number[], distM: number): LatLon {
  const total = cumulativeM[cumulativeM.length - 1] ?? 0;
  const d = Math.min(Math.max(distM, 0), total);
  let lo = 0;
  let hi = cumulativeM.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((cumulativeM[mid] ?? 0) <= d) lo = mid;
    else hi = mid;
  }
  const a = line[lo]!;
  const b = line[hi]!;
  const span = (cumulativeM[hi] ?? 0) - (cumulativeM[lo] ?? 0);
  const t = span > 0 ? (d - (cumulativeM[lo] ?? 0)) / span : 0;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** The line sampled every `stepM` metres, ends included. */
export function resample(line: LatLon[], cumulativeM: number[], stepM: number): { distM: number; point: LatLon }[] {
  const total = cumulativeM[cumulativeM.length - 1] ?? 0;
  const out: { distM: number; point: LatLon }[] = [];
  for (let d = 0; d < total; d += stepM) out.push({ distM: d, point: pointAt(line, cumulativeM, d) });
  out.push({ distM: total, point: line[line.length - 1]! });
  return out;
}

export interface Snap {
  /** Distance along the line of the nearest point. */
  progressM: number;
  /** Distance from the position to the line. */
  offsetM: number;
}

/** First segment whose end is at or beyond `distM`. */
function segmentAt(cumulativeM: number[], distM: number): number {
  let lo = 0;
  let hi = cumulativeM.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((cumulativeM[mid + 1] ?? Infinity) < distM) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Offsets this close to the best one count as the same place: parallel passes of an out-and-back road. */
export const SAME_PLACE_M = 5;

/**
 * Nearest point of the line to `pos`, looking only at the part between
 * `fromM` and `toM`; the result is never before `fromM`. When several passes
 * of the line are equally near (an out-and-back road, a loop's start and
 * finish), the one closest to `nearM` wins, or the earliest without it.
 */
export function snapToLine(
  line: LatLon[],
  cumulativeM: number[],
  pos: LatLon,
  fromM = 0,
  toM = Infinity,
  nearM?: number,
): Snap {
  const first = segmentAt(cumulativeM, Math.max(fromM, 0));
  const candidates: Snap[] = [];
  for (let i = first; i < line.length - 1; i++) {
    if ((cumulativeM[i] ?? 0) > toM) break;
    const a = project(line[i]!, pos);
    const b = project(line[i + 1]!, pos);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const segM = (cumulativeM[i + 1] ?? 0) - (cumulativeM[i] ?? 0);
    const tMin = i === first && segM > 0 ? Math.min(1, Math.max(0, (fromM - (cumulativeM[i] ?? 0)) / segM)) : 0;
    const t = len2 > 0 ? Math.min(1, Math.max(tMin, (-a[0] * dx + -a[1] * dy) / len2)) : tMin;
    candidates.push({ progressM: (cumulativeM[i] ?? 0) + segM * t, offsetM: Math.hypot(a[0] + dx * t, a[1] + dy * t) });
  }
  if (candidates.length === 0) return { progressM: Math.max(fromM, 0), offsetM: Infinity };
  const bestOffset = Math.min(...candidates.map((c) => c.offsetM));
  const near = candidates.filter((c) => c.offsetM <= bestOffset + SAME_PLACE_M);
  if (nearM === undefined) return near.reduce((a, b) => (b.offsetM < a.offsetM - 1e-9 ? b : a));
  return near.reduce((a, b) => (Math.abs(b.progressM - nearM) < Math.abs(a.progressM - nearM) ? b : a));
}

/** Direction of the line at `distM`, measured over 16 m around it. */
export function bearingAt(line: LatLon[], cumulativeM: number[], distM: number): number {
  return bearingDeg(pointAt(line, cumulativeM, distM - 8), pointAt(line, cumulativeM, distM + 8));
}
