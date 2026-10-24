import { haversineM } from "./geo.ts";
import { decodePolyline } from "./polyline.ts";
import { cumulativeDistances } from "./track.ts";
import type { LatLon, Roadbook } from "./types.ts";
import { camerasOf, countriesOf, junctionsOf, limitsOf } from "./roadbookFile.ts";

/**
 * What a GPX lacks, found out from public services once, at import (spec roadbook-library): the speed limit of each
 * stretch, its country, the roundabouts and the fixed cameras. The rules are those of agentRide's roadbook file, so a
 * completed GPX and an agentRide roadbook read the same.
 */

export interface TraceEdge {
  length: number;
  speed_limit?: number;
  road_class?: string;
  density?: number;
  names?: string[];
  begin_shape_index?: number;
  end_shape_index?: number;
  roundabout?: boolean;
  drive_on_right?: boolean;
  begin_heading?: number;
  end_heading?: number;
  end_node?: {
    admin_index?: number;
    intersecting_edges?: Array<{ begin_heading?: number; driveability?: "forward" | "backward" | "both" }>;
  };
}

export interface TraceResponse {
  shape?: string;
  admins?: Array<{ country_code?: string; state_code?: string }>;
  edges: TraceEdge[];
}

// Legal default limit (km/h) outside built-up areas, by country or "country-region" (same table as agentRide).
const RURAL_DEFAULT_KMH: Record<string, number> = {
  "BE-WAL": 90,
  "BE-VLG": 70,
  "BE-BRU": 70,
  FR: 80,
  LU: 90,
  NL: 80,
  DE: 100,
  CH: 80,
  AT: 100,
  IT: 90,
  ES: 90,
  PT: 90,
  GB: 97,
  IE: 80,
  DK: 80,
  SE: 70,
  NO: 80,
  FI: 80,
  PL: 90,
  CZ: 90,
  SK: 90,
  SI: 90,
  HR: 90,
  HU: 90,
};
const UNKNOWN_COUNTRY_DEFAULT_KMH = 80;
// The legal default also applies to farm lanes and estate roads, but nobody rides them at 90.
const MINOR_ROAD_CAP_KMH: Record<string, number> = { unclassified: 60, residential: 40, service_other: 30 };
const MAJOR_CLASSES = new Set(["motorway", "trunk", "primary", "secondary", "tertiary"]);
// Valhalla density runs 0 (empty country) to 15 (city core); roads posted above 50 sit at 2-5, town streets at 6 and more.
const BUILT_UP_DENSITY = 6;

type Admin = { country_code?: string; state_code?: string };

function ruralDefaultKmh(roadClass: string, admin: Admin | undefined): number {
  const country = admin?.country_code ?? "";
  const legal =
    RURAL_DEFAULT_KMH[`${country}-${admin?.state_code ?? ""}`] ??
    RURAL_DEFAULT_KMH[country] ??
    UNKNOWN_COUNTRY_DEFAULT_KMH;
  if (MAJOR_CLASSES.has(roadClass)) return legal;
  return Math.min(legal, MINOR_ROAD_CAP_KMH[roadClass] ?? 30);
}

/** The limit on a road edge: the posted one, else the legal default of the country (capped by road class), or 50 at most in a built-up area. */
export function effectiveLimit(edge: TraceEdge, admins: Admin[] | undefined): { kmh: number; posted: boolean } {
  const posted = edge.speed_limit && edge.speed_limit > 0 ? edge.speed_limit : undefined;
  const builtUp = (edge.density ?? 0) >= BUILT_UP_DENSITY;
  const rural = ruralDefaultKmh(edge.road_class ?? "unclassified", admins?.[edge.end_node?.admin_index ?? -1]);
  return { kmh: posted ?? (builtUp ? Math.min(50, rural) : rural), posted: posted !== undefined };
}

/** The road ref ("D 518") before the street name when both are tagged. */
const roadLabel = (names: string[] | undefined) => names?.find((n) => /^[A-Z]{1,2} ?\d/.test(n)) ?? names?.[0];

