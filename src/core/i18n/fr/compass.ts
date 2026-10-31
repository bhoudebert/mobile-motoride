import type { Translated } from "../messages.ts";
import type { compass as English } from "../en/compass.ts";

/** La boussole de l'écran de conduite (spec ride-navigation). */
export const compass: Translated<typeof English> = {
  "compass.name": "Cap : {point}",
  "compass.point.n": "nord",
  "compass.point.ne": "nord-est",
  "compass.point.e": "est",
  "compass.point.se": "sud-est",
  "compass.point.s": "sud",
  "compass.point.sw": "sud-ouest",
  "compass.point.w": "ouest",
  "compass.point.nw": "nord-ouest",
  "compass.short.n": "N",
  "compass.short.ne": "NE",
  "compass.short.e": "E",
  "compass.short.se": "SE",
  "compass.short.s": "S",
  "compass.short.sw": "SO",
  "compass.short.w": "O",
  "compass.short.nw": "NO",
};
