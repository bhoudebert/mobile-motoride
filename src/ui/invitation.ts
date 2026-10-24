import { useSyncExternalStore } from "react";
import type { Invitation } from "../core/liveShare.ts";

/** The invitation a link brought, until the rider joins or puts it away (spec live-share). Held in memory only. */
let pending: Invitation | null = null;
const listeners = new Set<() => void>();

export function setInvitation(next: Invitation | null): void {
  pending = next;
  for (const l of listeners) l();
}

export function usePendingInvitation(): Invitation | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pending,
  );
}
