import type { ServerSetting } from "../core/liveShare.ts";
import { parseServerList, stampOfEtag, type ServerRoadbook } from "../core/serverRoadbooks.ts";

/** Why the server could not give what was asked: the rider is told in words, nothing is thrown. */
export type ServerProblem = "unauthorized" | "unsupported" | "missing" | "busy" | "unreachable" | "failed";

export type ListAnswer = { ok: true; items: ServerRoadbook[] } | { ok: false; reason: ServerProblem };
export type FileAnswer = { ok: true; text: string; stamp: string | null } | { ok: false; reason: ServerProblem };

export interface ServerRoadbookOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const problemOf = (status: number): ServerProblem =>
  status === 401 || status === 403 ? "unauthorized" : status === 404 ? "missing" : status === 429 ? "busy" : "failed";

/** The roadbooks the rider's server holds (agentRide `GET /roadbooks`, with the rider's token). */
export async function listServerRoadbooks(
  server: ServerSetting,
  { fetchImpl = fetch, timeoutMs = 15_000 }: ServerRoadbookOptions = {},
): Promise<ListAnswer> {
  try {
    const res = await fetchImpl(`${server.url}/roadbooks`, {
      headers: { Authorization: `Bearer ${server.token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const reason = problemOf(res.status);
      // A server that has no such route is an older one: not a missing roadbook.
      return { ok: false, reason: reason === "missing" ? "unsupported" : reason };
    }
    return { ok: true, items: parseServerList(await res.json()) };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof TypeError || (e as Error)?.name === "TimeoutError" ? "unreachable" : "failed",
    };
  }
}

/** One roadbook file; the first request of a version traces the route on the server, so the wait is long. */
export async function fetchServerRoadbook(
  server: ServerSetting,
  id: number,
  { fetchImpl = fetch, timeoutMs = 60_000 }: ServerRoadbookOptions = {},
): Promise<FileAnswer> {
  try {
    const res = await fetchImpl(`${server.url}/roadbook/${id}`, {
      headers: { Authorization: `Bearer ${server.token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, reason: problemOf(res.status) };
    return { ok: true, text: await res.text(), stamp: stampOfEtag(res.headers?.get?.("ETag")) };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof TypeError || (e as Error)?.name === "TimeoutError" ? "unreachable" : "failed",
    };
  }
}
