import { OfflineManager, type OfflinePack } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { packKey, planPack } from "../core/offline.ts";
import type { LatLon } from "../core/types.ts";
import { BASEMAP_STYLES, type Basemap } from "./mapStyle.ts";

export type OfflineState =
  | { kind: "none" }
  | { kind: "saving"; percent: number }
  | { kind: "saved" }
  | { kind: "failed" }
  | { kind: "toolarge" };

const keyOf = (pack: OfflinePack) => (pack.metadata as { key?: string }).key;

async function packFor(key: string): Promise<OfflinePack | undefined> {
  return (await OfflineManager.getPacks()).find((p) => keyOf(p) === key);
}

/**
 * The map saved on the phone around a roadbook, for the basemap shown (spec offline-basemap, ADR 0023): what is saved,
 * and how to save it and remove it.
 */
export function useOfflineMap(roadbookId: string, line: LatLon[], basemap: Basemap) {
  const style = BASEMAP_STYLES[basemap];
  const key = packKey(roadbookId, basemap);
  const [state, setState] = useState<OfflineState>({ kind: "none" });
  const alive = useRef(true);
  const current = useRef(key);
  current.current = key;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // Only what concerns the roadbook and basemap now shown is written to the screen.
  const set = useCallback((forKey: string, next: OfflineState) => {
    if (alive.current && current.current === forKey) setState(next);
  }, []);

  useEffect(() => {
    if (typeof style !== "string") return setState({ kind: "none" });
    // Said at once, not after a tap that can lead nowhere.
    if (!planPack(line)) return setState({ kind: "toolarge" });
    setState({ kind: "none" });
    (async () => {
      try {
        const pack = await packFor(key);
        if (pack && (await pack.status()).state === "complete") set(key, { kind: "saved" });
      } catch {
        // No pack that can be read: nothing is saved.
      }
    })();
  }, [key, style, line, set]);

  const save = useCallback(async () => {
    if (typeof style !== "string") return;
    const plan = planPack(line);
    if (!plan) return set(key, { kind: "toolarge" });
    set(key, { kind: "saving", percent: 0 });
    try {
      // A download that was cut short is started afresh.
      const old = await packFor(key);
      if (old) await OfflineManager.deletePack(old.id);
      await OfflineManager.createPack(
        { mapStyle: style, bounds: plan.bounds, minZoom: plan.minZoom, maxZoom: plan.maxZoom, metadata: { key } },
        (_pack, status) =>
          set(
            key,
            status.state === "complete"
              ? { kind: "saved" }
              : { kind: "saving", percent: Math.round(status.percentage) },
          ),
        () => set(key, { kind: "failed" }),
      );
    } catch {
      set(key, { kind: "failed" });
    }
  }, [key, style, line, set]);

  const remove = useCallback(async () => {
    try {
      const pack = await packFor(key);
      if (pack) await OfflineManager.deletePack(pack.id);
      set(key, { kind: "none" });
    } catch {
      set(key, { kind: "failed" });
    }
  }, [key, set]);

  /** Whether a finished map is on the phone for this roadbook and basemap, read from the phone itself. */
  const isSaved = useCallback(async () => {
    try {
      const pack = await packFor(key);
      return !!pack && (await pack.status()).state === "complete";
    } catch {
      return false;
    }
  }, [key]);

  return { state, save, remove, isSaved };
}
