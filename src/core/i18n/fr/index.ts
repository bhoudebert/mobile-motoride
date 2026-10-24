import type { en } from "../en/index.ts";
import type { Translated } from "../messages.ts";
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

/** The French table: the type makes a missing or an extra key a compile error. */
export const fr: Translated<typeof en> = {
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
};
export const FR_AREAS = {
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
};
