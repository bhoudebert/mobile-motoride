import { useCallback, useEffect, useRef, useState } from "react";
import type { PreparedRoadbook } from "../core/types.ts";
import { outlookOf, samplePoints, weigh, type Outlook } from "../core/weather.ts";
import { fetchForecast } from "../services/weather.ts";
import { useWeatherEnabled } from "./weatherStore.ts";

export type WeatherStatus = "off" | "loading" | "ready" | "failed";

export interface WeatherState {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  status: WeatherStatus;
  outlook: Outlook | null;
  reload: () => void;
}

/** The forecast is asked for again every 10 minutes, and each time the rider has gone another 10 km. */
const REFRESH_MS = 10 * 60_000;
const REFRESH_EVERY_M = 10_000;

/**
 * The weather on the next 60 km of the roadbook (spec weather, ADR 0037): the forecast for here and every 15 km ahead, at the time the
 * rider will be there. What was known stays on screen while it is asked for again. With the weather off nothing is asked.
 */
export function useWeather(rb: PreparedRoadbook, progressM: number, speedMps: number | null): WeatherState {
  const [enabled, setEnabled, known] = useWeatherEnabled();
  const [outlook, setOutlook] = useState<Outlook | null>(null);
  const [status, setStatus] = useState<WeatherStatus>("loading");
  const here = useRef({ progressM, speedMps });
  here.current = { progressM, speedMps };
  const asked = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const mine = ++asked.current;
    const points = samplePoints(
      rb.roadbook.line,
      rb.cumulativeM,
      here.current.progressM,
      rb.totalM,
      here.current.speedMps,
      Date.now(),
    );
    const answers = await Promise.all(points.map((p) => fetchForecast(p.lat, p.lon)));
    if (!alive.current || asked.current !== mine) return;
    if (answers.every((a) => a === null)) {
      setStatus("failed");
      return;
    }
    setOutlook(outlookOf(points.map((p, i) => weigh(p, answers[i]!))));
    setStatus("ready");
  }, [rb]);

  const bucket = Math.floor(progressM / REFRESH_EVERY_M);
  useEffect(() => {
    // Nothing is asked before the stored choice is known: a rider who turned the weather off is not asked once more.
    if (!known) return;
    if (!enabled) {
      asked.current++;
      setStatus("off");
      return;
    }
    setStatus((s) => (s === "ready" ? s : "loading"));
    void load();
  }, [known, enabled, bucket, load]);
  useEffect(() => {
    if (!known || !enabled) return;
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [known, enabled, load]);
  useEffect(() => {
    setOutlook(null);
  }, [rb.roadbook.id]);

  return { enabled, setEnabled, status, outlook, reload: () => void load() };
}
