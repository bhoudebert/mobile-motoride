import { formatDistance } from "./format.ts";
import { cumulativeDistances } from "./track.ts";
import type { LatLon, Roadbook } from "./types.ts";
import { t } from "./i18n/index.ts";

/** A place found by a search. */
export interface Place {
  name: string;
  /** Where it is, shorter than the full address. */
  detail: string;
  lat: number;
  lon: number;
}

export const MIN_QUERY = 3;
export const MAX_PLACES = 8;

/** A query worth sending: trimmed, and long enough. */
export const searchable = (query: string): string | null => {
  const q = query.trim().replace(/\s+/g, " ");
  return q.length >= MIN_QUERY ? q : null;
};

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** The places of a Nominatim `jsonv2` answer; entries that are not a place with a position are dropped. */
export function placesOf(json: unknown): Place[] {
  if (!Array.isArray(json)) return [];
  const places: Place[] = [];
  for (const item of json) {
    if (typeof item !== "object" || item === null) continue;
    const { display_name, name, lat, lon } = item as Record<string, unknown>;
    const la = Number(lat);
    const lo = Number(lon);
    if (typeof display_name !== "string" || !finite(la) || !finite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180)
      continue;
    const parts = display_name.split(",").map((p) => p.trim());
    const title = typeof name === "string" && name.trim() ? name.trim() : (parts[0] ?? display_name);
    const rest = parts.filter((p, i) => p && !(i === 0 && p === title)).slice(0, 3);
    places.push({ name: title, detail: rest.join(", "), lat: la, lon: lo });
    if (places.length === MAX_PLACES) break;
  }
  return places;
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The roadbook of a trip to a place: the routed line, the rider's position as its start and the place as its finish. */
export function destinationRoadbook(place: Place, from: LatLon, line: LatLon[]): Roadbook {
  const m = cumulativeDistances(line);
  const km = formatDistance(m[m.length - 1] ?? 0);
  return {
    id: `to-${slug(place.name) || "place"}`,
    name: t("nav.dest.name", { place: place.name }),
    description: place.detail ? t("nav.dest.descTo", { km, detail: place.detail }) : t("nav.dest.desc", { km }),
    stops: [
      { lat: from[0], lon: from[1], name: t("nav.dest.start"), kind: "waypoint" },
      { lat: place.lat, lon: place.lon, name: place.name, kind: "waypoint" },
    ],
    line,
  };
}
