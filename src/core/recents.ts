import type { Place } from "./destination.ts";

export const MAX_RECENTS = 8;

/** A ride the rider has opened: a place routed to, or a roadbook. */
export type Recent =
  | { kind: "place"; place: Place; at: number }
  | { kind: "roadbook"; id: string; name: string; detail: string; at: number };

const near = (n: number) => n.toFixed(4);

/** What makes two recents the same ride. */
export const recentKey = (r: Recent): string =>
  r.kind === "place" ? `place:${near(r.place.lat)},${near(r.place.lon)}` : `roadbook:${r.id}`;

export const recentTitle = (r: Recent): string => (r.kind === "place" ? r.place.name : r.name);
export const recentDetail = (r: Recent): string => (r.kind === "place" ? r.place.detail : r.detail);

/** The list with `entry` on top: the same ride is moved, not repeated, and only the newest are kept. */
export function addRecent(list: Recent[], entry: Recent): Recent[] {
  const key = recentKey(entry);
  return [entry, ...list.filter((r) => recentKey(r) !== key)].slice(0, MAX_RECENTS);
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const str = (s: unknown): s is string => typeof s === "string";

/** The recents kept as text; anything that is not one is dropped, and bad text gives an empty list. */
export function parseRecents(text: string | null): Recent[] {
  if (!text) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: Recent[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (!finite(r["at"])) continue;
    if (r["kind"] === "roadbook" && str(r["id"]) && str(r["name"])) {
      out.push({
        kind: "roadbook",
        id: r["id"],
        name: r["name"],
        detail: str(r["detail"]) ? r["detail"] : "",
        at: r["at"],
      });
    } else if (r["kind"] === "place" && typeof r["place"] === "object" && r["place"] !== null) {
      const p = r["place"] as Record<string, unknown>;
      if (
        str(p["name"]) &&
        finite(p["lat"]) &&
        finite(p["lon"]) &&
        Math.abs(p["lat"]) <= 90 &&
        Math.abs(p["lon"]) <= 180
      )
        out.push({
          kind: "place",
          place: { name: p["name"], detail: str(p["detail"]) ? p["detail"] : "", lat: p["lat"], lon: p["lon"] },
          at: r["at"],
        });
    }
  }
  return out.slice(0, MAX_RECENTS);
}
