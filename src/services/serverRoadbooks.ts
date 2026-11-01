import type { ServerSetting } from "../core/liveShare.ts";
import { parseServerList, stampOfEtag, type ServerRoadbook } from "../core/serverRoadbooks.ts";

/** Why the server could not give what was asked: the rider is told in words, nothing is thrown. */
export type ServerProblem = "unauthorized" | "unsupported" | "missing" | "busy" | "unreachable" | "failed" | "slow";

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

/**
 * How long a download is waited for. A file that is ready comes in well under a second; one the server has not made yet is
 * made on this request (its limits are traced along the whole route), which can take minutes: after this, the phone stops
 * waiting and asks the server to prepare it instead (`slow`).
 */
export const FILE_WAIT_MS = 15_000;

/** One roadbook file. `slow`: the server did not answer in time, said 202 (still making it) or its gateway gave up (504, 408). */
export async function fetchServerRoadbook(
  server: ServerSetting,
  id: number,
  { fetchImpl = fetch, timeoutMs = FILE_WAIT_MS }: ServerRoadbookOptions = {},
): Promise<FileAnswer> {
  try {
    const res = await fetchImpl(`${server.url}/roadbook/${id}`, {
      headers: { Authorization: `Bearer ${server.token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // 202: the server is making the file and says so (`Retry-After`); 504 and 408: a gateway gave up on a build that goes on.
    if (res.status === 202) return { ok: false, reason: "slow" };
    if (!res.ok)
      return { ok: false, reason: res.status === 504 || res.status === 408 ? "slow" : problemOf(res.status) };
    return { ok: true, text: await res.text(), stamp: stampOfEtag(res.headers?.get?.("ETag")) };
  } catch (e) {
    return {
      ok: false,
      reason: (e as Error)?.name === "TimeoutError" ? "slow" : e instanceof TypeError ? "unreachable" : "failed",
    };
  }
}

export type RefreshAnswer = { ok: true; state: "refreshing" | "current" } | { ok: false; reason: ServerProblem };

/**
 * Ask the server for a new file of one roadbook (`POST /roadbook/<id>/refresh`): 202 when it starts or already runs,
 * 200 when the roadbook is already current, 404 when it is not the rider's. The server makes it in the background, one at a
 * time: the phone then polls the list.
 */
export async function refreshServerRoadbook(
  server: ServerSetting,
  id: number,
  { fetchImpl = fetch, timeoutMs = 15_000 }: ServerRoadbookOptions = {},
): Promise<RefreshAnswer> {
  try {
    const res = await fetchImpl(`${server.url}/roadbook/${id}/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${server.token}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 202) return { ok: true, state: "refreshing" };
    if (res.status === 200) return { ok: true, state: "current" };
    return { ok: false, reason: problemOf(res.status) };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof TypeError || (e as Error)?.name === "TimeoutError" ? "unreachable" : "failed",
    };
  }
}

/** What a server answers a pushed roadbook, each refusal told apart (agentRide `PUT /roadbooks`). */
export type PushProblem =
  "unauthorized" | "invalid" | "tooLarge" | "libraryFull" | "full" | "busy" | "unreachable" | "failed";
export type PushAnswer =
  | { ok: true; id: number; replaced: boolean; stamp: string | null }
  | { ok: false; reason: PushProblem; retryAfterS?: number };

/** The most the server takes in one roadbook file. */
export const MAX_PUSH_BYTES = 5 * 1024 * 1024;

/**
 * Send a roadbook file to the rider's server (`PUT /roadbooks`, with the phone's own token): the server numbers it itself
 * and keys it on its origin and name, so sending it again replaces it. The answer is `{id, replaced, stamp}`.
 */
export async function pushRoadbook(
  server: ServerSetting,
  file: string,
  { fetchImpl = fetch, timeoutMs = 60_000 }: ServerRoadbookOptions = {},
): Promise<PushAnswer> {
  if (new TextEncoder().encode(file).length > MAX_PUSH_BYTES) return { ok: false, reason: "tooLarge" };
  try {
    const res = await fetchImpl(`${server.url}/roadbooks`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${server.token}`, "Content-Type": "application/json" },
      body: file,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as { id?: unknown; replaced?: unknown; stamp?: unknown } | null;
      return typeof body?.id === "number"
        ? {
            ok: true,
            id: body.id,
            replaced: body.replaced === true,
            stamp: typeof body.stamp === "string" ? body.stamp : null,
          }
        : { ok: false, reason: "failed" };
    }
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "unauthorized" };
    if (res.status === 400) return { ok: false, reason: "invalid" };
    if (res.status === 409) return { ok: false, reason: "full" };
    if (res.status === 429) {
      const wait = Number(res.headers?.get?.("Retry-After"));
      return { ok: false, reason: "busy", ...(Number.isFinite(wait) && wait > 0 ? { retryAfterS: wait } : {}) };
    }
    if (res.status === 413) {
      const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
      return { ok: false, reason: body?.error === "library_full" ? "libraryFull" : "tooLarge" };
    }
    return { ok: false, reason: "failed" };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof TypeError || (e as Error)?.name === "TimeoutError" ? "unreachable" : "failed",
    };
  }
}
