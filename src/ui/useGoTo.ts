import * as Location from "expo-location";
import { useRef, useState } from "react";
import { t } from "../core/i18n/index.ts";
import { destinationRoadbook, type Place } from "../core/destination.ts";
import { prepareRoadbook } from "../core/roadbook.ts";
import type { RouteChoice } from "../core/routeChoices.ts";
import type { LatLon, PreparedRoadbook } from "../core/types.ts";
import { chooseRoutes } from "../services/routeChoices.ts";
import { useServer } from "./serverSetting.ts";
import { useTrafficEnabled } from "./trafficStore.ts";

export type GoStatus = { kind: "idle" } | { kind: "routing"; place: Place } | { kind: "message"; text: string };

/** The routes to a place to choose from: where the rider is, and what each route is (spec destination-routing). */
export interface GoChoice {
  place: Place;
  from: LatLon;
  routes: RouteChoice[];
}

/** The ride of a route to a place: its line as a roadbook, as any other. */
export const rideToPlace = (place: Place, from: LatLon, line: LatLon[]): PreparedRoadbook =>
  prepareRoadbook(destinationRoadbook(place, from, line));

/**
 * Route from the phone's position to a place and hand over (spec destination-routing): the ride when there is one road,
 * the routes to choose from when there are several. Says in `status` what went wrong; a late answer of a route the rider
 * has left behind is ignored.
 */
export function useGoTo(onRoute: (rb: PreparedRoadbook, place: Place) => void, onChoose: (choice: GoChoice) => void) {
  const [status, setStatus] = useState<GoStatus>({ kind: "idle" });
  const run = useRef(0);
  const server = useServer();
  const [trafficOn, , trafficKnown] = useTrafficEnabled();

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
      const routes = await chooseRoutes(from, [place.lat, place.lon], {
        server,
        enabled: trafficOn && trafficKnown,
      });
      if (run.current !== id) return;
      const first = routes[0];
      if (!first) return message(t("home.goto.noRoute"));
      setStatus({ kind: "idle" });
      if (routes.length === 1) onRoute(rideToPlace(place, from, first.line), place);
      else onChoose({ place, from, routes });
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
