import type { Invitation } from "../core/liveShare.ts";

/** Joining a server with an invitation (agentRide's ADR 0029): the code, and the PIN if there is one, for a token. */

export type JoinResult =
  | { ok: true; token: string }
  | { ok: false; reason: "pin"; triesLeft: number }
  | { ok: false; reason: "locked" | "invalid" | "busy" | "unreachable" | "failed" };

const USER_AGENT = "MobileMotoRide/0.0.0 (+https://github.com/bhoudebert/mobile-motoride)";

export async function joinServer(
  invitation: Invitation,
  pin: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<JoinResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${invitation.url}/enrol`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify(pin ? { code: invitation.code, pin } : { code: invitation.code }),
      signal: controller.signal,
    });
    if (res.ok) {
      const body = (await res.json()) as { token?: unknown };
      return typeof body.token === "string" ? { ok: true, token: body.token } : { ok: false, reason: "failed" };
    }
    if (res.status === 429) return { ok: false, reason: "busy" };
    if (res.status === 404) return { ok: false, reason: "invalid" };
    if (res.status === 403) {
      const body = (await res.json().catch(() => ({}))) as { error?: unknown; triesLeft?: unknown };
      if (body.error === "locked") return { ok: false, reason: "locked" };
      if (body.error === "pin")
        return { ok: false, reason: "pin", triesLeft: typeof body.triesLeft === "number" ? body.triesLeft : 0 };
    }
    return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
