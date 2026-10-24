import type { ServerSetting } from "../core/liveShare.ts";

/** The relay of live sharing on the rider's server (agentRide's ADR 0028): what the phone asks of it. */

export type RelayResult = "ok" | "refused" | "gone" | "busy" | "unreachable" | "failed";

const USER_AGENT = "MobileMotoRide/0.0.0 (+https://github.com/bhoudebert/mobile-motoride)";

async function call(
  setting: ServerSetting,
  method: string,
  path: string,
  body?: unknown,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): Promise<RelayResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${setting.url}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${setting.token}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    if (res.ok) return "ok";
    if (res.status === 401) return "refused";
    // The server does not know the channel (it was restarted), or has ended it.
    if (res.status === 404 || res.status === 410) return "gone";
    if (res.status === 429) return "busy";
    return "failed";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

export const createChannel = (s: ServerSetting, channel: string, f?: typeof fetch) =>
  call(s, "PUT", `/share/${channel}`, undefined, f);

export const publish = (s: ServerSetting, channel: string, update: { iv: string; ct: string }, f?: typeof fetch) =>
  call(s, "POST", `/share/${channel}`, update, f);

/** `end` keeps the ride 30 minutes for followers; `stop` removes it at once. */
export const closeChannel = (s: ServerSetting, channel: string, mode: "end" | "stop", f?: typeof fetch) =>
  call(s, "DELETE", `/share/${channel}?mode=${mode}`, undefined, f);

/** Test a setting the way the app uses it: create a ride, remove it. */
export async function testServer(s: ServerSetting, random: () => string, f?: typeof fetch): Promise<RelayResult> {
  const channel = random();
  const made = await createChannel(s, channel, f);
  if (made !== "ok") return made;
  await closeChannel(s, channel, "stop", f);
  return "ok";
}
