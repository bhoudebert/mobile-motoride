import { t, type MessageKey } from "./i18n/index.ts";

/** Smallest angle between two bearings, 0 to 180 degrees. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(((((a - b) % 360) + 540) % 360) - 180);
  return d;
}

/** Below this speed a GPS heading is not reliable (spec ride-navigation). */
export const HEADING_MIN_SPEED_MPS = 10 / 3.6;

/**
 * The rider's direction of travel: the GPS heading when moving fast enough and known, otherwise null.
 * `headingDeg` is the raw heading of the fix; expo-location reports -1 when it has none.
 */
export function travelHeading(headingDeg: number | null | undefined, speedMps: number | null): number | null {
  if (headingDeg === null || headingDeg === undefined || headingDeg < 0 || headingDeg > 360) return null;
  if (speedMps === null || speedMps < HEADING_MIN_SPEED_MPS) return null;
  return headingDeg % 360;
}

const octant = (deg: number) => Math.round((((deg % 360) + 360) % 360) / 45) % 8;

/** "ahead left", "behind": where `targetBearing` lies relative to the rider's heading. */
export function relativeDirection(targetBearing: number, heading: number): string {
  return t(`nav.rel.${octant(targetBearing - heading)}` as MessageKey);
}

/** "north-east": a bearing as a compass point, for a rider whose heading is unknown. */
export function compassDirection(bearing: number): string {
  return t(`nav.compass.${octant(bearing)}` as MessageKey);
}
