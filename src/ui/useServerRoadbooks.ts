import { useCallback, useEffect, useState } from "react";
import type { ServerSetting } from "../core/liveShare.ts";
import type { ServerRoadbook } from "../core/serverRoadbooks.ts";
import { listServerRoadbooks, type ServerProblem } from "../services/serverRoadbooks.ts";

export type ServerList =
  | { status: "checking" }
  | { status: "ready"; items: ServerRoadbook[] }
  | { status: "unreachable" | "problem"; reason: ServerProblem };

/**
 * What the rider's server holds, asked each time the list opens (`enabled`), and again on request. A server with no
 * `/roadbooks` is not asked again during the visit (spec roadbook-library). Null with no server.
 */
export function useServerRoadbooks(server: ServerSetting | null, enabled: boolean) {
  const [list, setList] = useState<ServerList | null>(null);
  const [round, setRound] = useState(0);
  const url = server?.url;
  const token = server?.token;

  useEffect(() => {
    if (!enabled || !url || !token) {
      setList(null);
      return;
    }
    let live = true;
    setList({ status: "checking" });
    void listServerRoadbooks({ url, token }).then((answer) => {
      if (!live) return;
      setList(
        answer.ok
          ? { status: "ready", items: answer.items }
          : { status: answer.reason === "unreachable" ? "unreachable" : "problem", reason: answer.reason },
      );
    });
    return () => {
      live = false;
    };
  }, [enabled, url, token, round]);

  const reload = useCallback(() => setRound((n) => n + 1), []);
  return { list, reload };
}
