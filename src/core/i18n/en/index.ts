import { common } from "./common.ts";
import { nav } from "./nav.ts";
import { ride } from "./ride.ts";
import { home } from "./home.ts";
import { server } from "./server.ts";
import { gauges } from "./gauges.ts";
import { rec } from "./rec.ts";
import { review } from "./review.ts";
import { fuel } from "./fuel.ts";
import { places } from "./places.ts";
import { weather } from "./weather.ts";
import { traffic } from "./traffic.ts";
import { safety } from "./safety.ts";
import { compass } from "./compass.ts";

/** Every English message: the table that defines the keys (ADR 0032). One file per area, keys prefixed by the area. */
export const en = {
  ...common,
  ...nav,
  ...ride,
  ...home,
  ...server,
  ...gauges,
  ...rec,
  ...review,
  ...fuel,
  ...places,
  ...weather,
  ...traffic,
  ...safety,
  ...compass,
};
export const AREAS = {
  common,
  nav,
  ride,
  home,
  server,
  gauges,
  rec,
  review,
  fuel,
  places,
  weather,
  traffic,
  safety,
  compass,
};
