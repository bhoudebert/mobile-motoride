import * as SecureStore from "expo-secure-store";
import { useEffect, useSyncExternalStore } from "react";
import type { ServerSetting } from "../core/liveShare.ts";

const KEY = "server-setting";

/** The server the rider chose (spec live-share): kept in the phone's secure store, shared by every screen that asks. */
let current: ServerSetting | null = null;
let loaded = false;
/** True once the stored setting has been read, so that "no server" can be told from "not read yet". */
let settled = false;
const listeners = new Set<() => void>();
const publish = (next: ServerSetting | null) => {
  current = next;
  for (const l of listeners) l();
};

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const text = await SecureStore.getItemAsync(KEY);
    const raw = text ? (JSON.parse(text) as Partial<ServerSetting>) : null;
    if (raw && typeof raw.url === "string" && typeof raw.token === "string")
      publish({ url: raw.url, token: raw.token });
  } catch {
    // Nothing stored, or the store cannot be read: no server.
  }
  settled = true;
  for (const l of listeners) l();
}

export async function saveServer(setting: ServerSetting): Promise<void> {
  publish(setting);
  await SecureStore.setItemAsync(KEY, JSON.stringify(setting)).catch(() => {});
}

export async function removeServer(): Promise<void> {
  publish(null);
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
}

/** For tests: forget what is loaded, so the next screen reads the store again. */
export function resetServerSetting(): void {
  loaded = false;
  settled = false;
  current = null;
  listeners.clear();
}

export function useServer(): ServerSetting | null {
  useEffect(() => {
    void load();
  }, []);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

/** Whether the stored setting has been read: a screen that acts on "no server" waits for it. */
export function useServerSettled(): boolean {
  useEffect(() => {
    void load();
  }, []);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => settled,
  );
}
