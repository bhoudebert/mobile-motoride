import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { t } from "../core/i18n/index.ts";
import type { Scheme } from "../core/theme.ts";
import { colors, getScheme } from "./theme.ts";

/** The plain look and the colour one; the plain one is dark in the dark look (spec appearance). */
export type Basemap = "light" | "colour" | "off";

// One object per look: a style that is a new object at every read would redraw the map, and loop an effect that depends on it.
const blanks: Partial<Record<Scheme, StyleSpecification>> = {};
const blankStyle = (): StyleSpecification =>
  (blanks[getScheme()] ??= {
    version: 8,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": colors.paper } }],
  });

const styleOf = (b: Basemap): string | StyleSpecification =>
  b === "off"
    ? blankStyle()
    : b === "colour"
      ? "https://tiles.openfreemap.org/styles/liberty"
      : (process.env.EXPO_PUBLIC_MAP_STYLE_URL ??
        (getScheme() === "dark"
          ? "https://tiles.openfreemap.org/styles/fiord"
          : "https://tiles.openfreemap.org/styles/positron"));

/** The style of a basemap in the look in use. "off" has no tiles and no network: the roadbook line is the map (spec ride-navigation). */
export const basemapStyle = styleOf;

/** Roads and names from OpenFreeMap, no key (ADR 0007). `EXPO_PUBLIC_MAP_STYLE_URL` replaces the plain one. Read at use time. */
export const BASEMAP_STYLES: Record<Basemap, string | StyleSpecification> = {
  get light() {
    return styleOf("light");
  },
  get colour() {
    return styleOf("colour");
  },
  get off() {
    return styleOf("off");
  },
};

/** The name of a basemap in the language in use. */
export const basemapLabel = (b: Basemap): string => t(`home.map.${b}`);
/** The same, as a record read at use time, for the code that indexes by basemap. */
export const BASEMAP_LABEL: Record<Basemap, string> = {
  get light() {
    return basemapLabel("light");
  },
  get colour() {
    return basemapLabel("colour");
  },
  get off() {
    return basemapLabel("off");
  },
};
export const BASEMAP_ORDER: Basemap[] = ["light", "colour", "off"];
export const ATTRIBUTION = "© OpenStreetMap contributors, OpenFreeMap";
