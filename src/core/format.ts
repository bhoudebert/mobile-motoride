import type { LatLon } from "./types.ts";
import { formatNumber } from "./i18n/index.ts";

/** "850 m" under a kilometre, "12.3 km" under 100, "123 km" above. */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  const km = m / 1000;
  const digits = km < 100 ? 1 : 0;
  return `${formatNumber(km, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false })} km`;
}

export function kmh(speedMps: number | null): number | null {
  return speedMps === null || speedMps < 0 ? null : Math.round(speedMps * 3.6);
}

/** West, south, east, north of a line. */
export function boundsOf(line: LatLon[]): [number, number, number, number] {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lat, lon] of line) {
    w = Math.min(w, lon);
    e = Math.max(e, lon);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return [w, s, e, n];
}
