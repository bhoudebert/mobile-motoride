import type { ImportedRoadbook } from "./library.ts";

/** A roadbook a server lists (agentRide's `GET /roadbooks`); `id` is its number in that server's library. */
export interface ServerRoadbook {
  id: number;
  name: string;
  distanceKm: number;
  ridingMinutes: number;
  /** Changes when the route, the stops, the cameras or the name change. */
  stamp: string;
}

/** The roadbooks of a server's answer; an entry that is not one is left out, never thrown. */
export function parseServerList(body: unknown): ServerRoadbook[] {
  const list = (body as { roadbooks?: unknown } | null)?.roadbooks;
  if (!Array.isArray(list)) return [];
  return list.flatMap((r): ServerRoadbook[] => {
    const o = r as Record<string, unknown> | null;
    if (!o || typeof o !== "object") return [];
    const { id, name, distanceKm, ridingMinutes, stamp } = o;
    if (typeof id !== "number" || !Number.isInteger(id) || id < 0) return [];
    if (typeof name !== "string" || !name || typeof stamp !== "string" || !stamp) return [];
    const finite = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0);
    return [{ id, name, distanceKm: finite(distanceKm), ridingMinutes: finite(ridingMinutes), stamp }];
  });
}

/** What the list offers for a server roadbook: fetch it, fetch its new version, or nothing. */
export type ServerAction = "download" | "refresh" | "current";

/**
 * The kept copy of a server roadbook: the one fetched under the same server number, else the one with the same origin
 * (agentRide, same number AND same name, as `placeImport` does). A roadbook pushed from a library lists under a number
 * that is not its origin's, so the kept copy remembers the number it was fetched under.
 */
export function keptFor(entry: ServerRoadbook, kept: readonly ImportedRoadbook[]): ImportedRoadbook | undefined {
  return (
    kept.find((k) => k.serverId === entry.id) ??
    kept.find((k) => {
      const o = k.roadbook.origin;
      return k.serverId === undefined && o?.app === "agentRide" && o.roadbook === entry.id && o.name === entry.name;
    })
  );
}

/** Compares stamps, never `generatedAt`, which changes on every download. */
export function serverAction(entry: ServerRoadbook, kept: readonly ImportedRoadbook[]): ServerAction {
  const same = keptFor(entry, kept);
  if (!same) return "download";
  return same.serverStamp === entry.stamp ? "current" : "refresh";
}

/** The stamp of an `ETag` header: without quotes or the weak mark; null when there is none. */
export function stampOfEtag(etag: string | null | undefined): string | null {
  const s = (etag ?? "").trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  return s || null;
}
