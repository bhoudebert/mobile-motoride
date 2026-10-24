import { haversineM } from "./geo.ts";
import { detectCorners } from "./corners.ts";
import { junctionsOf } from "./junctions.ts";
import { maneuversOf } from "./maneuvers.ts";
import { cumulativeDistances, snapToLine } from "./track.ts";
import { countryAt, zoneLengthM, zoneShare } from "./cameraPolicy.ts";
import type { CountrySegment, LimitSegment, PreparedRoadbook, PreparedStop, Roadbook, Zone } from "./types.ts";

export const LOOP_CLOSE_M = 500;
/** A camera farther than this from the line is on another road. */
export const CAMERA_MAX_OFFSET_M = 40;
/** Cameras closer than this make one zone. */
export const ZONE_MERGE_M = 150;

function limitSegmentsOf(rb: Roadbook, cumulativeM: number[]): LimitSegment[] {
  return (rb.limits ?? [])
    .map((l) => ({
      startM: cumulativeM[l.from] ?? 0,
      endM: cumulativeM[l.to] ?? cumulativeM[cumulativeM.length - 1] ?? 0,
      kmh: l.kmh,
      posted: l.posted,
      ...(l.road ? { road: l.road } : {}),
    }))
    .filter((s) => s.endM > s.startM)
    .sort((a, b) => a.startM - b.startM);
}

function countrySegmentsOf(rb: Roadbook, cumulativeM: number[]): CountrySegment[] {
  return (rb.countries ?? [])
    .map((c) => ({
      startM: cumulativeM[c.from] ?? 0,
      endM: cumulativeM[c.to] ?? cumulativeM[cumulativeM.length - 1] ?? 0,
      code: c.code,
    }))
    .filter((s) => s.endM > s.startM);
}

/** The limit of the stretch at `m`, or null: it tells the kind of road a camera is on. */
function limitKmhAt(segments: LimitSegment[], m: number): number | null {
  return segments.find((s) => m >= s.startM && m < s.endM)?.kmh ?? null;
}

function zonesOf(rb: Roadbook, cumulativeM: number[], countries: CountrySegment[], limits: LimitSegment[]): Zone[] {
  const found: Array<{ atM: number; watched: number | null; kmh: number | null; lat: number; lon: number }> = [];
  for (const c of rb.cameras ?? []) {
    const snap = snapToLine(rb.line, cumulativeM, [c.lat, c.lon]);
    if (snap.offsetM > CAMERA_MAX_OFFSET_M) continue;
    // A camera faces approaching traffic: it watches vehicles travelling the opposite way.
    const watched =
      c.bearing === null || c.bearing === undefined || c.direction === "both" ? null : (c.bearing + 180) % 360;
    found.push({ atM: snap.progressM, watched, kmh: c.kmh, lat: c.lat, lon: c.lon });
  }
  found.sort((a, b) => a.atM - b.atM);
  const zones: Zone[] = [];
  for (const f of found) {
    const last = zones[zones.length - 1];
    if (last && f.atM - last.atM < ZONE_MERGE_M) {
      // Two cameras at one place, often one per carriageway: the zone watches both ways they do.
      last.watched = last.watched === null || f.watched === null ? null : [...last.watched, f.watched];
    } else {
      // A danger zone has the length the road asks for, and the camera lies inside it, never at its middle (ADR 0021).
      const length = zoneLengthM(limitKmhAt(limits, f.atM) ?? f.kmh);
      const share = zoneShare(f.lat, f.lon);
      zones.push({
        atM: f.atM,
        watched: f.watched === null ? null : [f.watched],
        country: countryAt(countries, f.atM),
        kmh: f.kmh,
        startM: Math.max(0, f.atM - share * length),
        endM: Math.min(cumulativeM[cumulativeM.length - 1] ?? f.atM, f.atM + (1 - share) * length),
      });
    }
  }
  return zones;
}

/** Distances, stops placed along the line, and corners: computed once per roadbook. */
export function prepareRoadbook(roadbook: Roadbook): PreparedRoadbook {
  const { line } = roadbook;
  const cumulativeM = cumulativeDistances(line);
  const totalM = cumulativeM[cumulativeM.length - 1] ?? 0;
  const loop = haversineM(line[0]!, line[line.length - 1]!) <= LOOP_CLOSE_M;

  // Stops come in riding order: each is searched forward from the previous one.
  let from = 0;
  const stops: PreparedStop[] = roadbook.stops.map((s) => {
    const snap = snapToLine(line, cumulativeM, [s.lat, s.lon], from);
    from = snap.progressM;
    return { ...s, atM: snap.progressM };
  });

  const corners = detectCorners(line, cumulativeM);
  const limitSegments = limitSegmentsOf(roadbook, cumulativeM);
  const countrySegments = countrySegmentsOf(roadbook, cumulativeM);
  return {
    roadbook,
    cumulativeM,
    totalM,
    loop,
    stops,
    corners,
    maneuvers: maneuversOf(corners),
    approachM: 0,
    approachDirect: false,
    approachTarget: "start",
    joinM: 0,
    limitSegments,
    countrySegments,
    zones: zonesOf(roadbook, cumulativeM, countrySegments, limitSegments),
    junctions: junctionsOf(roadbook, cumulativeM),
  };
}
