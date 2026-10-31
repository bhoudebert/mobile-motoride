import type { ServerSetting } from "../core/liveShare.ts";

/** Why the server did not take the ride: the rider is told in words, nothing is thrown, the ride stays on the phone. */
export type UploadProblem =
  "unauthorized" | "unsupported" | "full" | "tooLarge" | "busy" | "unreachable" | "timeout" | "failed";

export type UploadAnswer =
  | {
      ok: true;
      id: string;
      status: "created" | "replaced" | "unchanged";
      roadbook: { id: number; name: string } | null;
    }
  | { ok: false; reason: UploadProblem };

export interface UploadOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const problemOf = (status: number): UploadProblem =>
  status === 401 || status === 403
    ? "unauthorized"
    : status === 404 || status === 405
      ? "unsupported"
      : status === 409
        ? "full"
        : status === 413
          ? "tooLarge"
          : status === 429
            ? "busy"
            : "failed";

/**
 * Send a recorded ride to the rider's server (agentRide `PUT /rides/<id>`, the GPX exactly as kept on the phone). The server
 * answers 201 (created), or 200 (replaced, or unchanged): the same id and file again is harmless, so a lost answer is met
 * by sending again. A ride of several hours is a few megabytes over a mobile network: the wait is long.
 */
export async function uploadRide(
  server: ServerSetting,
  id: string,
  gpx: string,
  { fetchImpl = fetch, timeoutMs = 120_000 }: UploadOptions = {},
): Promise<UploadAnswer> {
  try {
    const res = await fetchImpl(`${server.url}/rides/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${server.token}`, "Content-Type": "application/gpx+xml" },
      body: gpx,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status !== 200 && res.status !== 201) return { ok: false, reason: problemOf(res.status) };
    const body = (await res.json().catch(() => null)) as {
      id?: unknown;
      status?: unknown;
      roadbook?: { id?: unknown; name?: unknown } | null;
    } | null;
    const status =
      body?.status === "replaced" || body?.status === "unchanged" || body?.status === "created"
        ? body.status
        : res.status === 201
          ? "created"
          : "replaced";
    const rb = body?.roadbook;
    return {
      ok: true,
      id: typeof body?.id === "string" && body.id ? body.id : id,
      status,
      roadbook: rb && typeof rb.id === "number" && typeof rb.name === "string" ? { id: rb.id, name: rb.name } : null,
    };
  } catch (e) {
    return {
      ok: false,
      reason: (e as Error)?.name === "TimeoutError" ? "timeout" : e instanceof TypeError ? "unreachable" : "failed",
    };
  }
}
