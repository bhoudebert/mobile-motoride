import { useEffect, useState } from "react";
import type { ServerSetting } from "../core/liveShare.ts";
import { accountStatus } from "../services/sidecar.ts";
import { accountToken, readHosted } from "./hostedAccount.ts";
import { hostedServer } from "./settings.ts";

/**
 * True for a server the app made that has no confirmed backup email: the menu shows a warning beside Server (spec
 * hosted-server). Asked of the sidecar when the server changes; nothing is asked for a rider's own server.
 */
export function useBackupWarning(server: ServerSetting | null, refresh?: unknown): boolean {
  const [warn, setWarn] = useState(false);
  useEffect(() => {
    const base = hostedServer()?.sidecarUrl;
    if (!server || !base) return setWarn(false);
    let live = true;
    void readHosted().then(async (mark) => {
      if (!mark || !live) return setWarn(false);
      const r = await accountStatus(base, await accountToken());
      if (live) setWarn(r.ok && r.value.emailConfirmed === false);
    });
    return () => {
      live = false;
    };
  }, [server?.url, server?.token, refresh]);
  return warn;
}
