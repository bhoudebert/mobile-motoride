import { pointAt } from "./track.ts";
import type { Fix, PreparedRoadbook } from "./types.ts";

export const DEMO_SPEED_MPS = 100 / 3.6;
const DEMO_LEAD_M = 700;

/** Where the demo ride starts: 700 m before the first hairpin or sharp corner, or at the start. */
export function demoStartM(rb: PreparedRoadbook): number {
  const first = rb.corners.find((c) => c.severity !== "bend");
  return first ? Math.max(0, first.startM - DEMO_LEAD_M) : 0;
}

/** A fix as if the rider were at `progressM` on the line, on the line. */
export function simulatedFix(rb: PreparedRoadbook, progressM: number, speedMps: number, time: number): Fix {
  const [lat, lon] = pointAt(rb.roadbook.line, rb.cumulativeM, progressM);
  return { lat, lon, speedMps, accuracyM: 5, time };
}
