import { useCallback, useEffect, useRef, useState } from "react";
import {
  outlookOfTraffic,
  trafficPoints,
  trafficStretches,
  type TrafficOutlook,
  type TrafficStretch,
} from "../core/traffic.ts";
import type { PreparedRoadbook } from "../core/types.ts";
import { fetchCapabilities } from "../services/capabilities.ts";
import { fetchTraffic } from "../services/traffic.ts";
import { useServer } from "./serverSetting.ts";
import { useTrafficEnabled } from "./trafficStore.ts";

/** none: no server, or one without a traffic source (nothing is shown); off: the rider turned it off. */
export type TrafficStatus = "none" | "off" | "loading" | "ready" | "failed";

export interface TrafficState {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  status: TrafficStatus;
  outlook: TrafficOutlook | null;
  stretches: TrafficStretch[];
  /** False when the server said its daily limit of traffic requests is used up. */
  budget: boolean;
  /** The countries the server's traffic works in (ISO codes); empty when it did not say. */
  countries: string[];
  reload: () => void;
}

/** The server caches an answer five minutes: ask again that often, and each time the rider has gone another 10 km. */
const REFRESH_MS = 5 * 60_000;
const REFRESH_EVERY_M = 10_000;

/**
 * The traffic on the next 60 km of the roadbook (spec traffic, ADR 0040), from the rider's own server when it has a traffic source. Without
 * a server, or with one that has no traffic, nothing is shown and nothing is asked. What was known stays while it is asked again.
 */
export function useTraffic(rb: PreparedRoadbook, progressM: number): TrafficState {
  const server = useServer();
  const [enabled, setEnabled, known] = useTrafficEnabled();
  const [capable, setCapable] = useState<boolean | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [outlook, setOutlook] = useState<TrafficOutlook | null>(null);
  const [status, setStatus] = useState<TrafficStatus>("none");
  const [budget, setBudget] = useState(true);
  const here = useRef(progressM);
  here.current = progressM;
  const asked = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Whether the server has traffic is asked once for each server, and only if the rider has not turned traffic off.
  const url = server?.url;
  const token = server?.token;
  useEffect(() => {
    setCapable(null);
    if (!server || !known || !enabled) return;
    let live = true;
    void fetchCapabilities(server).then((caps) => {
      if (!live) return;
      setCapable(caps?.traffic === true);
      setCountries(caps?.countries ?? []);
    });
    return () => {
      live = false;
    };
  }, [url, token, known, enabled]);

  const load = useCallback(async () => {
    if (!server) return;
    const mine = ++asked.current;
    const points = trafficPoints(rb.roadbook.line, rb.cumulativeM, here.current, rb.totalM);
    const answer = await fetchTraffic(server, points);
    if (!alive.current || asked.current !== mine) return;
    if (!answer) {
      setStatus("failed");
      return;
    }
    setOutlook(outlookOfTraffic(points.map((point, i) => ({ point, level: answer.levels[i]! }))));
    setBudget(answer.budget);
    setStatus("ready");
  }, [rb, url, token]);

  const bucket = Math.floor(progressM / REFRESH_EVERY_M);
  useEffect(() => {
    if (!known) return;
    if (!enabled) {
      asked.current++;
      setStatus("off");
      return;
    }
    if (capable === null) {
      // Not known yet whether this server has traffic: nothing to show.
      setStatus("none");
      return;
    }
    if (!capable) {
      asked.current++;
      setStatus("none");
      return;
    }
    setStatus((s) => (s === "ready" || s === "failed" ? s : "loading"));
    void load();
  }, [known, enabled, capable, bucket, load]);
  useEffect(() => {
    if (!known || !enabled || !capable) return;
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [known, enabled, capable, load]);
  useEffect(() => {
    setOutlook(null);
  }, [rb.roadbook.id]);

  const stretches =
    outlook && status !== "off" && status !== "none" ? trafficStretches(outlook.readings, progressM, rb.totalM) : [];
  return { enabled, setEnabled, status, outlook, stretches, budget, countries, reload: load };
}
