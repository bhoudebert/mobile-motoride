import { useCallback, useEffect, useRef, useState } from "react";
import { alongRoute, lineWindow, PLACE_AHEAD_M, PLACE_MAX_OFF_M, type PlaceKind, type RoutePoi } from "../core/pois.ts";
import type { PreparedRoadbook } from "../core/types.ts";
import { fetchPois } from "../services/pois.ts";

export type PlacesStatus = "idle" | "loading" | "ready" | "failed";

export interface PlacesState {
  kind: PlaceKind | null;
  status: PlacesStatus;
  results: RoutePoi[];
  /** The place the rider chose to go to: it stays on the map and over the panel until cleared. */
  selected: RoutePoi | null;
  search: (kind: PlaceKind) => void;
  select: (place: RoutePoi | null) => void;
  /** Back to the choice of a kind. */
  reset: () => void;
}

/**
 * Looking for a kind of place in the next 60 km of the roadbook (spec places-search, ADR 0035), asked of Overpass when the
 * rider chooses it. The ride is not touched: a place is only shown, and going there is riding off the route, which the app
 * already guides back from.
 */
export function usePlaces(rb: PreparedRoadbook, progressM: number): PlacesState {
  const [kind, setKind] = useState<PlaceKind | null>(null);
  const [status, setStatus] = useState<PlacesStatus>("idle");
  const [results, setResults] = useState<RoutePoi[]>([]);
  const [selected, setSelected] = useState<RoutePoi | null>(null);
  const progress = useRef(progressM);
  progress.current = progressM;
  // An answer that comes after the rider asked for something else is dropped.
  const asked = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setKind(null);
    setStatus("idle");
    setResults([]);
    setSelected(null);
    asked.current++;
  }, [rb.roadbook.id]);

  const search = useCallback(
    (next: PlaceKind) => {
      const mine = ++asked.current;
      setKind(next);
      setStatus("loading");
      setResults([]);
      const from = Math.max(0, progress.current - 200);
      const win = lineWindow(rb.roadbook.line, rb.cumulativeM, from, from + PLACE_AHEAD_M);
      void fetchPois(next, win.line, win.cumulativeM, { quick: true }).then((pois) => {
        if (!alive.current || asked.current !== mine) return;
        if (!pois) return setStatus("failed");
        setResults(alongRoute(rb.roadbook.line, rb.cumulativeM, pois, PLACE_MAX_OFF_M).filter((p) => p.atM >= from));
        setStatus("ready");
      });
    },
    [rb],
  );
  const reset = useCallback(() => {
    asked.current++;
    setKind(null);
    setStatus("idle");
    setResults([]);
  }, []);
  return { kind, status, results, selected, search, select: setSelected, reset };
}
