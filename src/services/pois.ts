import { thinIndexes } from "../core/enrich.ts";
import {
  poisFromElements,
  POI_FILTERS,
  FUEL_MAX_OFF_M,
  PLACE_MAX_OFF_M,
  type Poi,
  type PoiKind,
} from "../core/pois.ts";
import type { OverpassElement } from "../core/enrich.ts";
import type { LatLon } from "../core/types.ts";
import { overpass } from "./overpass.ts";

/** Overpass measures to the line between the points it is given: one point every kilometre is enough for a 1.5 km radius. */
const SPACING_M = 1000;
/** Points per query: about 40 km of route. */
const PIECE = 40;

export interface PoiOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Waits between attempts on another server; the tests do not wait. */
  pause?: (ms: number) => Promise<void>;
  /** How far from the route a place still counts, m. */
  radiusM?: number;
  onProgress?: (share: number) => void;
  /** A search the rider waits for: 10 s a server, two servers, the pieces asked together. */
  quick?: boolean;
}

/**
 * The places of a kind along a route (spec fuel-stops, ADR 0035), or null when a stretch could not be asked: a list with a hole
 * in it would say "no fuel for 90 km" when there is a station, so it is all or nothing.
 */
export async function fetchPois(
  kind: PoiKind,
  line: LatLon[],
  cumulativeM: number[],
  options: PoiOptions = {},
): Promise<Poi[] | null> {
  const {
    fetchImpl = fetch,
    quick = false,
    timeoutMs = quick ? 10_000 : 25_000,
    pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    radiusM = kind === "fuel" ? FUEL_MAX_OFF_M : PLACE_MAX_OFF_M,
    onProgress,
  } = options;
  const sparse = thinIndexes(cumulativeM, SPACING_M);
  const pieces: LatLon[][] = [];
  for (let start = 0; start < sparse.length - 1 || start === 0; start += PIECE - 1) {
    pieces.push(sparse.slice(start, start + PIECE).map((i) => line[i]!));
    if (sparse.length <= 1) break;
  }
  const serverTimeout = quick ? 10 : 30;
  const ask = (piece: LatLon[]) => {
    const coords = piece.map(([lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join(",");
    const query = `[out:json][timeout:${serverTimeout}];(nwr${POI_FILTERS[kind]}(around:${radiusM},${coords}););out center tags;`;
    return overpass(fetchImpl, query, timeoutMs, pause, quick ? 2 : undefined);
  };
  const elements: OverpassElement[] = [];
  if (quick) {
    // Together: the rider is waiting, and the pieces do not depend on one another.
    const answers = await Promise.all(pieces.map(ask));
    if (answers.some((a) => a === null)) return null;
    for (const a of answers) elements.push(...a!);
    onProgress?.(1);
  } else {
    for (let i = 0; i < pieces.length; i++) {
      const found = await ask(pieces[i]!);
      if (!found) return null;
      elements.push(...found);
      onProgress?.(Math.min(1, ((i + 1) * (PIECE - 1)) / Math.max(1, sparse.length - 1)));
    }
  }
  return poisFromElements(kind, elements);
}
