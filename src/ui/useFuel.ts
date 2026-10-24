import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { alongRoute, FUEL_MAX_OFF_M, type Poi, type RoutePoi } from "../core/pois.ts";
import type { PreparedRoadbook } from "../core/types.ts";
import { fetchPois } from "../services/pois.ts";
import { readPois, useFuelRange, writePois } from "./fuelStore.ts";

export type FuelStatus = "loading" | "ready" | "failed";

export interface FuelState {
  status: FuelStatus;
  stops: RoutePoi[];
  rangeKm: number;
  setRangeKm: (km: number) => void;
  reload: () => void;
}

/**
 * The fuel stations along a roadbook (spec fuel-stops, ADR 0035): from the phone when they were found in the last month,
 * else asked for once and kept. A failure leaves the ride as it is and offers to try again.
 */
export function useFuel(rb: PreparedRoadbook): FuelState {
  const [pois, setPois] = useState<Poi[] | null>(null);
  const [status, setStatus] = useState<FuelStatus>("loading");
  const [rangeKm, setRangeKm] = useFuelRange();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const id = rb.roadbook.id;
  const load = useCallback(
    async (useCache: boolean) => {
      setStatus("loading");
      const kept = useCache ? await readPois("fuel", id) : null;
      const found = kept ?? (await fetchPois("fuel", rb.roadbook.line, rb.cumulativeM));
      if (!alive.current) return;
      if (!found) return setStatus("failed");
      if (!kept) void writePois("fuel", id, found);
      setPois(found);
      setStatus("ready");
    },
    [id, rb],
  );
  useEffect(() => {
    setPois(null);
    void load(true);
  }, [load]);

  const stops = useMemo(
    () => (pois ? alongRoute(rb.roadbook.line, rb.cumulativeM, pois, FUEL_MAX_OFF_M) : []),
    [pois, rb],
  );
  return { status, stops, rangeKm, setRangeKm, reload: () => void load(false) };
}
