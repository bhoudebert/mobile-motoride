import * as Location from "expo-location";
import { useRef, useState } from "react";
import { t } from "../core/i18n/index.ts";
import { destinationRoadbook, type Place } from "../core/destination.ts";
import { prepareRoadbook } from "../core/roadbook.ts";
import type { LatLon, PreparedRoadbook } from "../core/types.ts";
import { routeToStart } from "../services/valhalla.ts";

export type GoStatus = { kind: "idle" } | { kind: "routing"; place: Place } | { kind: "message"; text: string };

/**
 * Route from the phone's position to a place and hand the ride over (spec destination-routing). Says in `status` what
 * went wrong; a late answer of a route the rider has left behind is ignored.
 */
export function useGoTo(onRoute: (rb: PreparedRoadbook, place: Place) => void) {
  const [status, setStatus] = useState<GoStatus>({ kind: "idle" });
  const run = useRef(0);

  const goTo = async (place: Place) => {
    const id = ++run.current;
    setStatus({ kind: "routing", place });
    const message = (text: string) => run.current === id && setStatus({ kind: "message", text });
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== "granted") return message(t("home.goto.noPermission"));
      const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (run.current !== id) return;
      const from: LatLon = [here.coords.latitude, here.coords.longitude];
      const line = await routeToStart(from, [place.lat, place.lon]);
      if (run.current !== id) return;
      if (!line) return message(t("home.goto.noRoute"));
      setStatus({ kind: "idle" });
      onRoute(prepareRoadbook(destinationRoadbook(place, from, line)), place);
    } catch {
      message(t("home.goto.noPosition"));
    }
  };

  /** Forget the last message, and any route still being asked. */
  const reset = () => {
    run.current++;
    setStatus({ kind: "idle" });
  };

  return { status, goTo, reset, busy: status.kind === "routing" };
}
