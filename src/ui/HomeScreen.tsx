import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { Place } from "../core/destination.ts";
import { formatDistance } from "../core/format.ts";
import { t, type LanguageSetting } from "../core/i18n/index.ts";
import type { Scheme, ThemeSetting } from "../core/theme.ts";
import { recentDetail, recentTitle, type Recent } from "../core/recents.ts";
import { swipeOf } from "../core/swipe.ts";
import type { PreparedRoadbook } from "../core/types.ts";
import { HomeMenu } from "./HomeMenu.tsx";
import { LocateIcon, MenuIcon, PinIcon, RoadIcon, SearchIcon } from "./icons.tsx";
import { basemapStyle, ATTRIBUTION } from "./mapStyle.ts";
import { colors, fonts, lift, radii, themed } from "./theme.ts";
import { useGoTo } from "./useGoTo.ts";
import { useHere } from "./useHere.ts";
import { useVoiceMode } from "./voice.ts";

/** Before the position is known: all of Europe, wide. */
const WIDE_VIEW = { center: [8, 48] as [number, number], zoom: 4 };
const HERE_ZOOM = 14;
const REST_RECENTS = 2;
const DRAG_DP = 10;

/**
 * The first screen (spec home-screen, ADR 0024): the map where the rider is, a "Where to?" search, the roadbooks and the
 * recent rides on a bottom panel, and a menu. The name of the app is not printed on it.
 */
