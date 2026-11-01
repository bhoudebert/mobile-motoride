import type { ImportedRoadbook } from "./library.ts";

/**
 * Where a roadbook stands on the server (agentRide `GET /roadbooks`): the ready file is made from it as it is and on the map
 * in use (`current`), is older (`outdated`, it still works), is being remade (`refreshing`) or the last try failed (`failed`).
 */
export type RoadbookState = "current" | "outdated" | "refreshing" | "failed";

/** Why the last try failed, as a stable code the app can translate (`other` and anything new: the server's own `error` text). */
export type ErrorCode = "map_down" | "rate_limited" | "timeout" | "other";
const ERROR_CODES: readonly ErrorCode[] = ["map_down", "rate_limited", "timeout", "other"];

/** A roadbook a server lists (agentRide's `GET /roadbooks`); `id` is its number in that server's library. */
export interface ServerRoadbook {
  id: number;
  name: string;
  distanceKm: number;
  ridingMinutes: number;
  /** The version of the file ready to download now: changes only when a new file is ready. */
  stamp: string;
  /** A server that says nothing of it (an older one) is taken as `current`. */
  state: RoadbookState;
  /**
   * False until the first file exists: there is nothing to download, the server has to prepare it (`POST .../refresh`) and a
   * `GET` would wait for the build. A server that says nothing of it is taken as ready.
   */
  ready: boolean;
  /** The UTC day of the map the ready file was made on, when the server keeps its own. */
  mapDay?: string;
  /** Why the last try failed, when `state` is `failed`: one short English sentence. */
  error?: string;
  /** The same reason as a code. */
  errorCode?: ErrorCode;
}

const STATES: readonly RoadbookState[] = ["current", "outdated", "refreshing", "failed"];

/** The roadbooks of a server's answer; an entry that is not one is left out, never thrown. */
export function parseServerList(body: unknown): ServerRoadbook[] {
  const list = (body as { roadbooks?: unknown } | null)?.roadbooks;
  if (!Array.isArray(list)) return [];
  return list.flatMap((r): ServerRoadbook[] => {
    const o = r as Record<string, unknown> | null;
    if (!o || typeof o !== "object") return [];
    const { id, name, distanceKm, ridingMinutes, stamp, state, ready, mapDay, error, errorCode } = o;
    if (typeof id !== "number" || !Number.isInteger(id) || id < 0) return [];
    if (typeof name !== "string" || !name || typeof stamp !== "string" || !stamp) return [];
    const finite = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0);
    return [
      {
        id,
        name,
        distanceKm: finite(distanceKm),
        ridingMinutes: finite(ridingMinutes),
        stamp,
        state: STATES.includes(state as RoadbookState) ? (state as RoadbookState) : "current",
        ready: ready !== false,
        ...(typeof mapDay === "string" && mapDay ? { mapDay } : {}),
        ...(typeof error === "string" && error ? { error } : {}),
        ...(ERROR_CODES.includes(errorCode as ErrorCode) ? { errorCode: errorCode as ErrorCode } : {}),
      },
    ];
  });
}

/**
 * What the list offers for a server roadbook: fetch it, fetch its new version, nothing, or one of the three states the
 * server reports for a copy that is up to date as a file.
 */
export type ServerAction = "download" | "refresh" | "current" | "outdated" | "refreshing" | "failed";

/**
 * The kept copy of a server roadbook: the one fetched under the same server number, else the one with the same origin
 * (agentRide, same number AND same name, as `placeImport` does) among the copies that were not fetched from a number, else,
 * when the whole `listed` answer is given, a copy of the same name whose server number is no longer listed: the server
 * renumbered the roadbook (a library moved, a roadbook pushed and then taken into the library), so the copy is that
 * roadbook under its new number and the next download replaces it in place, else a roadbook of the phone only (no server
 * number: kept from a server that is gone, or from a file) of the same name (spec roadbook-library).
 */
export function keptFor(
  entry: ServerRoadbook,
  kept: readonly ImportedRoadbook[],
  listed?: readonly ServerRoadbook[],
): ImportedRoadbook | undefined {
  const byNumber = kept.find((k) => k.serverId === entry.id);
  if (byNumber) return byNumber;
  const byOrigin = kept.find((k) => {
    const o = k.roadbook.origin;
    return k.serverId === undefined && o?.app === "agentRide" && o.roadbook === entry.id && o.name === entry.name;
  });
  if (byOrigin) return byOrigin;
  if (listed) {
    const ids = new Set(listed.map((e) => e.id));
    const renumbered = kept.find(
      (k) =>
        k.serverId !== undefined &&
        !ids.has(k.serverId) &&
        k.roadbook.origin?.app === "agentRide" &&
        k.roadbook.origin.name === entry.name,
    );
    if (renumbered) return renumbered;
  }
  // A roadbook of the phone only (kept from a server that is gone, or from a file) with the very name of this one: it is
  // that roadbook, whatever number or origin it carries. Only the first server roadbook of a name claims it.
  if (listed && listed.find((e) => sameName(e.name, entry.name)) !== entry) return undefined;
  return kept.find((k) => k.serverId === undefined && sameName(k.roadbook.name, entry.name));
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Compares stamps, never `generatedAt`, which changes on every download. A roadbook being remade offers nothing until it
 * is ready; otherwise a stamp that is not the one held means a new file is ready to download (the old one still works,
 * so an outdated roadbook is downloaded too); with the file held, the state says what to show: a check, "outdated map" to
 * ask for a new file, or the failure with a tap to try again. After a download the held stamp is the listed one, so the
 * update is not offered again on the next opening.
 */
export function serverAction(
  entry: ServerRoadbook,
  kept: readonly ImportedRoadbook[],
  listed?: readonly ServerRoadbook[],
): ServerAction {
  const same = keptFor(entry, kept, listed);
  if (!same) return "download";
  if (entry.state === "refreshing") return "refreshing";
  if (same.serverStamp !== entry.stamp) return "refresh";
  return entry.state === "outdated" ? "outdated" : entry.state === "failed" ? "failed" : "current";
}

/** The stamp of an `ETag` header: without quotes or the weak mark; null when there is none. */
export function stampOfEtag(etag: string | null | undefined): string | null {
  const s = (etag ?? "").trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  return s || null;
}

/**
 * The kept roadbooks that are only on the phone and that a server in use does not list: what "Send to your server" offers.
 * Nothing is offered while the server's list is not known.
 */
export function onlyOnPhone(
  kept: readonly ImportedRoadbook[],
  listed: readonly ServerRoadbook[] | null,
): ImportedRoadbook[] {
  if (!listed) return [];
  return kept.filter((k) => k.serverId === undefined && listed.every((e) => keptFor(e, kept, listed) !== k));
}
