import { getLanguage, t } from "./i18n/index.ts";
import type { LaneTurn, PreparedJunction, Roadbook } from "./types.ts";

/** A roundabout is shown and announced from this far ahead, a lane guide from the other (spec junction-guidance). */
export const ROUNDABOUT_GUIDE_M = 300;
export const LANES_GUIDE_M = 600;
/** A junction is behind the rider this far past its end. */
export const JUNCTION_PASSED_M = 30;

/** The junctions of a roadbook placed along the line. */
export function junctionsOf(rb: Roadbook, cumulativeM: number[]): PreparedJunction[] {
  const at = (i: number) => cumulativeM[i] ?? 0;
  return (rb.junctions ?? []).map((j) =>
    j.kind === "roundabout" ? { ...j, atM: at(j.at), endM: at(j.to) } : { ...j, atM: at(j.at), endM: at(j.at) },
  );
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 22 -> "22nd"; "1re", "2e" in French. */
export function ordinal(n: number): string {
  if (getLanguage() === "fr") return n === 1 ? "1re" : `${n}e`;
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13 ? "th" : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** 1 -> "first" ... 12 -> "twelfth", then "13th". */
export const ordinalWord = (n: number): string => (n >= 1 && n <= 12 ? t(`nav.ord.${n}` as "nav.ord.1") : ordinal(n));

const list = (nums: number[]): string =>
  nums.length === 1
    ? `${nums[0]}`
    : t("nav.list.last", { head: nums.slice(0, -1).join(", "), last: nums[nums.length - 1]! });

/** "Keep left, lanes 1 and 2", "Keep in the right lane", "Stay in lanes 2 and 3 of 4". */
export function lanesPhrase(j: Extract<PreparedJunction, { kind: "lanes" }>): string {
  const lanes = j.use.map((u) => u + 1);
  const first = j.use[0]!;
  const last = j.use[j.use.length - 1]!;
  const block = last - first === j.use.length - 1;
  if (lanes.length === 1) {
    if (first === 0) return t("nav.lane.keepLeftLane");
    if (first === j.count - 1) return t("nav.lane.keepRightLane");
    return t("nav.lane.keepIn", { lane: lanes[0]!, count: j.count });
  }
  if (block && first === 0) return t("nav.lane.keepLeft", { list: list(lanes) });
  if (block && last === j.count - 1) return t("nav.lane.keepRight", { list: list(lanes) });
  return t("nav.lane.stay", { list: list(lanes), count: j.count });
}

/** The short form for the instruction bar, which has room for about fifteen characters: "Keep left" over "Lanes 1 and 2". */
export function junctionHeadline(j: PreparedJunction): { headline: string; detail: string } {
  if (j.kind === "roundabout")
    return { headline: t("nav.head.exit", { ordinal: ordinal(j.exit) }), detail: t("nav.head.roundabout") };
  const first = j.use[0]!;
  const last = j.use[j.use.length - 1]!;
  const block = last - first === j.use.length - 1;
  const lanes = j.use.map((u) => u + 1);
  const of = t("nav.head.ofCount", { count: j.count });
  if (lanes.length === 1) {
    if (first === 0)
      return { headline: t("nav.head.leftLane"), detail: t("nav.head.laneOf", { lane: 1, count: j.count }) };
    if (first === j.count - 1)
      return { headline: t("nav.head.rightLane"), detail: t("nav.head.laneOf", { lane: j.count, count: j.count }) };
    return { headline: t("nav.head.lane", { lane: lanes[0]! }), detail: of };
  }
  if (block && first === 0)
    return { headline: t("nav.head.keepLeft"), detail: t("nav.head.lanes", { list: list(lanes) }) };
  if (block && last === j.count - 1)
    return { headline: t("nav.head.keepRight"), detail: t("nav.head.lanes", { list: list(lanes) }) };
  return {
    headline:
      block && lanes.length >= 3
        ? t("nav.head.lanesRange", { from: lanes[0]!, to: lanes[lanes.length - 1]! })
        : t("nav.head.lanes", { list: list(lanes) }),
    detail: of,
  };
}

/** What the top of the screen says about a junction ahead, without the distance. */
export function junctionText(j: PreparedJunction): string {
  return j.kind === "roundabout" ? t("nav.junction.roundabout", { ordinal: ordinal(j.exit) }) : lanesPhrase(j);
}

/** What is spoken, once. */
export function junctionSpeech(j: PreparedJunction): string {
  return j.kind === "roundabout" ? t("nav.junction.say", { word: ordinalWord(j.exit) }) : lanesPhrase(j);
}

export interface JunctionAhead {
  index: number;
  junction: PreparedJunction;
  /** To where it begins; 0 once inside. */
  distanceM: number;
}

const reach = (j: PreparedJunction) => (j.kind === "roundabout" ? ROUNDABOUT_GUIDE_M : LANES_GUIDE_M);

/** The junction to guide to now: a roundabout in preference to a lane guide, the nearest first. */
export function junctionAhead(junctions: PreparedJunction[], progressM: number): JunctionAhead | null {
  const active = junctions.flatMap((junction, index) =>
    progressM <= junction.endM + JUNCTION_PASSED_M && junction.atM - progressM <= reach(junction)
      ? [{ index, junction, distanceM: Math.max(0, junction.atM - progressM) }]
      : [],
  );
  return active.find((a) => a.junction.kind === "roundabout") ?? active[0] ?? null;
}

export type { LaneTurn };
