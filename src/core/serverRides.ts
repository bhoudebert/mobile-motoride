import { STATES_OF_RIDE, type RideMeta, type RideState } from "./recording.ts";

/** A ride the rider's server keeps (agentRide `GET /rides`), as the list shows it. */
export interface ServerRide {
  /** The ride's id: start time and roadbook slug, set by the phone that recorded it. */
  id: string;
  /** The roadbook's name. */
  name: string;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  points: number;
  uploadedAt: number;
  /** The size of the GPX, when the server says it. */
  bytes?: number;
  state?: RideState;
  climbM?: number;
  peakLeftDeg?: number;
  peakRightDeg?: number;
}

const time = (v: unknown): number | null => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The rides of a server's answer; an entry that is not one is left out, never thrown. */
export function parseServerRides(body: unknown): ServerRide[] {
  const list = (body as { rides?: unknown } | null)?.rides;
  if (!Array.isArray(list)) return [];
  return list.flatMap((r): ServerRide[] => {
    const o = r as Record<string, unknown> | null;
    if (!o || typeof o !== "object") return [];
    const startedAt = time(o["startedAt"]);
    const endedAt = time(o["endedAt"]);
    const uploadedAt = time(o["uploadedAt"]);
    const km = num(o["distanceKm"]);
    if (typeof o["id"] !== "string" || !o["id"] || startedAt === null || endedAt === null || km === null) return [];
    const bytes = num(o["bytes"]);
    const climbM = num(o["climbM"]);
    const left = num(o["peakLeftDeg"]);
    const right = num(o["peakRightDeg"]);
    return [
      {
        id: o["id"],
        name: typeof o["name"] === "string" && o["name"] ? o["name"] : o["id"],
        startedAt,
        endedAt,
        distanceM: Math.max(0, km) * 1000,
        points: num(o["points"]) ?? 0,
        uploadedAt: uploadedAt ?? startedAt,
        ...(bytes !== null ? { bytes } : {}),
        ...(STATES_OF_RIDE.includes(o["state"] as RideState) ? { state: o["state"] as RideState } : {}),
        ...(climbM !== null ? { climbM } : {}),
        ...(left !== null ? { peakLeftDeg: left } : {}),
        ...(right !== null ? { peakRightDeg: right } : {}),
      },
    ];
  });
}

/** Where a ride is: on the phone only, on the server only, or on both (spec ride-recording). */
export type RidePlace = "phone" | "both" | "server";

/** One row of My rides: a ride, once, whatever the places it is in. */
export interface RideRow {
  id: string;
  place: RidePlace;
  /** The ride as the card shows it: the phone's own summary when there is one, else what the server says. */
  ride: Omit<RideMeta, "state"> & { state?: RideState };
  /** The ride on the phone, when it is there. */
  local?: RideMeta;
  /** The ride on the server, when it is there. */
  server?: ServerRide;
}

/**
 * The rides of the phone and of the server as one list, newest first, one row per id (same id, same ride). With the server's
 * list (`server` not null) it is the truth about what the server keeps: a phone ride that says it was uploaded but is not
 * listed is on the phone only again. Without it (no server, offline, an answer that failed) the phone's own mark is used and
 * no ride is added.
 */
export function mergeRides(local: readonly RideMeta[], server: readonly ServerRide[] | null): RideRow[] {
  const onServer = new Map((server ?? []).map((s) => [s.id, s]));
  const rows: RideRow[] = local.map((m) => {
    const s = onServer.get(m.id);
    const place: RidePlace = server ? (s ? "both" : "phone") : m.uploadedAt !== undefined ? "both" : "phone";
    return { id: m.id, place, ride: m, local: m, ...(s ? { server: s } : {}) };
  });
  const here = new Set(local.map((m) => m.id));
  for (const s of server ?? []) {
    if (here.has(s.id)) continue;
    rows.push({
      id: s.id,
      place: "server",
      server: s,
      ride: {
        id: s.id,
        roadbookId: "",
        roadbookName: s.name,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        distanceM: s.distanceM,
        points: s.points,
        ...(s.state ? { state: s.state } : {}),
        ...(s.climbM !== undefined ? { climbM: s.climbM } : {}),
        ...(s.peakLeftDeg !== undefined ? { peakLeftDeg: s.peakLeftDeg } : {}),
        ...(s.peakRightDeg !== undefined ? { peakRightDeg: s.peakRightDeg } : {}),
      },
    });
  }
  return rows.sort((a, b) => b.ride.startedAt - a.ride.startedAt);
}
