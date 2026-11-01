import { parseLinkCode, parseMe, type Me } from "../core/hosted.ts";
import type { ServerSetting } from "../core/liveShare.ts";

/** What the phone asks of its own hosted server with the token it was given (agentRide `GET /me`, `POST /oauth/link-code`). */

export type ServerAnswer<T> =
  { ok: true; value: T } | { ok: false; reason: "refused" | "busy" | "unreachable" | "failed" };

const USER_AGENT = "MobileMotoRide/0.0.0 (+https://github.com/bhoudebert/mobile-motoride)";

async function call(
  server: ServerSetting,
  method: string,
  path: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<ServerAnswer<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${server.url}${path}`, {
      method,
      headers: { Authorization: `Bearer ${server.token}`, Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (res.ok) return { ok: true, value: await res.json().catch(() => null) };
    if (res.status === 401) return { ok: false, reason: "refused" };
    if (res.status === 429) return { ok: false, reason: "busy" };
    return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

/** What this rider may use. A 401 means the token is no longer valid (the rider was deleted); a pause is a 200. */
export async function getMe(server: ServerSetting, fetchImpl?: typeof fetch): Promise<ServerAnswer<Me>> {
  const r = await call(server, "GET", "/me", fetchImpl);
  if (!r.ok) return r;
  const me = parseMe(r.value);
  return me ? { ok: true, value: me } : { ok: false, reason: "failed" };
}

export async function linkCode(server: ServerSetting, fetchImpl?: typeof fetch) {
  const r = await call(server, "POST", "/oauth/link-code", fetchImpl);
  if (!r.ok) return r;
  const code = parseLinkCode(r.value);
  return code ? ({ ok: true, value: code } as const) : ({ ok: false, reason: "failed" } as const);
}
