import { boundsOf } from "./format.ts";
import type { LatLon } from "./types.ts";

/** The map is saved this much wider than the roadbook, on each side. */
export const PACK_MARGIN_M = 3000;
export const PACK_MIN_ZOOM = 8;
/** The highest level the vector tiles have. */
export const PACK_MAX_ZOOM = 14;
export const PACK_MAX_TILES = 4000;
/** Under this zoom, an area that does not fit is too long to be saved at all. */
export const PACK_FLOOR_ZOOM = 10;

/** West, south, east, north. */
export type Bounds = [number, number, number, number];

export interface PackPlan {
  bounds: Bounds;
  minZoom: number;
  maxZoom: number;
  tiles: number;
}

const tileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/** The tiles of a level that cover the bounds. */
export function tilesAt(bounds: Bounds, z: number): number {
  const [w, s, e, n] = bounds;
  return (tileX(e, z) - tileX(w, z) + 1) * (tileY(s, z) - tileY(n, z) + 1);
}

/** The tiles of the levels from `min` to `max`. */
export function tilesIn(bounds: Bounds, min: number, max: number): number {
  let sum = 0;
  for (let z = min; z <= max; z++) sum += tilesAt(bounds, z);
  return sum;
}

/** The bounds of the line, wider by `marginM` on every side. */
export function paddedBounds(line: LatLon[], marginM: number): Bounds {
  const [w, s, e, n] = boundsOf(line);
  const dLat = marginM / 111_320;
  const mid = (s + n) / 2;
  const dLon = marginM / (111_320 * Math.max(0.2, Math.cos((mid * Math.PI) / 180)));
  return [w - dLon, Math.max(-85, s - dLat), e + dLon, Math.min(85, n + dLat)];
}

/** What to save for a roadbook, or null when even the floor level does not fit (spec offline-basemap). */
export function planPack(line: LatLon[]): PackPlan | null {
  const bounds = paddedBounds(line, PACK_MARGIN_M);
  for (let max = PACK_MAX_ZOOM; max >= PACK_FLOOR_ZOOM; max--) {
    const tiles = tilesIn(bounds, PACK_MIN_ZOOM, max);
    if (tiles <= PACK_MAX_TILES) return { bounds, minZoom: PACK_MIN_ZOOM, maxZoom: max, tiles };
  }
  return null;
}

/** What a saved map is known by: the roadbook and the basemap it was saved for. */
export const packKey = (roadbookId: string, basemap: string) => `${roadbookId}:${basemap}`;
