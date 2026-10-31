import type { ServerSetting } from "../core/liveShare.ts";
import { parseServerRides, type ServerRide } from "../core/serverRides.ts";
import type { ServerProblem } from "./serverRoadbooks.ts";

export type RidesAnswer = { ok: true; rides: ServerRide[] } | { ok: false; reason: ServerProblem };
export type RideFileAnswer = { ok: true; gpx: string } | { ok: false; reason: ServerProblem };
export type RemoveAnswer = { ok: true } | { ok: false; reason: ServerProblem };

export interface ServerRidesOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const problemOf = (status: number): ServerProblem =>
  status === 401 || status === 403
    ? "unauthorized"
    : status === 404
      ? "missing"
      : status === 405
        ? "unsupported"
        : status === 429
          ? "busy"
          : "failed";

const failure = (e: unknown): ServerProblem =>
  (e as Error)?.name === "TimeoutError" ? "slow" : e instanceof TypeError ? "unreachable" : "failed";

/** The rides the rider's server keeps (agentRide `GET /rides`, with the rider's token). */
export async function listServerRides(
  server: ServerSetting,
  { fetchImpl = fetch, timeoutMs = 15_000 }: ServerRidesOptions = {},
): Promise<RidesAnswer> {
  try {
    const res = await fetchImpl(`${server.url}/rides`, {
      headers: { Authorization: `Bearer ${server.token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const reason = problemOf(res.status);
      // A server with no such route is an older one: not a missing ride.
      return { ok: false, reason: reason === "missing" ? "unsupported" : reason };
    }
    return { ok: true, rides: parseServerRides(await res.json()) };
  } catch (e) {
    return { ok: false, reason: failure(e) };
  }
}

/** The GPX of one ride, as it was uploaded (`GET /rides/<id>`): a few megabytes for a long ride. */
export async function fetchServerRide(
  server: ServerSetting,
  id: string,
  { fetchImpl = fetch, timeoutMs = 120_000 }: ServerRidesOptions = {},
): Promise<RideFileAnswer> {
  try {
    const res = await fetchImpl(`${server.url}/rides/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${server.token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, reason: problemOf(res.status) };
    return { ok: true, gpx: await res.text() };
  } catch (e) {
    return { ok: false, reason: failure(e) };
  }
}

/** Remove a ride from the server only (`DELETE /rides/<id>`): what is on the phone is never touched. */
export async function removeServerRide(
  server: ServerSetting,
  id: string,
  { fetchImpl = fetch, timeoutMs = 15_000 }: ServerRidesOptions = {},
): Promise<RemoveAnswer> {
  try {
    const res = await fetchImpl(`${server.url}/rides/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${server.token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // 404: already gone, which is what was asked for.
    if (res.ok || res.status === 404) return { ok: true };
    return { ok: false, reason: problemOf(res.status) };
  } catch (e) {
    return { ok: false, reason: failure(e) };
  }
}
