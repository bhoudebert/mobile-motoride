import { formatDistance } from "./format.ts";
import { bearingDeg, haversineM } from "./geo.ts";
import { angleDiff, compassDirection, relativeDirection, travelHeading } from "./heading.ts";
import { ANNOUNCE_TURN_M, PASSED_AFTER_M, THEN_WITHIN_M, instructionAt, type Instruction } from "./instruction.ts";
import {
  JUNCTION_PASSED_M,
  junctionAhead,
  junctionHeadline,
  junctionSpeech,
  junctionText,
  type JunctionAhead,
} from "./junctions.ts";
import { countryAt, policyOf, spanText, stricter } from "./cameraPolicy.ts";
import { isOver, limitAt, ZONE_LOOKAHEAD_M, type SpeedLimit } from "./limits.ts";
import { REJOIN_AHEAD_M } from "./approach.ts";
import { bearingAt, pointAt, snapToLine } from "./track.ts";
import type { Corner, Fix, LatLon, PreparedRoadbook } from "./types.ts";
import { t } from "./i18n/index.ts";

export const OFF_ROUTE_M = 50;
export const OFF_ROUTE_FIXES = 3;
export const APPROACH_HANDOVER_M = 15;
export const WINDOW_BEHIND_M = 100;
export const WINDOW_AHEAD_M = 1000;
/** Heading this far from the line's direction, for 3 fixes, is the wrong way (spec ride-navigation). */
export const WRONG_WAY_DEG = 120;
export const WRONG_WAY_FIXES = 3;
/** A zone is warned only to a rider within this angle of the traffic it watches (spec danger-zones). */
export const WATCHED_WITHIN_DEG = 90;
const ZONE_PASSED_M = 30;
const LOOKAHEAD_S = 8;
const LOOKAHEAD_MIN_M = 150;
const LOOKAHEAD_MAX_M = 600;

export interface CornerWarning {
  corner: Corner;
  distanceM: number;
  /** Phrase to display and speak. */
  text: string;
}

export interface ZoneWarning {
  /** `camera`: where it is, as the country allows; `zone`: a stretch with a camera somewhere in it (ADR 0021). */
  kind: "camera" | "zone";
  /** Where the camera is along the line, so the screen can count the distance down; unused for a `zone`. */
  atM: number;
  /** Where the warning ends: the camera for `camera`, the end of the stretch for `zone`. */
  endM: number;
  distanceM: number;
  /** The camera's limit, said with a `camera`. */
  kmh: number | null;
  /** Phrase to display and speak: a `zone` never says camera or radar. */
  text: string;
}

/** Close to a turn: about this many seconds ahead, and no less or more than these distances (spec voice-guidance). */
export const NEAR_TURN_S = 6;
export const NEAR_TURN_MIN_M = 60;
export const NEAR_TURN_MAX_M = 200;
/** Within this of the end of the roadbook the rider has arrived. */
export const ARRIVED_M = 25;

export interface TurnWarning {
  /** Said at the first announcement (about 500 m), not close to the turn. */
  far: boolean;
  /** Phrase to speak, once. */
  text: string;
}

/** Leaving the route, being back on it, going the wrong way, arriving: said once each time it happens. */
export interface StatusWarning {
  kind: "wrongway" | "offroute" | "back" | "arrived";
  text: string;
}

export interface JunctionWarning {
  junction: JunctionAhead["junction"];
  /** Phrase to speak, once. */
  text: string;
}

/** Where to rejoin the roadbook after leaving it (spec ride-navigation, ADR 0012). */
export interface Rejoin {
  /** Distance along the roadbook of the point to rejoin. */
  atM: number;
  target: LatLon;
  distanceM: number;
  /** Bearing from the rider to the target, degrees from north. */
  bearingDeg: number;
}

