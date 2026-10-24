import type { LatLon } from "./types.ts";

export const EARTH_RADIUS_M = 6_371_008.8;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(a: LatLon, b: LatLon): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Local flat projection in metres (east, north) around a reference latitude and longitude. */
export function project(p: LatLon, ref: LatLon): [x: number, y: number] {
  return [rad(p[1] - ref[1]) * Math.cos(rad(ref[0])) * EARTH_RADIUS_M, rad(p[0] - ref[0]) * EARTH_RADIUS_M];
}

export function unproject(xy: [number, number], ref: LatLon): LatLon {
  return [
    ref[0] + (xy[1] / EARTH_RADIUS_M) * (180 / Math.PI),
    ref[1] + (xy[0] / (EARTH_RADIUS_M * Math.cos(rad(ref[0])))) * (180 / Math.PI),
  ];
}

export function validLatLon(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** Initial bearing from a to b, degrees clockwise from north, 0 to 360. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const [x, y] = project(b, a);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}
