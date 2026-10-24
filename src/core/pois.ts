import type { FeatureCollection, Point } from "geojson";
import type { OverpassElement } from "./enrich.ts";
import { snapToLine } from "./track.ts";
import type { LatLon } from "./types.ts";

// ---- Places along a route (spec fuel-stops, ADR 0035)

/** What is looked for along a route; the filter is the Overpass way of saying it. */
export const POI_FILTERS = {
  fuel: '["amenity"="fuel"]',
  bakery: '["shop"="bakery"]',
  cafe: '["amenity"="cafe"]',
  restaurant: '["amenity"~"^(restaurant|fast_food)$"]',
  viewpoint: '["tourism"="viewpoint"]',
  toilets: '["amenity"="toilets"]',
  atm: '["amenity"="atm"]',
  motorcycle: '["shop"~"^(motorcycle|motorcycle_repair)$"]',
} as const;
export type PoiKind = keyof typeof POI_FILTERS;

export interface Poi {
  /** "node/123", unique across kinds. */
  id: string;
  kind: PoiKind;
  lat: number;
  lon: number;
  name: string | null;
  /** The brand when there is one ("TotalEnergies"), shown when the place has no name. */
  brand: string | null;
}

/** The places of Overpass elements; the same one seen twice (a way and its node) is kept once. */
export function poisFromElements(kind: PoiKind, elements: OverpassElement[]): Poi[] {
  const seen = new Set<string>();
  const out: Poi[] = [];
  for (const e of elements) {
    const at = e.lat !== undefined && e.lon !== undefined ? { lat: e.lat, lon: e.lon } : e.center;
    if (!at || !Number.isFinite(at.lat) || !Number.isFinite(at.lon)) continue;
    const id = `${e.type ?? "node"}/${e.id ?? `${at.lat},${at.lon}`}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const tags = e.tags ?? {};
    out.push({
      id,
      kind,
      lat: at.lat,
      lon: at.lon,
      name: tags["name"]?.trim() || null,
      brand: tags["brand"]?.trim() || tags["operator"]?.trim() || null,
    });
  }
  return out;
}

/** The kinds of place the rider can look for along the route, besides fuel which has its own card. */
export const PLACE_KINDS = ["bakery", "cafe", "restaurant", "viewpoint", "toilets", "atm", "motorcycle"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];
export const isPlaceKind = (v: unknown): v is PlaceKind => (PLACE_KINDS as readonly unknown[]).includes(v);

/** A place further than this from the route is not on the way, for a stop that is not fuel. */
export const PLACE_MAX_OFF_M = 1000;
/** How far ahead of the rider a search looks, m; and how much behind it still counts (a place just passed). */
export const PLACE_AHEAD_M = 60_000;

/** What a place is called: its name, else its brand, else nothing (the screen then says what kind of place it is). */
export const poiName = (p: Poi): string | null => p.name ?? p.brand;

/** A place near the route: where along it the nearest point is, and how far off the route the place lies. */
export interface RoutePoi {
  poi: Poi;
  atM: number;
  offM: number;
}

/** A fuel station further than this from the route is not on the way. */
export const FUEL_MAX_OFF_M = 1500;

/** The places within `maxOffM` of the route, in the order of the route. */
export function alongRoute(line: LatLon[], cumulativeM: number[], pois: Poi[], maxOffM: number): RoutePoi[] {
  const out: RoutePoi[] = [];
  for (const poi of pois) {
    const snap = snapToLine(line, cumulativeM, [poi.lat, poi.lon]);
    if (snap.offsetM <= maxOffM) out.push({ poi, atM: snap.progressM, offM: snap.offsetM });
  }
  return out.sort((a, b) => a.atM - b.atM);
}

/** The places as points for the map. */
export function poisCollection(stops: RoutePoi[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: stops.map((s) => ({
      type: "Feature",
      properties: { id: s.poi.id, kind: s.poi.kind, name: poiName(s.poi) ?? "" },
      geometry: { type: "Point", coordinates: [s.poi.lon, s.poi.lat] },
    })),
  };
}

// ---- Fuel

/** The tank range the rider sets, km. */
export const FUEL_RANGES_KM = [100, 150, 200, 250, 300, 350, 400] as const;
export const DEFAULT_FUEL_RANGE_KM = 200;
export const isFuelRange = (v: unknown): v is number => (FUEL_RANGES_KM as readonly unknown[]).includes(v);

/** The next range in the list, going round. */
export const nextFuelRange = (km: number): number =>
  FUEL_RANGES_KM[(FUEL_RANGES_KM.indexOf(km as (typeof FUEL_RANGES_KM)[number]) + 1) % FUEL_RANGES_KM.length]!;

/** A stretch longer than this share of the range is a warning: nobody should ride a tank to its last drop. */
export const TIGHT_SHARE = 0.8;
/** A station is announced this far ahead, if what follows it is a long stretch. */
export const ANNOUNCE_AHEAD_M = 3000;
const LONG_SHARE = 0.6;
/** A station just passed is still reachable by a short turn back, for this long. */
const JUST_PASSED_M = 100;

export interface NextFuel {
  stop: RoutePoi;
  distM: number;
}

/** The next station on the way: the first not yet passed. */
export function nextFuel(stops: RoutePoi[], progressM: number): NextFuel | null {
  const stop = stops.find((s) => s.atM >= progressM - JUST_PASSED_M);
  return stop ? { stop, distM: Math.max(0, stop.atM - progressM) } : null;
}

/** The stations after the next one, up to `count`, for the list. */
export function upcomingFuel(stops: RoutePoi[], progressM: number, count: number): NextFuel[] {
  return stops
    .filter((s) => s.atM >= progressM - JUST_PASSED_M)
    .slice(0, count)
    .map((stop) => ({ stop, distM: Math.max(0, stop.atM - progressM) }));
}

export interface FuelSummary {
  count: number;
  /** The longest stretch of the rest of the route without a station, m. */
  longestGapM: number;
  /** That stretch is longer than the share of the range one should ride. */
  tight: boolean;
}

/** The stretches without fuel from `fromM` to the finish. */
export function fuelSummary(stops: RoutePoi[], totalM: number, rangeKm: number, fromM = 0): FuelSummary {
  const ahead = stops.filter((s) => s.atM >= fromM);
  let longest = 0;
  let last = fromM;
  for (const s of ahead) {
    longest = Math.max(longest, s.atM - last);
    last = s.atM;
  }
  longest = Math.max(longest, totalM - last);
  return { count: ahead.length, longestGapM: longest, tight: longest > rangeKm * 1000 * TIGHT_SHARE };
}

export interface FuelAnnouncement {
  id: string;
  /** "last": no station after this one; "next": another one follows. */
  kind: "last" | "next";
  distM: number;
  /** The stretch after this station: to the next one, or to the finish. */
  gapM: number;
}

/**
 * What to say about the next station, once: when it is within 3 km and the stretch after it is long (more than 60 % of the
 * range). A station followed by another soon, or by the finish soon, is not worth a word.
 */
export function fuelAnnouncement(
  stops: RoutePoi[],
  progressM: number,
  totalM: number,
  rangeKm: number,
  announced: ReadonlySet<string>,
): FuelAnnouncement | null {
  const next = nextFuel(stops, progressM);
  if (!next || next.distM > ANNOUNCE_AHEAD_M || announced.has(next.stop.poi.id)) return null;
  const after = stops[stops.indexOf(next.stop) + 1];
  const gapM = (after ? after.atM : totalM) - next.stop.atM;
  if (gapM <= rangeKm * 1000 * LONG_SHARE) return null;
  return { id: next.stop.poi.id, kind: after ? "next" : "last", distM: next.distM, gapM };
}

// ---- Looking along the part of the route ahead

/** The part of a line between two distances, with its own distances, for a search that asks only about what lies ahead. */
export function lineWindow(
  line: LatLon[],
  cumulativeM: number[],
  fromM: number,
  toM: number,
): { line: LatLon[]; cumulativeM: number[] } {
  const keep: number[] = [];
  cumulativeM.forEach((m, i) => {
    if (m >= fromM && m <= toM) keep.push(i);
  });
  // A window that falls between two points of the line still has two to ask about.
  if (keep.length < 2) {
    const i = Math.max(0, Math.min(line.length - 2, cumulativeM.findIndex((m) => m >= fromM) - 1));
    keep.splice(0, keep.length, i, i + 1);
  }
  const sub = keep.map((i) => line[i]!);
  const cum: number[] = [0];
  for (let k = 1; k < keep.length; k++) cum.push(cum[k - 1]! + (cumulativeM[keep[k]!]! - cumulativeM[keep[k - 1]!]!));
  return { line: sub, cumulativeM: cum };
}

/** The places ahead (or just passed), nearest along the route first, as many as `count`. */
export function placesAhead(places: RoutePoi[], progressM: number, count: number): NextFuel[] {
  return upcomingFuel(places, progressM, count);
}