export interface NavState {
  progressM: number;
  remainingM: number;
  distanceToLineM: number;
  offRoute: boolean;
  nextStop: { index: number; name: string; distanceM: number } | null;
  /** The next hairpin or sharp corner ahead, with its distance, for display. */
  nextCorner: { corner: Corner; distanceM: number } | null;
  instruction: Instruction;
  /** `approach` while riding to the start of the roadbook or back to it, `ride` on it. */
  phase: "approach" | "ride";
  /** Distance to the end of the approach while on it, else 0. */
  toStartM: number;
  /** Direction of the line where the rider is, degrees from north. */
  bearingDeg: number;
  /** The rider placed on the line (the fix itself while off route). */
  position: LatLon;
  /** The limit where the rider is and the next different one ahead (spec speed-limits). */
  speedLimit: SpeedLimit;
  /** GPS speed in km/h, null when unknown. */
  speedKmh: number | null;
  /** Above the limit by more than the tolerance. */
  over: boolean;
  /** Riding against the direction of the line (spec ride-navigation). */
  wrongWay: boolean;
  /** Where to rejoin the roadbook, while off route. */
  rejoin: Rejoin | null;
  /** Set only on the fix that raises it: once per corner and pass. */
  warning: CornerWarning | null;
  /** Set only on the fix that raises it: once per danger zone and pass. */
  zoneWarning: ZoneWarning | null;
  /** The roundabout or lanes to guide to now, while on the roadbook and on the line. */
  junction: JunctionAhead | null;
  /** Set only on the fix that raises it: once per junction and pass. */
  junctionWarning: JunctionWarning | null;
  /** Set only on the fix that raises it: the turn ahead, once far and once close, per pass. */
  turnWarning: TurnWarning | null;
  /** Set only on the fix that raises it. */
  statusWarning: StatusWarning | null;
}

/** Where the rider should be now: the last progress plus speed times the time since the last fix (1 s by default). */
function expectedM(progressM: number, fix: Fix, lastTime: number | null): number {
  const dt = lastTime !== null && fix.time > lastTime ? Math.min((fix.time - lastTime) / 1000, 5) : 1;
  return progressM + (fix.speedMps ?? 0) * dt;
}

export function lookaheadM(speedMps: number | null): number {
  return Math.min(LOOKAHEAD_MAX_M, Math.max(LOOKAHEAD_MIN_M, (speedMps ?? 0) * LOOKAHEAD_S));
}

const roundTo10 = (m: number) => Math.max(10, Math.round(m / 10) * 10);
const side = (d: "left" | "right") => t(`common.dir.${d}`);

export function warningText(corner: Corner, distanceM: number): string {
  return t(corner.severity === "hairpin" ? "nav.warn.hairpin" : "nav.warn.sharp", {
    direction: side(corner.direction),
    m: roundTo10(distanceM),
    kmh: corner.advisoryKmh,
  });
}

export interface Navigator {
  update(fix: Fix): NavState;
}

export interface NavigatorOptions {
  /** Warn of danger zones (ADR 0011); on in development, a release gate. */
  dangerZones?: boolean;
}

