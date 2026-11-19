import { Camera, GeoJSONSource, Layer, Map } from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Place } from "../core/destination.ts";
import { formatDuration } from "../core/eta.ts";
import { boundsOf, formatDistance } from "../core/format.ts";
import { t } from "../core/i18n/index.ts";
import type { RouteChoice } from "../core/routeChoices.ts";
import { BackButton } from "./BackButton.tsx";
import { TOP_INSET } from "./insets.ts";
import { basemapStyle } from "./mapStyle.ts";
import { colors, fonts, radii, themed } from "./theme.ts";

/** The colours of the routes that are not selected, so a card and its line are told together. */
const OTHER_COLORS = () => [colors.signal, colors.rust];

const lineOf = (choice: RouteChoice) => ({
  type: "Feature" as const,
  properties: {},
  geometry: { type: "LineString" as const, coordinates: choice.line.map(([lat, lon]) => [lon, lat]) },
});

/**
 * The routes to a place, on a map and as cards: the first (the least time) selected, drawn thick and green, the others thinner in
 * another colour (spec destination-routing, "Choose between routes"). Start opens the ride on the selected one.
 */
export function RoutesScreen({
  place,
  routes,
  onBack,
  onStart,
}: {
  place: Place;
  routes: RouteChoice[];
  onBack: () => void;
  onStart: (route: RouteChoice) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [mapFailed, setMapFailed] = useState(false);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const bounds = useMemo(() => boundsOf(routes.flatMap((r) => r.line)), [routes]);
  const features = useMemo(() => routes.map(lineOf), [routes]);
  const others = OTHER_COLORS();
  // Each route other than the selected one keeps its colour as the selection moves: the colour follows the card.
  const colorOf = (i: number) => (i === selected ? colors.routeNext : others[i % others.length]!);
  const order = routes.map((_, i) => i).filter((i) => i !== selected);
  const first = routes[0]!;

  return (
    <View style={styles.screen}>
      <View style={styles.mapBox}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={basemapStyle(mapFailed ? "off" : "light")}
          onDidFailLoadingMap={() => setMapFailed(true)}
          attribution={false}
          logo={false}
        >
          <Camera initialViewState={{ bounds, padding: { top: TOP_INSET + 72, bottom: 24, left: 32, right: 32 } }} />
          {[...order, selected].map((i) => (
            <GeoJSONSource key={`${i}-${i === selected ? "on" : "off"}`} id={`choice-${i}`} data={features[i]!}>
              <Layer
                id={`choice-${i}-casing`}
                type="line"
                paint={{ "line-color": colors.paper, "line-width": i === selected ? 12 : 8 }}
                layout={{ "line-cap": "round", "line-join": "round" }}
              />
              <Layer
                id={`choice-${i}`}
                type="line"
                paint={{ "line-color": colorOf(i), "line-width": i === selected ? 8 : 4 }}
                layout={{ "line-cap": "round", "line-join": "round" }}
              />
            </GeoJSONSource>
          ))}
        </Map>
        <BackButton onPress={onBack} label={t("home.back.results")} style={styles.back} />
      </View>
      <View style={styles.sheet}>
        <Text style={styles.title}>{t("home.routes.title")}</Text>
        <Text style={styles.place}>{place.name}</Text>
        <ScrollView contentContainerStyle={styles.cards} style={styles.scroll}>
          {routes.map((r, i) => {
            const name = t(`home.routes.${r.kind}`);
            const time = formatDuration(r.totalS);
            const distance = formatDistance(r.lengthM);
            const extra = r.totalS - first.totalS;
            return (
              <Pressable
                key={`${r.kind}-${i}`}
                testID={`route-card-${i}`}
                style={[styles.card, i === selected && styles.cardOn, { borderLeftColor: colorOf(i) }]}
                onPress={() => setSelected(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: i === selected }}
                accessibilityLabel={t("home.routes.select", { name, time, distance })}
              >
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.figures}>{t("home.routes.line", { time, distance })}</Text>
                {i > 0 && extra >= 60 ? (
                  <Text style={styles.note}>{t("home.routes.slower", { time: formatDuration(extra) })}</Text>
                ) : null}
                {r.delayS >= 60 ? (
                  <Text style={styles.note}>{t("home.routes.traffic", { time: formatDuration(r.delayS) })}</Text>
                ) : null}
                {r.closed ? <Text style={styles.closed}>{t("home.routes.closed")}</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          style={styles.start}
          onPress={() => onStart(routes[selected]!)}
          accessibilityRole="button"
          accessibilityLabel={t("home.routes.start")}
        >
          <Text style={styles.startText}>{t("home.routes.start")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.paper },
    mapBox: { flex: 1 },
    back: {
      position: "absolute",
      top: TOP_INSET + 8,
      left: 8,
      minHeight: 48,
      minWidth: 48,
      paddingHorizontal: 12,
      justifyContent: "center",
      backgroundColor: colors.paper,
      borderRadius: radii.pill,
    },
    sheet: {
      backgroundColor: colors.paper,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 24,
      maxHeight: "55%",
    },
    title: { color: colors.accent, fontFamily: fonts.bold, fontSize: 22 },
    place: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14, paddingBottom: 8 },
    scroll: { flexGrow: 0 },
    cards: { gap: 8, paddingBottom: 12 },
    card: {
      minHeight: 56,
      backgroundColor: colors.card,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.rule,
      borderLeftWidth: 8,
      padding: 12,
      gap: 2,
    },
    cardOn: { borderColor: colors.accent },
    name: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17 },
    figures: { color: colors.ink, fontFamily: fonts.sans, fontSize: 15 },
    note: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 13 },
    closed: { color: colors.rustText, fontFamily: fonts.bold, fontSize: 13 },
    start: {
      minHeight: 56,
      backgroundColor: colors.moss,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    startText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 18 },
  }),
);
