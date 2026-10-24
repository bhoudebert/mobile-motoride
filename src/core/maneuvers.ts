import type { Corner, Maneuver } from "./types.ts";

export const MANEUVER_MIN_ANGLE_DEG = 55;
export const MANEUVER_MAX_SPAN_M = 90;
export const UTURN_MIN_ANGLE_DEG = 150;

/** Turns worth announcing: sharp and short, so junctions and hairpins, not the bends of a road (spec turn-instructions). */
export function maneuversOf(corners: Corner[]): Maneuver[] {
  return corners
    .filter(
      (c) =>
        c.angleDeg >= MANEUVER_MIN_ANGLE_DEG && (c.severity === "hairpin" || c.endM - c.startM <= MANEUVER_MAX_SPAN_M),
    )
    .map((c) => ({
      atM: (c.startM + c.endM) / 2,
      direction: c.direction,
      angleDeg: c.angleDeg,
      uturn: c.angleDeg >= UTURN_MIN_ANGLE_DEG,
    }));
}