export function createNavigator(rb: PreparedRoadbook, options: NavigatorOptions = {}): Navigator {
  const { dangerZones = true } = options;
  const zonesWarned = new Set<number>();
  const junctionsWarned = new Set<number>();
  const turnsFar = new Set<number>();
  const turnsNear = new Set<number>();
  let wasOff = false;
  let wasWrong = false;
  let arrived = false;
  let pendingStatus: StatusWarning | null = null;
  const dangerous = rb.corners.filter((c) => c.severity !== "bend");
  const warned = new Set<number>();
  let progressM: number | null = null;
  let lastOnRouteM = 0;
  let farFixes = 0;
  let wrongFixes = 0;
  let lastTime: number | null = null;
  const target = rb.approachTarget === "route" ? "route" : "start";

  return {
    update(fix) {
      const pos: [number, number] = [fix.lat, fix.lon];
      const lost = farFixes >= OFF_ROUTE_FIXES;
      let snap =
        progressM === null
          ? snapToLine(rb.roadbook.line, rb.cumulativeM, pos)
          : lost
            ? // Lost: look everywhere, preferring the pass of the line nearest to where the rider last was.
              snapToLine(rb.roadbook.line, rb.cumulativeM, pos, 0, Infinity, lastOnRouteM)
            : snapToLine(
                rb.roadbook.line,
                rb.cumulativeM,
                pos,
                progressM - WINDOW_BEHIND_M,
                progressM + WINDOW_AHEAD_M,
                expectedM(progressM, fix, lastTime),
              );
      // A rider who left the window but is on the line elsewhere (a cut-off) is found by a full search.
      if (snap.offsetM > OFF_ROUTE_M && !lost) {
        const full = snapToLine(rb.roadbook.line, rb.cumulativeM, pos, 0, Infinity, lastOnRouteM);
        if (full.offsetM <= OFF_ROUTE_M) snap = full;
      }

      progressM = snap.progressM;
      const approaching = rb.approachM > 0 && progressM < rb.approachM - APPROACH_HANDOVER_M;
      // A straight-line approach is not a road: it cannot be left.
      farFixes = snap.offsetM > OFF_ROUTE_M && !(approaching && rb.approachDirect) ? farFixes + 1 : 0;
      const offRoute = farFixes >= OFF_ROUTE_FIXES;
      if (!offRoute && snap.offsetM <= OFF_ROUTE_M) lastOnRouteM = progressM;
      lastTime = fix.time;

      const lineBearing = bearingAt(rb.roadbook.line, rb.cumulativeM, progressM);
      const heading = travelHeading(fix.headingDeg, fix.speedMps);

      // Riding against the line for a few fixes is the wrong way; a standstill or a missing heading says nothing.
      if (!offRoute && heading !== null && angleDiff(heading, lineBearing) > WRONG_WAY_DEG) wrongFixes++;
      else if (heading !== null || offRoute) wrongFixes = 0;
      const wrongWay = wrongFixes >= WRONG_WAY_FIXES;

      // Passing a corner's end arms it again, so a loop ridden twice warns twice.
      dangerous.forEach((c, i) => {
        if (progressM! > c.endM) warned.delete(i);
      });

      const stopIndex = rb.stops.findIndex((s) => s.atM > progressM!);
      const stop = stopIndex >= 0 ? rb.stops[stopIndex]! : null;

      const nextIdx = dangerous.findIndex((c) => c.endM > progressM!);
      const next = nextIdx >= 0 ? dangerous[nextIdx]! : null;
      const distanceM = next ? Math.max(0, next.startM - progressM) : 0;

      const toStartM = approaching ? Math.max(0, rb.approachM - progressM) : 0;

      let warning: CornerWarning | null = null;
      if (next && !offRoute && !warned.has(nextIdx) && distanceM <= lookaheadM(fix.speedMps)) {
        warned.add(nextIdx);
        warning = { corner: next, distanceM, text: warningText(next, distanceM) };
      }

      // Passing a zone arms it again; a corner warning on the same fix keeps the zone's for the next one.
      rb.zones.forEach((z, i) => {
        if (progressM! > z.endM + ZONE_PASSED_M) zonesWarned.delete(i);
      });
      let zoneWarning: ZoneWarning | null = null;
      if (dangerZones && !offRoute && !warning) {
        // The rider's direction is the GPS heading when there is one, else the way the line goes.
        const travelling = heading ?? lineBearing;
        // What may be said is the stricter of the camera's country and the rider's own (spec danger-zones).
        const riderCountry = countryAt(rb.countrySegments, progressM);
        for (const [i, zone] of rb.zones.entries()) {
          if (zonesWarned.has(i) || progressM > zone.endM + ZONE_PASSED_M) continue;
          const policy = stricter(policyOf(zone.country), policyOf(riderCountry));
          const distanceM = Math.max(0, zone.atM - progressM);
          const due =
            policy === "exact"
              ? distanceM <= ZONE_LOOKAHEAD_M && progressM <= zone.atM + ZONE_PASSED_M
              : policy === "zones" && progressM >= zone.startM && progressM <= zone.endM;
          // A zone not allowed yet is kept for a rider who comes into a country that allows it.
          if (!due) continue;
          zonesWarned.add(i);
          const watched =
            zone.watched === null || zone.watched.some((w) => angleDiff(w, travelling) <= WATCHED_WITHIN_DEG);
          if (!watched) continue;
          zoneWarning =
            policy === "exact"
              ? {
                  kind: "camera",
                  atM: zone.atM,
                  endM: zone.atM,
                  distanceM,
                  kmh: zone.kmh,
                  text: t("nav.camera", { m: roundTo10(distanceM) }),
                }
              : {
                  kind: "zone",
                  atM: zone.atM,
                  endM: zone.endM,
                  distanceM: 0,
                  kmh: null,
                  text: t("nav.zone", { span: spanText(zone.endM - progressM) }),
                };
          break;
        }
      }

      // Said once each time it happens; held back, never lost, while a warning of danger is being given.
      if (offRoute && !wasOff) pendingStatus = { kind: "offroute", text: t("nav.status.offroute") };
      else if (!offRoute && wasOff) pendingStatus = { kind: "back", text: t("nav.status.back") };
      if (wrongWay && !wasWrong) pendingStatus = { kind: "wrongway", text: t("nav.status.wrongway") };
      wasOff = offRoute;
      wasWrong = wrongWay;
      const remainingM = Math.max(0, rb.totalM - progressM);
      if (remainingM > 500) arrived = false;
      else if (!arrived && !approaching && !offRoute && remainingM <= ARRIVED_M) {
        arrived = true;
        pendingStatus = { kind: "arrived", text: t("nav.status.arrived") };
      }
      let statusWarning: StatusWarning | null = null;
      if (pendingStatus && !warning && !zoneWarning) {
        statusWarning = pendingStatus;
        pendingStatus = null;
      }

      // Passing a junction arms it again. Lost, in the approach or against the line, no junction is guided to.
      rb.junctions.forEach((j, i) => {
        if (progressM! > j.endM + JUNCTION_PASSED_M) junctionsWarned.delete(i);
      });
      const junction = offRoute || approaching || wrongWay ? null : junctionAhead(rb.junctions, progressM);
      let junctionWarning: JunctionWarning | null = null;
      // A corner warning on the same fix is spoken first; the junction's turn comes on the next fix.
      if (junction && !warning && !zoneWarning && !statusWarning && !junctionsWarned.has(junction.index)) {
        junctionsWarned.add(junction.index);
        junctionWarning = { junction: junction.junction, text: junctionSpeech(junction.junction) };
      }

      // The next turn, said once far (about 500 m) and once close, never inside a roundabout that has its own guidance.
      rb.maneuvers.forEach((m, i) => {
        if (progressM! > m.atM + PASSED_AFTER_M) {
          turnsFar.delete(i);
          turnsNear.delete(i);
        }
      });
      let turnWarning: TurnWarning | null = null;
      const ti = rb.maneuvers.findIndex((m) => m.atM + PASSED_AFTER_M > progressM!);
      if (
        ti >= 0 &&
        !offRoute &&
        !wrongWay &&
        !junction &&
        !warning &&
        !zoneWarning &&
        !statusWarning &&
        !junctionWarning
      ) {
        const turn = rb.maneuvers[ti]!;
        const toTurnM = Math.max(0, turn.atM - progressM);
        const nearM = Math.min(NEAR_TURN_MAX_M, Math.max(NEAR_TURN_MIN_M, (fix.speedMps ?? 0) * NEAR_TURN_S));
        const following = rb.maneuvers[ti + 1];
        const then = following && following.atM - turn.atM <= THEN_WITHIN_M ? following.direction : null;
        if (toTurnM <= nearM && !turnsNear.has(ti)) {
          // Close: this is the only message of a rider who comes up to the turn without the far one.
          turnsNear.add(ti);
          turnsFar.add(ti);
          const text = turn.uturn ? t("nav.turn.uturn") : t("nav.turn.go", { direction: side(turn.direction) });
          turnWarning = {
            far: false,
            text: then ? t("nav.turn.then", { text, direction: side(then) }) : text,
          };
        } else if (toTurnM <= ANNOUNCE_TURN_M && toTurnM > nearM && !turnsFar.has(ti)) {
          turnsFar.add(ti);
          const m = Math.max(100, Math.round(toTurnM / 50) * 50);
          turnWarning = {
            far: true,
            text: turn.uturn
              ? t("nav.turn.farUturn", { m })
              : t("nav.turn.far", { m, direction: side(turn.direction) }),
          };
        }
      }

      const speedLimit = limitAt(rb, progressM);

      // Off route: the point of the line to rejoin, never behind where the rider was on it.
      let rejoin: Rejoin | null = null;
      if (offRoute) {
        const atM = Math.min(Math.max(snap.progressM, lastOnRouteM) + REJOIN_AHEAD_M, rb.totalM);
        const targetPoint = pointAt(rb.roadbook.line, rb.cumulativeM, atM);
        rejoin = {
          atM,
          target: targetPoint,
          distanceM: haversineM(pos, targetPoint),
          bearingDeg: bearingDeg(pos, targetPoint),
        };
      }

      return {
        progressM,
        remainingM: Math.max(0, rb.totalM - progressM),
        distanceToLineM: snap.offsetM,
        offRoute,
        nextStop: stop ? { index: stopIndex, name: stop.name, distanceM: stop.atM - progressM } : null,
        nextCorner: next ? { corner: next, distanceM } : null,
        instruction: instructionFor({
          rb,
          progressM,
          approaching,
          toStartM,
          target,
          wrongWay,
          rejoin,
          heading,
          junction,
        }),
        phase: approaching ? "approach" : "ride",
        toStartM,
        bearingDeg: lineBearing,
        position: offRoute ? pos : pointAt(rb.roadbook.line, rb.cumulativeM, progressM),
        speedLimit,
        speedKmh: fix.speedMps === null || fix.speedMps < 0 ? null : fix.speedMps * 3.6,
        over: isOver(fix.speedMps, speedLimit.kmh),
        wrongWay,
        rejoin,
        warning,
        zoneWarning,
        junction,
        junctionWarning,
        turnWarning,
        statusWarning,
      };
    },
  };
}

