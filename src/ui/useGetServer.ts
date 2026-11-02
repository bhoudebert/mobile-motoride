import { useCallback, useEffect, useRef, useState } from "react";
import { type Plan, type SetupStep, SETUP_SLOW_MS, STATUS_EVERY_MS } from "../core/hosted.ts";
import { accountStatus, createFreeAccount, listPlans, type SidecarFailure } from "../services/sidecar.ts";
import { accountToken, clearJournal, readJournal, writeJournal } from "./hostedAccount.ts";
import { joinHosted } from "./hostedJoin.ts";
import { hostedServer } from "./settings.ts";

export type GetServerView =
  | { kind: "closed" }
  | { kind: "plans"; plans: Plan[] | null; failure: SidecarFailure["reason"] | null }
  | { kind: "setup"; step: SetupStep; slow: boolean; failure: SidecarFailure["reason"] | null };

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Getting a free server from the app (spec hosted-server, ADR 0047): the plans, then one setup that is written in a
 * journal first and resumed whenever the screen opens, so that closing the app never loses it.
 */
export function useGetServer(): {
  view: GetServerView;
  open: () => void;
  close: () => void;
  getFree: () => void;
} {
  const [view, setView] = useState<GetServerView>({ kind: "closed" });
  const alive = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const setup = useCallback(async () => {
    const config = hostedServer();
    if (!config || running.current) return;
    running.current = true;
    const base = config.sidecarUrl;
    const show = (v: GetServerView) => alive.current && setView(v);
    const fail = (failure: SidecarFailure["reason"], step: SetupStep) =>
      show({ kind: "setup", step, slow: false, failure });
    try {
      const token = await accountToken();
      await writeJournal({ plan: "free" });
      show({ kind: "setup", step: "creating", slow: false, failure: null });
      let r = await createFreeAccount(base, token);
      const started = Date.now();
      while (alive.current && r.ok && r.value.state === "pending") {
        await wait(STATUS_EVERY_MS);
        if (!alive.current) return;
        show({ kind: "setup", step: "creating", slow: Date.now() - started >= SETUP_SLOW_MS, failure: null });
        r = await accountStatus(base, token);
      }
      if (!alive.current) return;
      if (!r.ok) return fail(r.reason, "creating");
      if (r.value.state !== "ready") return fail(r.value.state === "suspended" ? "suspended" : "failed", "creating");
      show({ kind: "setup", step: "connecting", slow: false, failure: null });
      const failure = await joinHosted(base, token, "new");
      if (failure) return fail(failure, "connecting");
      await clearJournal();
      show({ kind: "closed" });
    } finally {
      running.current = false;
    }
  }, []);

  // A setup that was under way when the app was closed goes on.
  useEffect(() => {
    if (!hostedServer()) return;
    void readJournal().then((j) => {
      if (j && alive.current) void setup();
    });
  }, [setup]);

  const open = useCallback(() => {
    const config = hostedServer();
    if (!config) return;
    setView({ kind: "plans", plans: null, failure: null });
    void listPlans(config.sidecarUrl).then((r) => {
      if (!alive.current) return;
      setView(
        r.ok ? { kind: "plans", plans: r.value, failure: null } : { kind: "plans", plans: null, failure: r.reason },
      );
    });
  }, []);

  return {
    view,
    open,
    close: () => setView({ kind: "closed" }),
    getFree: () => void setup(),
  };
}
