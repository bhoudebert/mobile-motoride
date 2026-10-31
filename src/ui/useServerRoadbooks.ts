import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerSetting } from "../core/liveShare.ts";
import type { ServerRoadbook } from "../core/serverRoadbooks.ts";
import { listServerRoadbooks, refreshServerRoadbook, type ServerProblem } from "../services/serverRoadbooks.ts";

export type ServerList =
  | { status: "checking" }
  | { status: "ready"; items: ServerRoadbook[] }
  | { status: "unreachable"; reason: ServerProblem }
  | { status: "problem"; reason: ServerProblem };

/** How often the list is asked again while the server is making a file (spec roadbook-library). */
export const POLL_MS = 4000;

/**
 * What the rider's server holds, asked each time the list opens (`enabled`), and again on request. A server with no
 * `/roadbooks` is not asked again during the visit (spec roadbook-library). Null with no server.
 *
 * While a roadbook is `refreshing` the list is asked again every few seconds without showing it is being asked. `refresh`
 * asks the server for a new file of one roadbook; when that roadbook is ready (`current`, and its stamp is not the one held)
 * `onReady` is called once with the listed entry, to download it.
 */
export function useServerRoadbooks(
  server: ServerSetting | null,
  enabled: boolean,
  onReady?: (entry: ServerRoadbook) => void,
) {
  const [list, setList] = useState<ServerList | null>(null);
  const [round, setRound] = useState(0);
  const [asking, setAsking] = useState<number | null>(null);
  const [problem, setProblem] = useState<ServerProblem | null>(null);
  /** The roadbooks the rider asked to refresh, until their new file has been handed over. */
  const awaiting = useRef(new Set<number>());
  const ready = useRef(onReady);
  ready.current = onReady;
  const url = server?.url;
  const token = server?.token;

  const settle = useCallback((items: ServerRoadbook[]) => {
    for (const e of items) {
      if (!awaiting.current.has(e.id)) continue;
      if (e.state === "current") {
        awaiting.current.delete(e.id);
        ready.current?.(e);
      } else if (e.state === "failed" || e.state === "outdated") awaiting.current.delete(e.id);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !url || !token) {
      setList(null);
      return;
    }
    let live = true;
    setList({ status: "checking" });
    void listServerRoadbooks({ url, token }).then((answer) => {
      if (!live) return;
      if (answer.ok) settle(answer.items);
      setList(
        answer.ok
          ? { status: "ready", items: answer.items }
          : answer.reason === "unreachable"
            ? { status: "unreachable", reason: answer.reason }
            : { status: "problem", reason: answer.reason },
      );
    });
    return () => {
      live = false;
    };
  }, [enabled, url, token, round, settle]);

  const refreshing = list?.status === "ready" && list.items.some((e) => e.state === "refreshing");
  useEffect(() => {
    if (!refreshing || !url || !token) return;
    let live = true;
    const timer = setInterval(() => {
      void listServerRoadbooks({ url, token }).then((answer) => {
        // A poll that cannot be answered leaves the list as it was: the next one tries again.
        if (!live || !answer.ok) return;
        settle(answer.items);
        setList({ status: "ready", items: answer.items });
      });
    }, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [refreshing, url, token, settle]);

  const reload = useCallback(() => setRound((n) => n + 1), []);

  /** Ask for a new file of a roadbook; the list shows it as being made at once. */
  const refresh = useCallback(
    async (entry: ServerRoadbook) => {
      if (!url || !token) return;
      setProblem(null);
      setAsking(entry.id);
      const answer = await refreshServerRoadbook({ url, token }, entry.id);
      setAsking(null);
      if (!answer.ok) return setProblem(answer.reason);
      if (answer.state === "current") return;
      awaiting.current.add(entry.id);
      setList((l) =>
        l?.status === "ready"
          ? {
              status: "ready",
              items: l.items.map((e) => (e.id === entry.id ? { ...e, state: "refreshing" as const } : e)),
            }
          : l,
      );
    },
    [url, token],
  );

  return { list, reload, refresh, asking, problem };
}
