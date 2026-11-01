import { useCallback, useEffect, useRef, useState } from "react";
import type { ImportedRoadbook } from "../core/library.ts";
import type { ServerSetting } from "../core/liveShare.ts";
import { serializeRoadbookFile } from "../core/roadbookFile.ts";
import { getMe } from "../services/hostedServer.ts";
import { pushRoadbook, type PushProblem } from "../services/serverRoadbooks.ts";
import { libraryKeyOf } from "./libraryIdentity.ts";

export interface SendState {
  /** The library on the server, when it says: used and its limit, in bytes and MB. */
  quota: { usedBytes: number; limitMb: number | null } | null;
  sending: { done: number; total: number } | null;
  /** How the last sending ended: how many went, and why it stopped, if it did. */
  result: { sent: number; total: number; stopped: PushProblem | null } | null;
  send: () => void;
  dismiss: () => void;
  /** The state of the roadbooks sent one at a time, by id: being sent, or why it was not taken. */
  rows: Readonly<Record<string, "sending" | PushProblem>>;
  /** Send one roadbook, from its own row. */
  sendOne: (id: string) => void;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** A server that asks to wait longer than this is not waited for. */
const MAX_WAIT_S = 60;

/**
 * "Send to your server" (spec roadbook-library, "Changing server keeps what is on the phone"): the roadbooks that are only
 * on the phone go one by one, each linked to the number the server gives it; the sending stops at the first refusal that
 * another try would not mend (the library is full, 100 sent roadbooks, a refused phone), and waits when the server asks.
 */
export function useSendRoadbooks(
  server: ServerSetting | null,
  candidates: readonly ImportedRoadbook[],
  link: (id: string, serverId: number, stamp: string | null, key: string) => Promise<void>,
  onDone: () => void,
): SendState {
  const [quota, setQuota] = useState<SendState["quota"]>(null);
  const [sending, setSending] = useState<SendState["sending"]>(null);
  const [result, setResult] = useState<SendState["result"]>(null);
  const running = useRef(false);
  const [rows, setRows] = useState<SendState["rows"]>({});
  const count = candidates.length;

  // The room left is told before anything is sent.
  useEffect(() => {
    if (!server || count === 0) return;
    let live = true;
    void getMe(server).then(
      (r) => live && setQuota(r.ok ? { usedBytes: r.value.library.usedBytes, limitMb: r.value.library.limitMb } : null),
    );
    return () => {
      live = false;
    };
  }, [server?.url, server?.token, count]);

  const send = useCallback(() => {
    if (!server || running.current || candidates.length === 0) return;
    running.current = true;
    const todo = [...candidates];
    void (async () => {
      let sent = 0;
      let stopped: PushProblem | null = null;
      setResult(null);
      setSending({ done: 0, total: todo.length });
      const key = await libraryKeyOf(server);
      for (const item of todo) {
        let answer = await pushRoadbook(server, serializeRoadbookFile(item.roadbook));
        if (!answer.ok && answer.reason === "busy") {
          await wait(Math.min(answer.retryAfterS ?? 10, MAX_WAIT_S) * 1000);
          answer = await pushRoadbook(server, serializeRoadbookFile(item.roadbook));
        }
        if (!answer.ok) {
          stopped = answer.reason;
          break;
        }
        await link(item.roadbook.id, answer.id, answer.stamp, key);
        sent++;
        setSending({ done: sent, total: todo.length });
      }
      setSending(null);
      setResult({ sent, total: todo.length, stopped });
      running.current = false;
      onDone();
    })();
  }, [server, candidates, link, onDone]);

  // One roadbook from its own row: the same push, and its result shows on that row.
  const sendOne = useCallback(
    (id: string) => {
      const item = candidates.find((c) => c.roadbook.id === id);
      if (!server || !item || running.current) return;
      running.current = true;
      setRows((r) => ({ ...r, [id]: "sending" }));
      void (async () => {
        const key = await libraryKeyOf(server);
        let answer = await pushRoadbook(server, serializeRoadbookFile(item.roadbook));
        if (!answer.ok && answer.reason === "busy") {
          await wait(Math.min(answer.retryAfterS ?? 10, MAX_WAIT_S) * 1000);
          answer = await pushRoadbook(server, serializeRoadbookFile(item.roadbook));
        }
        if (answer.ok) await link(id, answer.id, answer.stamp, key);
        setRows((r) => {
          const { [id]: _gone, ...rest } = r;
          return answer.ok ? rest : { ...rest, [id]: answer.reason };
        });
        running.current = false;
        onDone();
      })();
    },
    [server, candidates, link, onDone],
  );

  return { quota, sending, result, send, dismiss: () => setResult(null), rows, sendOne };
}
