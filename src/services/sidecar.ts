import { parsePlans, parseStatus, type HostedStatus, type Plan } from "../core/hosted.ts";

/** The sidecar's app API (docs/sidecar.openapi.json of the sidecar, spec hosted-server). No account but a random token. */

export type SidecarFailure =
  | { ok: false; reason: "unreachable" | "failed" | "unavailable" | "suspended" | "rejected" }
  | { ok: false; reason: "busy"; retryAfterS: number | null };
export type SidecarResult<T> = { ok: true; value: T } | SidecarFailure;

const USER_AGENT = "MobileMotoRide/0.0.0 (+https://github.com/bhoudebert/mobile-motoride)";

export interface SidecarOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function call(
  base: string,
  path: string,
  init: { method: string; token?: string; body?: unknown },
  options: SidecarOptions,
): Promise<SidecarResult<unknown>> {
  const { fetchImpl = fetch, timeoutMs = 10_000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${base}${path}`, {
      method: init.method,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(init.token ? { Authorization: `AccountToken ${init.token}` } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true, value: await res.json().catch(() => null) };
    if (res.status === 429) {
      const wait = Number(res.headers?.get?.("Retry-After"));
      return { ok: false, reason: "busy", retryAfterS: Number.isFinite(wait) && wait > 0 ? wait : null };
    }
    if (res.status === 503) return { ok: false, reason: "unavailable" };
    if (res.status === 409) return { ok: false, reason: "suspended" };
    if (res.status === 422) return { ok: false, reason: "rejected" };
    return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

const asStatus = (r: SidecarResult<unknown>): SidecarResult<HostedStatus> => {
  if (!r.ok) return r;
  const status = parseStatus(r.value);
  return status ? { ok: true, value: status } : { ok: false, reason: "failed" };
};

export async function listPlans(base: string, options: SidecarOptions = {}): Promise<SidecarResult<Plan[]>> {
  const r = await call(base, "/v1/plans", { method: "GET" }, options);
  if (!r.ok) return r;
  const plans = parsePlans(r.value);
  return plans.length > 0 ? { ok: true, value: plans } : { ok: false, reason: "failed" };
}

/** A free server from the account token alone; the same token gives the same server (idempotent). */
export async function createFreeAccount(base: string, token: string, options: SidecarOptions = {}) {
  return asStatus(await call(base, "/v1/accounts", { method: "POST", body: { accountToken: token } }, options));
}

/** The state of the account; never an invitation (a read does not write). */
export async function accountStatus(base: string, token: string, options: SidecarOptions = {}) {
  return asStatus(await call(base, "/v1/account/status", { method: "GET", token }, options));
}

/** An invitation for a rider who exists: the phone joins their server with it. */
export async function reinvite(base: string, token: string, revokeOthers = false, options: SidecarOptions = {}) {
  return asStatus(await call(base, "/v1/invitations", { method: "POST", token, body: { revokeOthers } }, options));
}

/** Delete the rider, the library and the sidecar's rows for good. */
export async function deleteAccount(base: string, token: string, options: SidecarOptions = {}) {
  const r = await call(base, "/v1/account", { method: "DELETE", token }, options);
  return r.ok ? ({ ok: true, value: true } as const) : r;
}
