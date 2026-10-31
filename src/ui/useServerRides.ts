import { useCallback, useEffect, useState } from "react";
import type { ServerSetting } from "../core/liveShare.ts";
import type { ServerRide } from "../core/serverRides.ts";
import { listServerRides } from "../services/serverRides.ts";

/**
 * The rides the rider's server keeps, read when My rides opens and on request. Null with no server and until it has answered:
 * a server that cannot be reached, or does not answer, leaves the list as it was, with no error (spec ride-recording): the rides
 * of the phone are shown all the same.
 */
export function useServerRides(server: ServerSetting | null) {
  const [rides, setRides] = useState<ServerRide[] | null>(null);
  const url = server?.url;
  const token = server?.token;
  const refresh = useCallback(async () => {
    if (!url || !token) return setRides(null);
    const answer = await listServerRides({ url, token });
    if (answer.ok) setRides(answer.rides);
  }, [url, token]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { serverRides: rides, refreshServer: refresh };
}
