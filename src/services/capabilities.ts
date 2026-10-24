import type { ServerSetting } from "../core/liveShare.ts";
import { parseCapabilities, type Capabilities } from "../core/capabilities.ts";

export interface CapabilitiesOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** What the rider's server offers, from its public health answer, or null when it could not be reached or did not answer as a server. */
export async function fetchCapabilities(
  server: ServerSetting,
  options: CapabilitiesOptions = {},
): Promise<Capabilities | null> {
  const { fetchImpl = fetch, timeoutMs = 8000 } = options;
  try {
    const res = await fetchImpl(`${server.url}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return parseCapabilities(await res.json());
  } catch {
    return null;
  }
}