/** Points of the line to send for matching, about one every `spacingM`, in the line's order, with the ends. */
export function thinIndexes(cumulativeM: number[], spacingM: number): number[] {
  const kept: number[] = [];
  let next = 0;
  cumulativeM.forEach((m, i) => {
    if (m >= next) {
      kept.push(i);
      next = m + spacingM;
    }
  });
  const last = cumulativeM.length - 1;
  if (kept.at(-1) !== last) kept.push(last);
  return kept;
}

/** A piece of the line, by index range, with what the service said of it. */
export interface TracedChunk {
  from: number;
  to: number;
  trace: TraceResponse;
}

const WINDOW_M = 400;
/** Two stretches of one road and one limit, or of one country, a few points apart, are one. */
const GAP_POINTS = 5;

/** Index of the first point whose distance along the line is at least `m`. */
function lowerBound(cum: number[], m: number): number {
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! < m) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * The traced roads laid back on the imported line. The service matches a thinned copy of the line and answers with its
 * own shape, so each point of that shape is put on the nearest point of the line within 400 m of where its share of
 * the distance says it should be, never going back.
 */
function mapperOf(line: LatLon[], cum: number[], chunk: TracedChunk) {
  const shape = chunk.trace.shape ? decodePolyline(chunk.trace.shape) : [];
  const shapeCum = cumulativeDistances(shape);
  const shapeTotal = shapeCum[shapeCum.length - 1] || 1;
  const startM = cum[chunk.from]!;
  const chunkM = cum[chunk.to]! - startM;
  let previous = chunk.from;
  return (shapeIndex: number): number => {
    const p = shape[shapeIndex];
    if (!p) return previous;
    const expected = startM + (shapeCum[shapeIndex]! / shapeTotal) * chunkM;
    let best = previous;
    let bestM = Infinity;
    for (
      let i = Math.max(previous, lowerBound(cum, expected - WINDOW_M));
      i <= chunk.to && cum[i]! <= expected + WINDOW_M;
      i++
    ) {
      const d = haversineM(line[i]!, p);
      if (d < bestM) {
        bestM = d;
        best = i;
      }
    }
    previous = best;
    return best;
  };
}

