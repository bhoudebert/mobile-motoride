/** The eight points of the compass, clockwise from north. */
export const POINTS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export type Point = (typeof POINTS)[number];

/** A heading in degrees, wrapped to 0 up to 360. */
export const wrapDeg = (deg: number): number => ((deg % 360) + 360) % 360;

/** The point a heading lies in: each covers 45 degrees centred on it (north is 337.5 to 22.5). */
export function pointOf(headingDeg: number): Point {
  return POINTS[Math.floor((wrapDeg(headingDeg) + 22.5) / 45) % 8]!;
}

/** Where north is on a screen turned along the heading: the needle turns the other way, 0 when heading north. */
export const needleDeg = (headingDeg: number): number => wrapDeg(-headingDeg);