export function HomeScreen({
  roadbooks,
  recents,
  onOpenRoadbook,
  onRoute,
  onSearch,
  onRoadbooks,
  onClearRecents,
  onImport,
  onRides,
  onServer,
  onSafety,
  language = "system",
  onLanguage,
  theme = "system",
  scheme = "light",
  onTheme,
}: {
  roadbooks: PreparedRoadbook[];
  recents: Recent[];
  onOpenRoadbook: (rb: PreparedRoadbook) => void;
  onRoute: (rb: PreparedRoadbook, place: Place) => void;
  onSearch: () => void;
  onRoadbooks: () => void;
  onClearRecents: () => void;
  onImport: () => void;
  onRides: () => void;
  onServer: () => void;
  onSafety?: () => void;
  /** The language choice and how to change it; the menu offers the item when there is a way (spec languages). */
  language?: LanguageSetting;
  onLanguage?: (next: LanguageSetting) => void;
  /** The look choice, the look in use and how to change it (spec appearance). */
  theme?: ThemeSetting;
  scheme?: Scheme;
  onTheme?: (next: ThemeSetting) => void;
}) {
  const { here, locate } = useHere();
  const [voice, setVoice] = useVoiceMode();
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const go = useGoTo(onRoute);
  const camera = useRef<CameraRef>(null);
  const touch = useRef<{ y: number; x: number } | null>(null);
  const { height } = useWindowDimensions();

  // The map follows the first position that comes, and the control brings it back.
  useEffect(() => {
    if (here.pos) camera.current?.easeTo({ center: [here.pos[1], here.pos[0]], zoom: HERE_ZOOM, duration: 600 });
  }, [here.pos]);

  const hereFeature = useMemo(
    () =>
      here.pos
        ? {
            type: "FeatureCollection" as const,
            features: [
              {
                type: "Feature" as const,
                properties: {},
                geometry: { type: "Point" as const, coordinates: [here.pos[1], here.pos[0]] },
              },
            ],
          }
        : null,
    [here.pos],
  );

  const open = (r: Recent) => {
    if (go.busy) return;
    if (r.kind === "roadbook") {
      const rb = roadbooks.find((b) => b.roadbook.id === r.id);
      if (rb) onOpenRoadbook(rb);
      return;
    }
    void go.goTo(r.place);
  };

  const shown = expanded ? recents : recents.slice(0, REST_RECENTS);
  const initial = here.pos ? { center: [here.pos[1], here.pos[0]] as [number, number], zoom: HERE_ZOOM } : WIDE_VIEW;

  return (
    <View style={styles.screen}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={basemapStyle(mapFailed ? "off" : "light")}
        onDidFailLoadingMap={() => setMapFailed(true)}
        attribution={false}
        logo={false}
      >
        <Camera ref={camera} initialViewState={initial} />
        {hereFeature ? (
          <GeoJSONSource id="here" data={hereFeature}>
            <Layer
              id="here-halo"
              type="circle"
              paint={{ "circle-radius": 18, "circle-color": colors.hazard, "circle-opacity": 0.18 }}
            />
            <Layer
              id="here"
              type="circle"
              paint={{
                "circle-radius": 9,
                "circle-color": colors.hazard,
                "circle-stroke-width": 3,
                "circle-stroke-color": colors.paper,
              }}
            />
          </GeoJSONSource>
        ) : null}
      </Map>

      {/* While the menu is open only the menu can be reached: what is under it is not drawn. */}
      {menu ? null : (
        <View style={styles.top} pointerEvents="box-none">
          <Pressable
            style={styles.round}
            onPress={() => setMenu(true)}
            accessibilityRole="button"
            accessibilityLabel={t("home.menu.open")}
          >
            <MenuIcon />
          </Pressable>
        </View>
      )}

      {menu ? null : (
        <View style={[styles.sheet, expanded && { maxHeight: height * 0.78 }]} testID="home-sheet">
          <Pressable
            style={styles.locate}
            onPress={() => void locate()}
            accessibilityRole="button"
            accessibilityLabel={t("home.locate")}
          >
            <LocateIcon />
          </Pressable>
          <View
            // A vertical drag on the top of the panel pulls it up or folds it, whatever it lands on.
            onStartShouldSetResponderCapture={(e) => {
              touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
              return false;
            }}
            onMoveShouldSetResponderCapture={(e) => {
              if (!touch.current) return false;
              const dx = Math.abs(e.nativeEvent.pageX - touch.current.x);
              const dy = Math.abs(e.nativeEvent.pageY - touch.current.y);
              return dy > DRAG_DP && dy > dx;
            }}
            onResponderTerminationRequest={() => false}
            onResponderRelease={(e) => {
              if (!touch.current) return;
              const swipe = swipeOf(e.nativeEvent.pageX - touch.current.x, e.nativeEvent.pageY - touch.current.y);
              if (swipe) setExpanded(swipe === "up");
            }}
          >
            <Pressable
              style={styles.handle}
              onPress={() => setExpanded((x) => !x)}
              accessibilityRole="button"
              accessibilityLabel={expanded ? t("home.recent.fold") : t("home.recent.showAll")}
              accessibilityState={{ expanded }}
            >
              <View style={styles.pill} />
            </Pressable>
            <Pressable
              style={styles.search}
              onPress={onSearch}
              accessibilityRole="button"
              accessibilityLabel={t("home.search")}
            >
              <SearchIcon />
              <Text style={styles.searchText}>{t("home.search")}</Text>
            </Pressable>
            <View style={styles.chips}>
              <Pressable
                style={styles.chip}
                onPress={onRoadbooks}
                accessibilityRole="button"
                accessibilityLabel={t("home.roadbooks")}
              >
                <RoadIcon color={colors.mossText} size={20} />
                <Text style={styles.chipText}>{t("home.roadbooks")}</Text>
              </Pressable>
            </View>
            {here.status === "denied" ? (
              <Text style={styles.notice} accessibilityRole="alert">
                {t("home.locationDenied")}
              </Text>
            ) : null}
            {go.status.kind === "routing" ? (
              <Text style={styles.notice}>{t("home.routing", { name: go.status.place.name })}</Text>
            ) : null}
            {go.status.kind === "message" ? (
              <Text style={styles.notice} accessibilityRole="alert">
                {go.status.text}
              </Text>
            ) : null}
            <Text style={styles.heading}>{t("home.recent.heading")}</Text>
          </View>
          {recents.length === 0 ? (
            <Text style={styles.empty}>{t("home.recent.empty")}</Text>
          ) : (
            <ScrollView scrollEnabled={expanded} style={styles.list} keyboardShouldPersistTaps="handled">
              {shown.map((r) => (
                <Pressable
                  key={r.kind === "place" ? `p${r.place.lat},${r.place.lon}` : `r${r.id}`}
                  style={styles.recent}
                  onPress={() => open(r)}
                  disabled={go.busy}
                  accessibilityRole="button"
                  accessibilityLabel={
                    r.kind === "place"
                      ? t("home.ride.to", { name: recentTitle(r) })
                      : t("home.ride.roadbook", { name: recentTitle(r) })
                  }
                >
                  <View style={styles.recentIcon}>{r.kind === "place" ? <PinIcon /> : <RoadIcon />}</View>
                  <View style={styles.recentText}>
                    <Text style={styles.recentTitle} numberOfLines={1}>
                      {recentTitle(r)}
                    </Text>
                    {recentDetail(r) ? (
                      <Text style={styles.recentDetail} numberOfLines={1}>
                        {recentDetail(r)}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <Text style={styles.attribution}>{ATTRIBUTION}</Text>
        </View>
      )}

      {menu ? (
        <HomeMenu
          voice={voice}
          onVoice={setVoice}
          language={language}
          onLanguage={onLanguage}
          theme={theme}
          scheme={scheme}
          onTheme={onTheme}
          hasRecents={recents.length > 0}
          onClearRecents={() => {
            onClearRecents();
            setMenu(false);
          }}
          onRoadbooks={() => {
            setMenu(false);
            onRoadbooks();
          }}
          onSearch={() => {
            setMenu(false);
            onSearch();
          }}
          onImport={() => {
            setMenu(false);
            onImport();
          }}
          onRides={() => {
            setMenu(false);
            onRides();
          }}
          onServer={() => {
            setMenu(false);
            onServer();
          }}
          onSafety={
            onSafety
              ? () => {
                  setMenu(false);
                  onSafety();
                }
              : undefined
          }
          onClose={() => setMenu(false)}
        />
      ) : null}
    </View>
  );
}

/** The distance of a roadbook, for its line in the recent rides. */
export const roadbookDetail = (rb: PreparedRoadbook) =>
  t(rb.loop ? "home.detail.loop" : "home.detail.oneway", { distance: formatDistance(rb.totalM) });

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.paper },
    top: { position: "absolute", top: (StatusBar.currentHeight ?? 0) + 12, left: 12, right: 12, flexDirection: "row" },
    round: {
      width: 52,
      height: 52,
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      ...lift,
    },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.paper,
      borderTopLeftRadius: radii.sheet,
      borderTopRightRadius: radii.sheet,
      paddingHorizontal: 16,
      paddingBottom: 28,
      ...lift,
    },
    locate: {
      position: "absolute",
      right: 16,
      top: -68,
      width: 52,
      height: 52,
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      ...lift,
    },
    handle: { height: 48, alignItems: "center", justifyContent: "center" },
    pill: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.rule },
    search: {
      minHeight: 56,
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.rule,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
    },
    searchText: { color: colors.ink2, fontFamily: fonts.bold, fontSize: 18 },
    chips: { paddingTop: 12 },
    chip: {
      minHeight: 48,
      borderRadius: radii.pill,
      backgroundColor: colors.moss,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 18,
    },
    chipText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 15 },
    notice: { color: colors.rustText, fontFamily: fonts.sans, fontSize: 14, paddingTop: 10 },
    heading: {
      color: colors.ink2,
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      paddingTop: 16,
      paddingBottom: 4,
    },
    empty: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14, paddingVertical: 12 },
    list: { flexGrow: 0 },
    recent: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 6 },
    recentIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      backgroundColor: colors.paper2,
      alignItems: "center",
      justifyContent: "center",
    },
    recentText: { flex: 1, gap: 2 },
    recentTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    recentDetail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 13 },
    attribution: { color: colors.ink2, fontFamily: fonts.mono, fontSize: 9, paddingTop: 6, opacity: 0.8 },
  }),
);