const relative = (heading: number, from: number) => {
  const d = (((heading - from) % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
};
const SAME_EXIT_DEG = 8;

/**
 * The roundabouts of one traced chunk, in the roadbook file's form (spec junction-guidance): a run of ring edges is entered
 * from the edge before it and left by the edge after it; the exits are the roads that can be driven out of the ring
 * at the nodes it passes, plus the road taken. A ring the chunk starts or ends in, or with fewer than two exits, gives
 * nothing.
 */
function roundaboutsOf(edges: TraceEdge[], map: (shapeIndex: number) => number) {
  const found: Array<Record<string, unknown>> = [];
  for (let i = 1; i < edges.length; i++) {
    const entry = edges[i - 1]!;
    if (!edges[i]!.roundabout || entry.roundabout) continue;
    let j = i;
    while (edges[j + 1]?.roundabout) j++;
    const out = edges[j + 1];
    const from = edges[i]!;
    const last = edges[j]!;
    const heading = entry.end_heading;
    if (
      !out ||
      heading === undefined ||
      out.begin_heading === undefined ||
      from.begin_shape_index === undefined ||
      last.end_shape_index === undefined
    )
      continue;
    const taken = relative(out.begin_heading, heading);
    const exits = [taken];
    for (const node of [entry, ...edges.slice(i, j + 1)].map((e) => e.end_node)) {
      for (const road of node?.intersecting_edges ?? []) {
        if (road.begin_heading === undefined || road.driveability === "backward") continue;
        const deg = relative(road.begin_heading, heading);
        if (exits.every((e) => Math.abs(relative(e, deg)) > SAME_EXIT_DEG)) exits.push(deg);
      }
    }
    if (exits.length < 2 || exits.length > 8) continue;
    exits.sort((a, b) => a - b);
    const at = map(from.begin_shape_index);
    const to = map(last.end_shape_index);
    if (to <= at) continue;
    found.push({
      kind: "roundabout",
      at,
      to,
      exits,
      take: exits.indexOf(taken),
      ...(from.drive_on_right === false ? { traffic: "left" } : {}),
    });
    i = j + 1;
  }
  return found;
}

export interface Found {
  limits: unknown[];
  countries: unknown[];
  junctions: unknown[];
}

/** Limits, countries and roundabouts from the traced chunks, as the lists of a roadbook file. */
export function foundFromTraces(line: LatLon[], chunks: TracedChunk[]): Found {
  const cum = cumulativeDistances(line);
  const limits: Array<{ from: number; to: number; kmh: number; posted: boolean; road?: string }> = [];
  const countries: Array<{ from: number; to: number; code: string }> = [];
  const junctions: Array<Record<string, unknown>> = [];
  let covered = 0;
  for (const chunk of chunks) {
    const map = mapperOf(line, cum, chunk);
    const { edges, admins } = chunk.trace;
    for (const edge of edges) {
      if (edge.begin_shape_index === undefined || edge.end_shape_index === undefined) continue;
      const a = Math.max(map(edge.begin_shape_index), covered);
      const b = map(edge.end_shape_index);
      if (b <= a) continue;
      covered = b;
      const { kmh, posted } = effectiveLimit(edge, admins);
      const road = roadLabel(edge.names);
      const previous = limits.at(-1);
      // Edges of one road under one limit are one stretch.
      if (
        previous &&
        a - previous.to <= GAP_POINTS &&
        previous.kmh === kmh &&
        previous.posted === posted &&
        previous.road === road
      )
        previous.to = b;
      else limits.push({ from: a, to: b, kmh, posted, ...(road ? { road } : {}) });
      const code = admins?.[edge.end_node?.admin_index ?? -1]?.country_code?.toUpperCase();
      if (code && /^[A-Z]{2}$/.test(code)) {
        const lastCountry = countries.at(-1);
        if (lastCountry && lastCountry.code === code && a - lastCountry.to <= GAP_POINTS) lastCountry.to = b;
        else countries.push({ from: a, to: b, code });
      }
    }
    junctions.push(...roundaboutsOf(edges, mapperOf(line, cum, chunk)));
  }
  return { limits, countries, junctions: junctions.sort((x, y) => (x["at"] as number) - (y["at"] as number)) };
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** The direction a camera faces from OpenStreetMap's `direction`, when it is degrees or a compass point (same as agentRide). */
export function cameraBearing(direction: string | undefined): number | null {
  const d = direction?.trim().toUpperCase();
  if (!d) return null;
  const point = COMPASS.indexOf(d);
  if (point >= 0) return point * 22.5;
  if (/^\d{1,3}(\.\d+)?$/.test(d)) {
    const deg = Number(d);
    return deg >= 0 && deg <= 360 ? deg % 360 : null;
  }
  return null;
}

/** An element of an Overpass answer. */
export interface OverpassElement {
  id?: number;
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** The fixed cameras of Overpass elements, as the cameras of a roadbook file; the same camera seen twice is kept once. */
export function camerasFromElements(elements: OverpassElement[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const e of elements) {
    const at = e.lat !== undefined && e.lon !== undefined ? { lat: e.lat, lon: e.lon } : e.center;
    if (!at) continue;
    const key = `${e.type ?? "n"}/${e.id ?? `${at.lat},${at.lon}`}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tags = e.tags ?? {};
    const kmh = Number.parseInt(tags["maxspeed"] ?? "", 10);
    out.push({
      lat: at.lat,
      lon: at.lon,
      kmh: Number.isFinite(kmh) && kmh > 0 ? kmh : null,
      bearing: cameraBearing(tags["direction"]),
      direction: tags["direction"] === "both" ? "both" : null,
    });
  }
  return out;
}

/** What a roadbook still lacks that the services can give: it has no limits and no countries. */
export const needsCompletion = (rb: Roadbook): boolean => !rb.limits?.length && !rb.countries?.length;

/** The roadbook with what was found put in, read through the same checks as a roadbook file. */
export function completed(rb: Roadbook, found: Found, cameras: unknown[] | null): Roadbook {
  const last = rb.line.length - 1;
  return {
    ...rb,
    limits: limitsOf(found.limits, last),
    countries: countriesOf(found.countries, last),
    junctions: junctionsOf(found.junctions, last),
    ...(cameras ? { cameras: camerasOf(cameras) } : { cameras: rb.cameras ?? [] }),
  };
}
