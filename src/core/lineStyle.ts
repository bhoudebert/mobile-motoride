/** The share of a line already ridden, 0 to 1; 0 when the length is not known. */
export function ridden(progressM: number, totalM: number): number {
  if (!(totalM > 0) || !(progressM > 0)) return 0;
  return Math.min(1, progressM / totalM);
}

/**
 * The colour of a line along its length, for a `line-gradient` (the source keeps `lineMetrics`): `behind` up to the
 * share ridden, `ahead` after it, with a hard step between. The share is rounded down to a thousandth, so the style
 * changes every 250 m of a 250 km ride and not on every fix. Never throws on a share of 0 or 1.
 */
export function directionGradient(share: number, behind: string, ahead: string): unknown[] {
  const p = Math.floor(Math.min(1, Math.max(0, share)) * 1000) / 1000;
  const line = ["line-progress"];
  if (p <= 0) return ["interpolate", ["linear"], line, 0, ahead, 1, ahead];
  if (p >= 1) return ["interpolate", ["linear"], line, 0, behind, 1, behind];
  // Stops must rise strictly: the step is one ten-thousandth wide.
  return ["interpolate", ["linear"], line, 0, behind, p, behind, p + 0.0001, ahead, 1, ahead];
}

/** How far ahead of the rider the bright stretch goes. */
export const NEXT_STRETCH_M = 3000;
/** The start of the stretch moves in steps of this, so it is sent to the map every 50 m and not on every fix. */
export const NEXT_STEP_M = 50;

/**
 * The part of a line from `fromM` to `toM` along it, as [lat, lon] points, the ends cut exactly on the line. Used for
 * the stretch ahead of the rider, which is drawn on top of the whole line so that a road ridden out and back, or a loop
 * crossing itself, shows only the way to ride now (spec ride-navigation, "Direction on the line").
 */
export function sliceLine(
  line: readonly (readonly [number, number])[],
  cumulativeM: readonly number[],
  fromM: number,
  toM: number,
): [number, number][] {
  const total = cumulativeM[cumulativeM.length - 1] ?? 0;
  const from = Math.min(Math.max(fromM, 0), total);
  const to = Math.min(Math.max(toM, from), total);
  if (line.length < 2 || to <= from) return [];
  const at = (d: number): [number, number] => {
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
  };
  const out: [number, number][] = [at(from)];
  for (let i = 0; i < line.length; i++) {
    const d = cumulativeM[i] ?? 0;
    if (d > from && d < to) out.push([line[i]![0], line[i]![1]]);
  }
  out.push(at(to));
  return out;
}

/** Where the bright stretch starts and ends for a rider at `progressM` of a roadbook `totalM` long. */
export function nextStretch(progressM: number, totalM: number): { fromM: number; toM: number } {
  const from = Math.floor(Math.max(0, progressM) / NEXT_STEP_M) * NEXT_STEP_M;
  return { fromM: Math.min(from, totalM), toM: Math.min(from + NEXT_STRETCH_M, totalM) };
}
