import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { useEffect, useState } from "react";
import { slugify } from "../core/gpx.ts";
import { DEFAULT_FUEL_RANGE_KM, isFuelRange, type Poi, type PoiKind } from "../core/pois.ts";

const RANGE_KEY = "fuel-range";

/** The tank range the rider sets: 200 km until the stored one is read, kept when it changes (spec fuel-stops). */
export function useFuelRange(): [number, (km: number) => void] {
  const [km, setKm] = useState(DEFAULT_FUEL_RANGE_KM);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(RANGE_KEY)
      .then((stored) => {
        const n = Number(stored);
        if (live && isFuelRange(n)) setKm(n);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const change = (next: number) => {
    setKm(next);
    AsyncStorage.setItem(RANGE_KEY, String(next)).catch(() => {});
  };
  return [km, change];
}

/** Places along a roadbook are kept on the phone this long: stations open and close, but not by the week. */
export const POI_CACHE_DAYS = 30;

const folder = () => new Directory(Paths.document, "pois");
const file = (kind: PoiKind, roadbookId: string) =>
  new File(folder(), `${kind}-${slugify(roadbookId) || "roadbook"}.json`);

interface Cached {
  v: 1;
  at: number;
  pois: Poi[];
}

/** The places kept for a roadbook, when they are not too old; null otherwise. */
export async function readPois(kind: PoiKind, roadbookId: string, now = Date.now()): Promise<Poi[] | null> {
  try {
    const f = file(kind, roadbookId);
    if (!f.exists) return null;
    const c = JSON.parse(await f.text()) as Cached;
    if (c.v !== 1 || !Array.isArray(c.pois) || now - c.at > POI_CACHE_DAYS * 86_400_000) return null;
    return c.pois;
  } catch {
    return null;
  }
}

export async function writePois(kind: PoiKind, roadbookId: string, pois: Poi[], now = Date.now()): Promise<void> {
  try {
    const dir = folder();
    if (!dir.exists) dir.create({ intermediates: true });
    const f = file(kind, roadbookId);
    if (!f.exists) f.create();
    await f.write(JSON.stringify({ v: 1, at: now, pois } satisfies Cached));
  } catch {
    // A list that cannot be kept is asked for again next time.
  }
}
