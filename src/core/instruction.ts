import { formatDistance } from "./format.ts";
import type { PreparedRoadbook } from "./types.ts";
import { t } from "./i18n/index.ts";

export const ANNOUNCE_TURN_M = 500;
export const THEN_WITHIN_M = 300;
export const PASSED_AFTER_M = 15;

export type InstructionKind = "straight" | "left" | "right" | "uturn" | "finish" | "rejoin" | "roundabout" | "lanes";

export interface Instruction {
  kind: InstructionKind;
  distanceM: number;
  /** "Straight 1.2 km", "Left in 150 m", "Finish in 300 m". */
  text: string;
  /** "then left" when another turn follows closely. */
  then: "left" | "right" | null;
  /** For a rejoin: where the target lies relative to the rider's heading, degrees clockwise, when the heading is known. */
  relativeDeg?: number | null;
  /** A junction's short form for the bar: "2nd exit" over "Roundabout"; `text` stays the whole sentence. */
  headline?: string;
  detail?: string;
}

/** What comes next on the line, in the words of a GPS (spec turn-instructions). */
export function instructionAt(rb: PreparedRoadbook, progressM: number): Instruction {
  const i = rb.maneuvers.findIndex((m) => m.atM + PASSED_AFTER_M > progressM);
  if (i < 0) {
    const distanceM = Math.max(0, rb.totalM - progressM);
    const near = distanceM < ANNOUNCE_TURN_M;
    return {
      kind: near ? "finish" : "straight",
      distanceM,
      text: t(near ? "nav.finishIn" : "nav.straight", { distance: formatDistance(distanceM) }),
      then: null,
    };
  }
  const next = rb.maneuvers[i]!;
  const distanceM = Math.max(0, next.atM - progressM);
  const following = rb.maneuvers[i + 1];
  const then = following && following.atM - next.atM <= THEN_WITHIN_M ? following.direction : null;
  if (distanceM >= ANNOUNCE_TURN_M) {
    return {
      kind: "straight",
      distanceM,
      text: t("nav.straight", { distance: formatDistance(distanceM) }),
      then: null,
    };
  }
  const kind: InstructionKind = next.uturn ? "uturn" : next.direction;
  return { kind, distanceM, text: t(`nav.in.${kind}` as "nav.in.left", { distance: formatDistance(distanceM) }), then };
}