function instructionFor(c: {
  rb: PreparedRoadbook;
  progressM: number;
  approaching: boolean;
  toStartM: number;
  target: "start" | "route";
  wrongWay: boolean;
  rejoin: Rejoin | null;
  heading: number | null;
  junction: JunctionAhead | null;
}): Instruction {
  if (c.rejoin) {
    const where =
      c.heading !== null ? relativeDirection(c.rejoin.bearingDeg, c.heading) : compassDirection(c.rejoin.bearingDeg);
    return {
      kind: "rejoin",
      distanceM: c.rejoin.distanceM,
      text: t("nav.rejoin", { distance: formatDistance(c.rejoin.distanceM), where }),
      then: null,
      relativeDeg: c.heading !== null ? (((c.rejoin.bearingDeg - c.heading) % 360) + 360) % 360 : null,
    };
  }
  if (c.wrongWay) return { kind: "uturn", distanceM: 0, text: t("nav.uturnWrong"), then: null };
  if (c.approaching && c.rb.approachDirect) {
    return {
      kind: "straight",
      distanceM: c.toStartM,
      text: t("nav.straightTo", {
        name: c.rb.approachName ?? t(`nav.target.${c.target}`),
        distance: formatDistance(c.toStartM),
      }),
      then: null,
    };
  }
  if (c.junction) {
    const { junction, distanceM } = c.junction;
    return { kind: junction.kind, distanceM, text: junctionText(junction), then: null, ...junctionHeadline(junction) };
  }
  return instructionAt(c.rb, c.progressM);
}
