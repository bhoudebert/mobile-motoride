import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map,
  type CameraRef,
  type MapRef,
} from "@maplibre/maplibre-react-native";
import { useKeepAwake } from "expo-keep-awake";
import { speak, stopSpeaking } from "./speech.ts";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import {
  Animated,
  BackHandler,
  Easing,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import arrowImage from "../../assets/arrow.png";
import riderImage from "../../assets/rider.png";
import pumpImage from "../../assets/pump.png";
import { etaOf, formatClock, formatDuration, nextPace } from "../core/eta.ts";
import { boundsOf, formatDistance, kmh } from "../core/format.ts";
import {
  approachFeature,
  camerasCollection,
  cornersCollection,
  lineFeature,
  riderFeature,
  stopsCollection,
} from "../core/geojson.ts";
import { countryAt } from "../core/cameraPolicy.ts";
import { DANGER_ZONES } from "./settings.ts";
import { UNKNOWN_LIMIT } from "../core/limits.ts";
import {
  needsDemoJunctions,
  parseReplayLink,
  replayAsks,
  replayPhases,
  replayStartIndex,
  withDemoJunctions,
  type ReplayPhase,
} from "../core/replay.ts";
import { startChoices, type StartChoice } from "../core/skip.ts";
import { swipeOf } from "../core/swipe.ts";
import { nextVoice, speaks, voiceName, type VoiceMode } from "../core/voice.ts";
import { t } from "../core/i18n/index.ts";
import type { MotionReading } from "../core/instruments.ts";
import type { PreparedRoadbook } from "../core/types.ts";
import { hudWidth, isLandscape } from "../core/layout.ts";
import { lockPortrait, unlockOrientation } from "./orientation.ts";
import { INSTRUCTION_BAR_HEIGHT, INSTRUCTION_BAR_TOP, InstructionBar } from "./InstructionBar.tsx";
import { JunctionCard } from "./JunctionCard.tsx";
import { ATTRIBUTION, BASEMAP_LABEL, BASEMAP_ORDER, BASEMAP_STYLES, type Basemap } from "./mapStyle.ts";
import { EndConfirm, JoinCard, LegendCard, StartFromList } from "./RideControlUi.tsx";
import { SKIP_GAP, SKIP_SQUARE, SKIP_SQUARE_SIDE, SkipConfirm, SkipSquare } from "./SkipUi.tsx";
import { SpeedLimitSign } from "./SpeedLimitSign.tsx";
import { colors, fonts, themed } from "./theme.ts";
import { useRide, type RideMode } from "./useRide.ts";
import type { RideMeta } from "../core/recording.ts";
import { Icon, type IconName } from "./Icon.tsx";
import { LiveShareChoice, LiveShareLine, LiveShareOffer } from "./LiveShareRow.tsx";
import { OfflineRow } from "./OfflineRow.tsx";
import { useLiveShare } from "./useLiveShare.ts";
import { CrashAlert } from "./CrashUi.tsx";
import { useCrashSettings } from "./crashStore.ts";
import { useCrash } from "./useCrash.ts";
import { useServer } from "./serverSetting.ts";
import { useOfflineMap } from "./offlineMap.ts";
import { useVoiceMode } from "./voice.ts";
import { FuelCard, FuelChip } from "./FuelUi.tsx";
import { useFuel } from "./useFuel.ts";
import { PlacesCard, PlacesChip, SelectedPlaceChip } from "./PlacesUi.tsx";
import { usePlaces } from "./usePlaces.ts";
import { WeatherCard, WeatherRow } from "./WeatherUi.tsx";
import { CompassChip } from "./CompassChip.tsx";
import { LEVEL_COLOR, TrafficCard, TrafficChip } from "./TrafficUi.tsx";
import { useTraffic } from "./useTraffic.ts";
import { useWeather } from "./useWeather.ts";
import { trafficCollection } from "../core/traffic.ts";
import { weatherAnnouncement, type Condition } from "../core/weather.ts";
import { fuelAnnouncement, poisCollection } from "../core/pois.ts";
import { InstrumentsCard, InstrumentsOverlay } from "./InstrumentsUi.tsx";
import { useCalibration, useInstrumentSettings } from "./instrumentSettings.ts";
import { runCalibration, useInstruments } from "./useInstruments.ts";

type Tone = "rust" | "signal" | "ink";

/** Landscape (ADR 0045): the bar sits near the top, where an iPhone has no notch and Android keeps its status bar. */
const LANDSCAPE_BAR_TOP = Platform.OS === "ios" ? 8 : (StatusBar.currentHeight ?? 0) + 4;
/** What an iPhone held sideways needs on each side when the system cannot say (no provider, as under test). */
const LANDSCAPE_SIDE_FALLBACK = Platform.OS === "ios" ? 47 : 0;
/** The panel's column also needs room for the map buttons: the buttons keep a column to themselves. */
/** The gauges start under the room of a warning banner, so a warning is never covered. */
const FOLLOW_ZOOM = 16;
/** How long the buttons stay once the rider has asked for them. */
const CONTROLS_SHOWN_MS = 8000;
/** Room kept for the sharing line above the buttons. */
const SHARE_BLOCK = 96;
/** How long the row takes to slide in or out, and the room it takes (buttons and the gap above them). */
const SLIDE_MS = 220;
/** A drag this long (dp) and mostly vertical is taken by the panel, not by the button under the finger. */
const DRAG_DP = 10;
const ROW_BLOCK = 64;
const overviewPadding = (belowBar: number, landscape: boolean) => ({
  top: belowBar + 20,
  right: 40,
  bottom: landscape ? 40 : 320,
  left: 40,
});

function Banner({
  tone,
  title,
  sub,
  right,
  top,
  compact = false,
}: {
  tone: Tone;
  title: string;
  sub: string;
  right: number;
  top: number;
  compact?: boolean;
}) {
  const text = tone === "signal" ? colors.onSignal : tone === "rust" ? colors.onRust : colors.paper;
  return (
    <View
      style={[styles.banner, compact && styles.bannerCompact, { backgroundColor: colors[tone], right, top }]}
      accessibilityLiveRegion="polite"
    >
      <Text
        style={[styles.bannerTitle, compact && styles.bannerTitleCompact, { color: text }]}
        numberOfLines={compact ? 1 : undefined}
      >
        {title}
      </Text>
      <Text
        style={[styles.bannerSub, compact && styles.bannerSubCompact, { color: text }]}
        numberOfLines={compact ? 1 : undefined}
      >
        {sub}
      </Text>
    </View>
  );
}

/** A round button with a picture, not a word: a word is too wide in another language. The name is for the screen reader. */
function RoundButton({
  icon,
  label,
  name,
  onPress,
}: {
  icon?: IconName;
  /** A sign that is not a picture ("+", "−"). */
  label?: string;
  /** What a screen reader says. */
  name: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.round} onPress={onPress} accessibilityRole="button" accessibilityLabel={name}>
      {icon ? <Icon name={icon} /> : <Text style={styles.roundText}>{label}</Text>}
    </Pressable>
  );
}

const VOICE_ICON: Record<VoiceMode, IconName> = { full: "volume-high", alerts: "volume-medium", off: "volume-mute" };

export function RideScreen({
  rb: roadbook,
  onBack,
  backLabel = t("ride.back.list"),
  onRideSaved,
}: {
  rb: PreparedRoadbook;
  onBack: () => void;
  /** Where Back goes, in words ("Back to the map" when the ride was opened from the home screen). */
  backLabel?: string;
  /** Told once when the ride that ends has been saved (spec ride-recording). */
  onRideSaved?: (meta: RideMeta) => void;
}) {
  useKeepAwake();
  // The phone may turn on this screen only (ADR 0045); in landscape the panel is a column and the map takes the rest.
  const { width, height } = useWindowDimensions();
  const landscape = isLandscape(width, height);
  // The camera cut-out, the notch and the system bars as the system reports them for the way the phone is held.
  const insets = useContext(SafeAreaInsetsContext);
  const sideL = landscape ? (insets ? insets.left : LANDSCAPE_SIDE_FALLBACK) : 0;
  const sideR = landscape ? (insets ? insets.right : LANDSCAPE_SIDE_FALLBACK) : 0;
  const hudW = landscape ? hudWidth(width) + sideL : 0;
  const topPad = landscape ? Math.max(LANDSCAPE_BAR_TOP, (insets?.top ?? 0) + 4) : 0;
  // Sideways the instruction bar is in the panel column, so the map's top row (warnings, skip) starts at the top.
  const barTop = landscape ? topPad : INSTRUCTION_BAR_TOP;
  const belowBar = landscape ? topPad : barTop + INSTRUCTION_BAR_HEIGHT + 8;
  const gaugesTop = landscape ? topPad + SKIP_SQUARE_SIDE + 8 : belowBar + 120;
  useEffect(() => {
    unlockOrientation();
    return lockPortrait;
  }, []);
  // Development builds only: a scripted ride that shows junction guidance rides a roadbook given junctions.
  const [demoJunctions, setDemoJunctions] = useState(false);
  const rb = useMemo(() => (demoJunctions ? withDemoJunctions(roadbook) : roadbook), [roadbook, demoJunctions]);
  const [mode, setMode] = useState<RideMode>("idle");
  const [paused, setPaused] = useState(false);
  // The panel's own height: the map buttons stand on its top edge, whatever it holds.
  const [panelH, setPanelH] = useState(PANEL_GUESS);
  // In landscape the panel is a column at the left, so nothing stands on its top edge.
  const lower = landscape ? (insets?.bottom ?? 0) : panelH;
  const [voice, setVoice] = useVoiceMode();
  const [replay, setReplay] = useState<ReplayPhase[] | null>(null);
  /** Only the `startfrom` scenario applies a start point to a scripted ride. */
  const [replayStarts, setReplayStarts] = useState(false);
  /** Only the `join` scenario shows the join card. */
  const [replayJoins, setReplayJoins] = useState(false);
  const [ending, setEnding] = useState<null | "end" | "back">(null);
  const [legend, setLegend] = useState(false);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [trafficOpen, setTrafficOpen] = useState(false);
  // The fuel stations along the roadbook, from the phone or asked for once (spec fuel-stops).
  const fuel = useFuel(roadbook);
  /** The list of every route point, opened from the join card. */
  const [choosingMore, setChoosingMore] = useState(false);
  const choices = useMemo(() => startChoices(rb), [rb]);
  // The first point is the default: choosing it is not a start from a point.
  const [startFrom, setStartFrom] = useState<StartChoice | null>(null);
  const startPoint = startFrom && startFrom.atM > 1 ? startFrom : null;
  // Sharing the ride live, when the rider set a server and chose it before the ride (spec live-share).
  const server = useServer();
  // The lean and G readings of the moment: the gauges write them, the recording of the ride reads them.
  const motionNow = useRef<MotionReading | null>(null);
  const [shareWanted, setShareWanted] = useState(false);
  const liveShare = useLiveShare({
    server,
    wanted: shareWanted,
    active: mode === "gps" && !replay,
    paused,
    name: rb.roadbook.name,
    onStopped: () => setShareWanted(false),
  });
  const { permission, prep, ride, nav, speedMps, fix, warning, zone, finished, skip, join, routingTo } = useRide(
    rb,
    mode,
    {
      paused,
      replay,
      // A scripted GPS ride plays its script as written: the chosen start point does not apply to it.
      start: mode === "gps" && (!replay || replayStarts) ? startPoint : null,
      ask: !replay || replayJoins,
      voice,
      onSaved: onRideSaved,
      liveShare: liveShare.sharer,
      motion: motionNow,
    },
  );
  // A place the rider looks for in the next 60 km of the roadbook (spec places-search).
  const places = usePlaces(roadbook, nav?.progressM ?? 0);
  // A crash or a fall on a ride on the phone's GPS: the alert, and the followers told (spec crash-detection).
  const crashSettings = useCrashSettings();
  const crash = useCrash({
    watching: crashSettings.enabled && crashSettings.ready && mode === "gps" && !replay,
    speedMps,
    tellFollowers: () => liveShare.alert(),
    clearFollowers: () => liveShare.clearAlert(),
  });
  // The weather on the next 60 km, at the time the rider will be there (spec weather).
  // How long is left, at the pace of the ride so far (spec ride-navigation).
  const [pace, setPace] = useState<number | null>(null);
  useEffect(() => setPace((p) => nextPace(p, speedMps)), [speedMps]);
  const eta = etaOf(nav?.remainingM ?? rb.totalM, pace, Date.now());
  const weather = useWeather(roadbook, nav?.progressM ?? 0, speedMps);
  // The traffic on the next 60 km, from the rider's own server when it has a TomTom key (spec traffic).
  const traffic = useTraffic(roadbook, nav?.progressM ?? 0);
  const trafficLines = useMemo(
    () => trafficCollection(rb.roadbook.line, rb.cumulativeM, traffic.stretches),
    [rb, traffic.stretches],
  );
  const [confirming, setConfirming] = useState(false);
  const [gauges, setGauges] = useState(false);
  const [gaugeSettings, setGaugeSettings] = useInstrumentSettings();
  const [calibration, setCalibration] = useCalibration();
  const instruments = useInstruments({
    settings: gaugeSettings,
    calibration,
    active: mode !== "idle",
    fix,
    shared: motionNow,
  });
  const calibrateNow = async () => {
    const result = await runCalibration();
    if ("done" in result) setCalibration(result.done);
    return result;
  };
  /** A banner stops short of the skip square, so it is never hidden behind it. */
  const bannerRight = skip.plan || skip.last ? 12 + (landscape ? SKIP_SQUARE_SIDE : SKIP_SQUARE) + SKIP_GAP : 12;
  // A route being found, or the point passed, takes the question away.
  useEffect(() => {
    if (confirming && !skip.canSkip) setConfirming(false);
  }, [confirming, skip.canSkip]);
  const [follow, setFollow] = useState(true);
  const [followZoom, setFollowZoom] = useState(FOLLOW_ZOOM);
  const [basemap, setBasemap] = useState<Basemap>("light");
  const [basemapFailed, setBasemapFailed] = useState(false);
  const offline = useOfflineMap(rb.roadbook.id, rb.roadbook.line, basemap);
  const camera = useRef<CameraRef>(null);
  const map = useRef<MapRef>(null);

  const line = useMemo(() => lineFeature(rb), [rb]);
  const approach = useMemo(() => approachFeature(ride), [ride]);
  const stops = useMemo(() => stopsCollection(rb), [rb]);
  const corners = useMemo(() => cornersCollection(ride), [ride]);
  // Cameras are drawn only on the stretches whose country, and the rider's, allow their place (spec danger-zones).
  const riderCountry = nav ? countryAt(ride.countrySegments, nav.progressM) : null;
  const cameras = useMemo(() => camerasCollection(ride, DANGER_ZONES ? riderCountry : null), [ride, riderCountry]);
  const bounds = useMemo(() => boundsOf(rb.roadbook.line), [rb]);
  const rider = useMemo(() => (nav ? riderFeature(nav.position, nav.bearingDeg) : null), [nav]);

  const running = mode !== "idle";
  const modalOpen = Boolean(
    ending ||
    legend ||
    gauges ||
    fuelOpen ||
    placesOpen ||
    weatherOpen ||
    trafficOpen ||
    crash.alert ||
    join ||
    confirming,
  );
  // While riding the buttons are folded away so the map has the room; a tap on the strip brings them back for a while.
  const [controls, setControls] = useState(false);
  const [touched, setTouched] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // The row slides out of the bottom of the panel and back, like a sheet; it stays mounted while it closes.
  const slide = useRef(new Animated.Value(0)).current;
  const [closing, setClosing] = useState(false);
  const wasOpen = useRef(false);
  // One style object for good: a fresh one on each render (the demo renders every second) would detach the animated
  // value for an instant, and a value that loses its last listener stops its animation, leaving the row half shown.
  const rowStyle = useMemo(
    () => ({
      // A ceiling, not a height: the row is as tall as what it holds (the buttons, and the sharing line above them).
      maxHeight: slide.interpolate({ inputRange: [0, 1], outputRange: [0, ROW_BLOCK + SHARE_BLOCK] }),
      opacity: slide,
      overflow: "hidden" as const,
      marginTop: -8,
    }),
    [slide],
  );
  // Sideways the buttons stay: the column has the room, and the grabber that folds them away is not offered.
  const showButtons = !running || controls || closing || landscape;
  useEffect(() => {
    if (!running) {
      slide.setValue(0);
      wasOpen.current = false;
      return setClosing(false);
    }
    if (controls) {
      wasOpen.current = true;
      setClosing(false);
      Animated.timing(slide, {
        toValue: 1,
        duration: SLIDE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      setClosing(true);
      Animated.timing(slide, {
        toValue: 0,
        duration: SLIDE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        // Finished or cut short, the row is gone unless the rider pulled it out again meanwhile.
        if (!wasOpen.current) setClosing(false);
      });
    }
  }, [running, controls, slide]);
  useEffect(() => {
    if (!running || !controls) return;
    if (modalOpen) return setControls(false);
    const timer = setTimeout(() => setControls(false), CONTROLS_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [running, controls, modalOpen, touched]);
  /** A GPS ride that has begun: the rider is followed, so ending it loses something (spec ride-control). */
  const rideOn = mode === "gps" && prep === "ready";
  const speed = kmh(speedMps);
  const next = nav?.nextCorner;

  // Follow: keep the rider in the middle, the camera turned along the line.
  useEffect(() => {
    if (!running || !follow || !nav) return;
    camera.current?.easeTo({
      center: [nav.position[1], nav.position[0]],
      zoom: followZoom,
      bearing: nav.bearingDeg,
      pitch: 0,
      duration: 900,
    });
  }, [nav, follow, followZoom, running, basemap]);

  // Development builds only (ADR 0014): mobilemotoride://replay/<scenario> starts a GPS ride from a script.
  useEffect(() => {
    if (!__DEV__) return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      const scenario = parseReplayLink(url);
      const phases = scenario
        ? replayPhases(needsDemoJunctions(scenario) ? withDemoJunctions(roadbook) : rb, scenario)
        : null;
      if (!phases || !scenario) return;
      setDemoJunctions(needsDemoJunctions(scenario));
      const startIndex = replayStartIndex(scenario);
      if (startIndex !== null) setStartFrom(choices[startIndex] ?? null);
      setReplayStarts(startIndex !== null);
      setReplayJoins(replayAsks(scenario));
      setReplay(phases);
      setPaused(false);
      setFollow(true);
      setFollowZoom(FOLLOW_ZOOM);
      setMode("gps");
    });
    return () => sub.remove();
  }, [rb, roadbook, choices]);

  /** Full, Alerts, Off: the new mode says its name, unless it is Off, and Off cuts what is being said. */
  const changeVoice = () => {
    const next = nextVoice(voice);
    setVoice(next);
    stopSpeaking();
    if (next !== "off") speak(voiceName(next));
  };

  const overview = () => {
    setFollow(false);
    camera.current?.fitBounds(bounds, {
      padding: overviewPadding(belowBar, landscape),
      bearing: 0,
      pitch: 0,
      duration: 700,
    });
  };

  const start = (m: RideMode) => {
    setDemoJunctions(false);
    setReplayStarts(false);
    setReplayJoins(false);
    setEnding(null);
    setLegend(false);
    setChoosingMore(false);
    setReplay(null);
    setPaused(false);
    setFollow(true);
    setFollowZoom(FOLLOW_ZOOM);
    setMode(m);
  };

  const stop = () => {
    setDemoJunctions(false);
    setEnding(null);
    setReplay(null);
    setPaused(false);
    setControls(false);
    setMode("idle");
    overview();
  };

  /** Back to the list: a GPS ride is only left after the question (spec ride-control). */
  const goBack = () => {
    if (rideOn) return setEnding("back");
    onBack();
  };

  const endNow = () => {
    const leaving = ending === "back";
    stop();
    if (leaving) onBack();
  };

  // The phone's own Back button asks the same question during a ride, and closes a question that is open.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (ending) setEnding(null);
      else if (legend) setLegend(false);
      else if (gauges) setGauges(false);
      else if (fuelOpen) setFuelOpen(false);
      else if (placesOpen) setPlacesOpen(false);
      else if (weatherOpen) setWeatherOpen(false);
      else if (trafficOpen) setTrafficOpen(false);
      else if (choosingMore) setChoosingMore(false);
      else if (join) stop();
      else if (confirming) setConfirming(false);
      else goBack();
      return true;
    });
    return () => sub.remove();
  });

  // A long stretch without fuel after the next station is said once, 3 km before it (spec fuel-stops).
  const announcedFuel = useRef(new Set<string>());
  useEffect(() => {
    announcedFuel.current = new Set();
  }, [roadbook.roadbook.id]);
  const progressNow = nav?.progressM ?? null;
  useEffect(() => {
    if (!running || fuel.status !== "ready" || progressNow === null) return;
    const a = fuelAnnouncement(fuel.stops, progressNow, rb.totalM, fuel.rangeKm, announcedFuel.current);
    if (!a) return;
    announcedFuel.current.add(a.id);
    if (!speaks(voice, "fuel")) return;
    stopSpeaking();
    speak(
      t(a.kind === "last" ? "fuel.say.last" : "fuel.say.next", {
        distance: formatDistance(a.distM),
        gap: formatDistance(a.gapM),
      }),
    );
  }, [progressNow, running, fuel.status, fuel.stops, fuel.rangeKm]);

  // Bad weather coming is said once for each kind until the sky is clear again (spec weather).
  const saidWeather = useRef(new Set<Condition>());
  useEffect(() => {
    saidWeather.current = new Set();
  }, [roadbook.roadbook.id]);
  useEffect(() => {
    const o = weather.outlook;
    if (!running || !o) return;
    if (!o.coming) saidWeather.current = new Set();
    const a = weatherAnnouncement(o, saidWeather.current);
    if (!a) return;
    saidWeather.current.add(a.condition);
    if (!speaks(voice, "weather")) return;
    stopSpeaking();
    speak(t(`weather.say.${a.condition}` as "weather.say.rain", { distance: formatDistance(a.distM) }));
  }, [weather.outlook, running]);

  /** The basemap cannot be had: the roadbook alone, and say so. */
  const basemapFailedNow = () => {
    if (basemap === "off") return;
    setBasemapFailed(true);
    setBasemap("off");
  };

  // A style kept in the cache loads offline without any failure to report: ask the network itself, once per choice.
  useEffect(() => {
    const style = BASEMAP_STYLES[basemap];
    if (typeof style !== "string") return;
    let current = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    // A map saved on the phone needs no network to be shown (spec offline-basemap).
    const unreachable = async () => {
      if (current && !(await offline.isSaved())) basemapFailedNow();
    };
    fetch(style, { method: "HEAD", signal: controller.signal })
      .then((r) => {
        if (!r.ok) return unreachable();
      })
      .catch(unreachable)
      .finally(() => clearTimeout(timer));
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timer);
    };
    // basemapFailedNow reads the current basemap, which is what changed.
  }, [basemap]);

  const nextBasemap = () => {
    setBasemapFailed(false);
    setBasemap((b) => BASEMAP_ORDER[(BASEMAP_ORDER.indexOf(b) + 1) % BASEMAP_ORDER.length]!);
  };

  const zoomBy = async (delta: number) => {
    if (running && follow) return setFollowZoom((z) => Math.min(19, Math.max(8, z + delta)));
    const [zoom, center] = await Promise.all([map.current?.getZoom(), map.current?.getCenter()]);
    if (zoom === undefined || !center) return;
    camera.current?.easeTo({ center, zoom: zoom + delta, duration: 300 });
  };

  const hudBody = (
    <>
      {nav?.junction ? <JunctionCard junction={nav.junction.junction} /> : null}
      {running && !modalOpen && !landscape ? (
        <Pressable
          style={styles.grabber}
          onPress={() => setControls((c) => !c)}
          accessibilityRole="button"
          accessibilityLabel={controls ? t("ride.a11y.hideButtons") : t("ride.a11y.showButtons")}
          accessibilityState={{ expanded: controls }}
          accessibilityActions={[{ name: controls ? "collapse" : "expand" }]}
          onAccessibilityAction={() => setControls((c) => !c)}
        >
          <View style={styles.grabberPill} />
        </Pressable>
      ) : null}
      <View style={[styles.row, landscape && styles.rowWrap]}>
        {/* Sideways and not yet riding, a speed and a limit are nothing: the room goes to the options below. */}
        {landscape && !running ? null : (
          <View>
            <View style={[styles.speedBadge, nav?.over && styles.speedOver]}>
              <Text style={[styles.speed, landscape && styles.speedSide, nav?.over && styles.speedTextOver]}>
                {speed ?? "–"}
              </Text>
            </View>
            <Text style={styles.unit}>
              km/h
              {mode === "demo"
                ? paused
                  ? t("ride.unit.demoPaused")
                  : t("ride.unit.demo")
                : paused
                  ? t("ride.unit.paused")
                  : ""}
            </Text>
          </View>
        )}
        {landscape && !running ? null : (
          <SpeedLimitSign limit={nav?.speedLimit ?? UNKNOWN_LIMIT} over={nav?.over ?? false} compact={landscape} />
        )}
        <View
          style={[styles.col, landscape && styles.colSide]}
          accessible
          accessibilityLabel={
            finished
              ? undefined
              : t("ride.remainingName", {
                  distance: formatDistance(nav?.remainingM ?? rb.totalM),
                  duration: formatDuration(eta.seconds),
                  clock: formatClock(eta.arrivalMs),
                })
          }
        >
          {/* The next fuel stop stands in the panel over the distance left, not on the map. */}
          {modalOpen ? null : (
            <FuelChip
              inline
              status={fuel.status}
              stops={fuel.stops}
              progressM={nav?.progressM ?? 0}
              onPress={() => setFuelOpen(true)}
            />
          )}
          <View style={landscape ? styles.colTexts : undefined}>
            <Text style={[styles.big, landscape && styles.bigSide]}>
              {formatDistance(nav?.remainingM ?? rb.totalM)}
            </Text>
            <Text style={styles.unit}>
              {finished
                ? t("ride.unit.demoFinished")
                : `${formatDuration(eta.seconds)} · ${formatClock(eta.arrivalMs)}`}
            </Text>
          </View>
        </View>
      </View>
      {/* Sideways and riding, the card above says all of it, in less room. */}
      {landscape && running ? null : (
        <Text style={styles.line} numberOfLines={1}>
          {nav?.phase === "approach"
            ? `${ride.approachName ? t("ride.line.to", { place: ride.approachName }) : ride.approachTarget === "route" ? t("ride.line.backToRoute") : t("ride.line.toStart")} · ${formatDistance(nav.toStartM)}`
            : nav?.nextStop
              ? t("ride.line.next", { name: nav.nextStop.name, distance: formatDistance(nav.nextStop.distanceM) })
              : rb.roadbook.name}
        </Text>
      )}
      {next && !(landscape && running) ? (
        <Text style={styles.line}>
          {t("ride.line.corner", {
            severity: t(next.corner.severity === "hairpin" ? "ride.sev.hairpin" : "ride.sev.sharp"),
            direction: t(next.corner.direction === "left" ? "ride.dir.left" : "ride.dir.right"),
            distance: formatDistance(next.distanceM),
            speed: next.corner.advisoryKmh,
          })}
        </Text>
      ) : null}
      {!running ? <Text style={styles.note}>{t("ride.note.advisory")}</Text> : null}
      {!running && !modalOpen && server ? <LiveShareChoice on={shareWanted} onChange={setShareWanted} /> : null}
      {!running && basemap !== "off" ? (
        <OfflineRow state={offline.state} onSave={offline.save} onRemove={offline.remove} />
      ) : null}
    </>
  );
  const buttonRow = (
    <>
      {showButtons ? (
        <Animated.View
          testID="ride-row"
          style={running && !landscape ? rowStyle : undefined}
          importantForAccessibility={controls || !running ? "auto" : "no-hide-descendants"}
          accessibilityElementsHidden={running && !controls}
        >
          {/* The sharing line goes with the buttons: shown when they are, folded away with them. */}
          {running && !modalOpen && server && mode === "gps" && !replay && !shareWanted ? (
            <LiveShareOffer onShare={() => setShareWanted(true)} />
          ) : null}
          {!modalOpen && liveShare.status && liveShare.status !== "stopped" ? (
            <LiveShareLine
              status={liveShare.status}
              canLink={liveShare.canLink}
              onLink={liveShare.sendLink}
              onStop={liveShare.stop}
            />
          ) : null}
          <View style={[styles.row, running && styles.rowSlide]}>
            <Pressable
              style={[styles.button, landscape && styles.buttonSide, styles.secondary]}
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
            >
              <Text style={[styles.buttonText, { color: colors.mossText }]}>{t("ride.btn.back")}</Text>
            </Pressable>
            {running && prep === "ready" ? (
              <Pressable
                style={[styles.button, landscape && styles.buttonSide, styles.secondary]}
                onPress={() => {
                  setTouched((t) => t + 1);
                  setPaused((p) => !p);
                }}
                accessibilityRole="button"
                accessibilityLabel={t(
                  paused
                    ? mode === "demo"
                      ? "ride.a11y.resumeDemo"
                      : "ride.a11y.resumeRide"
                    : mode === "demo"
                      ? "ride.a11y.pauseDemo"
                      : "ride.a11y.pauseRide",
                )}
              >
                <Text style={[styles.buttonText, { color: colors.mossText }]}>
                  {paused ? t("ride.btn.resume") : t("ride.btn.pause")}
                </Text>
              </Pressable>
            ) : null}
            {running ? (
              <Pressable
                style={[styles.button, landscape && styles.buttonSide, styles.stop]}
                onPress={() => (rideOn ? setEnding("end") : stop())}
                accessibilityRole="button"
                accessibilityLabel={mode === "gps" ? t("ride.a11y.endRide") : t("ride.a11y.endDemo")}
              >
                <Text style={[styles.buttonText, { color: colors.onRust }]}>{t("ride.btn.end")}</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={[styles.button, landscape && styles.buttonSide, styles.secondary]}
                  onPress={() => start("demo")}
                  accessibilityRole="button"
                >
                  <Text style={[styles.buttonText, { color: colors.mossText }]}>{t("ride.btn.demo")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, landscape && styles.buttonSide, styles.start]}
                  onPress={() => start("gps")}
                  accessibilityRole="button"
                >
                  <Text style={[styles.buttonText, { color: colors.onSignal }]}>{t("ride.btn.start")}</Text>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      ) : null}
    </>
  );

  return (
    <View style={styles.screen}>
      {/* The ride screen proper. While a sheet is open it leaves the screen reader's tree: only the sheet can be reached. */}
      <View
        testID="ride-layer"
        style={styles.layer}
        importantForAccessibility={modalOpen ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={modalOpen}
      >
        {/* Map and what stands on it: the whole screen, or what the panel column leaves in landscape. */}
        <View testID="ride-stage" style={[styles.stage, landscape && { left: hudW, right: sideR }]}>
          <Map
            // A new style drops the layers added by the app: remount the map so they are drawn again.
            key={basemap}
            ref={map}
            style={StyleSheet.absoluteFill}
            mapStyle={BASEMAP_STYLES[basemap]}
            onDidFailLoadingMap={basemapFailedNow}
            attribution={false}
            logo={false}
            onRegionWillChange={(e) => {
              if (e.nativeEvent.userInteraction) setFollow(false);
            }}
          >
            <Camera ref={camera} initialViewState={{ bounds, padding: overviewPadding(belowBar, landscape) }} />
            <Images images={{ arrow: { source: arrowImage, sdf: true }, rider: riderImage, pump: pumpImage }} />
            <GeoJSONSource id="line" data={line}>
              <Layer
                id="line-casing"
                type="line"
                paint={{ "line-color": colors.paper, "line-width": 11 }}
                layout={{ "line-cap": "round", "line-join": "round" }}
              />
              <Layer
                id="line"
                type="line"
                paint={{ "line-color": colors.route, "line-width": 7 }}
                layout={{ "line-cap": "round", "line-join": "round" }}
              />
              <Layer
                id="line-arrows"
                type="symbol"
                layout={{
                  "symbol-placement": "line",
                  "symbol-spacing": 70,
                  "icon-image": "arrow",
                  "icon-size": 0.4,
                  "icon-rotation-alignment": "map",
                  "icon-allow-overlap": true,
                  "icon-ignore-placement": true,
                }}
                paint={{ "icon-color": colors.paper }}
              />
            </GeoJSONSource>
            {traffic.stretches.length > 0 ? (
              <GeoJSONSource id="traffic" data={trafficLines}>
                <Layer
                  id="traffic"
                  type="line"
                  paint={{
                    "line-color": ["match", ["get", "level"], "slow", LEVEL_COLOR.slow, LEVEL_COLOR.heavy],
                    "line-width": 7,
                    "line-opacity": 0.9,
                  }}
                  layout={{ "line-cap": "round", "line-join": "round" }}
                />
              </GeoJSONSource>
            ) : null}
            {fuel.stops.length > 0 ? (
              <GeoJSONSource id="fuel" data={poisCollection(fuel.stops)}>
                <Layer
                  id="fuel"
                  type="symbol"
                  layout={{
                    "icon-image": "pump",
                    "icon-size": 0.38,
                    "icon-allow-overlap": false,
                    "icon-anchor": "center",
                  }}
                />
              </GeoJSONSource>
            ) : null}
            {places.selected ? (
              <GeoJSONSource
                id="place"
                data={{
                  type: "Feature",
                  properties: {},
                  geometry: { type: "Point", coordinates: [places.selected.poi.lon, places.selected.poi.lat] },
                }}
              >
                <Layer
                  id="place"
                  type="circle"
                  paint={{
                    "circle-radius": 11,
                    "circle-color": colors.signal,
                    "circle-stroke-width": 4,
                    "circle-stroke-color": colors.onSignal,
                  }}
                />
              </GeoJSONSource>
            ) : null}
            {approach ? (
              <GeoJSONSource id="approach" data={approach}>
                <Layer
                  id="approach-casing"
                  type="line"
                  paint={{ "line-color": colors.paper, "line-width": 10 }}
                  layout={{ "line-cap": "round", "line-join": "round" }}
                />
                <Layer
                  id="approach"
                  type="line"
                  paint={{ "line-color": colors.hazard, "line-width": 5, "line-dasharray": [2, 1.5] }}
                  layout={{ "line-join": "round" }}
                />
                <Layer
                  id="approach-arrows"
                  type="symbol"
                  layout={{
                    "symbol-placement": "line",
                    "symbol-spacing": 70,
                    "icon-image": "arrow",
                    "icon-size": 0.4,
                    "icon-rotation-alignment": "map",
                    "icon-allow-overlap": true,
                    "icon-ignore-placement": true,
                  }}
                  paint={{ "icon-color": colors.paper }}
                />
              </GeoJSONSource>
            ) : null}
            <GeoJSONSource id="corners" data={corners}>
              <Layer
                id="corners"
                type="circle"
                // Only when zoomed in far enough to tell them apart: the overview reads route first (spec ride-navigation).
                minzoom={11}
                paint={{
                  "circle-radius": 5,
                  "circle-color": ["match", ["get", "severity"], "hairpin", colors.hazard, colors.signal],
                  "circle-stroke-color": colors.ink,
                  "circle-stroke-width": 1.5,
                }}
              />
            </GeoJSONSource>
            <GeoJSONSource id="cameras" data={cameras}>
              <Layer
                id="cameras"
                type="circle"
                minzoom={11}
                paint={{
                  "circle-radius": 6,
                  "circle-color": colors.limitRed,
                  "circle-stroke-color": colors.white,
                  "circle-stroke-width": 2,
                }}
              />
            </GeoJSONSource>
            <GeoJSONSource id="stops" data={stops}>
              <Layer
                id="stops"
                type="circle"
                paint={{
                  // A route point is a big dark dot with a pale ring; a service stop (café, fuel) a hollow one.
                  "circle-radius": ["match", ["get", "kind"], "stop", 7, 10],
                  "circle-color": ["match", ["get", "kind"], "stop", colors.paper, colors.route],
                  "circle-stroke-color": ["match", ["get", "kind"], "stop", colors.accent, colors.paper],
                  "circle-stroke-width": 3,
                }}
              />
            </GeoJSONSource>
            {rider ? (
              <GeoJSONSource id="rider" data={rider}>
                <Layer
                  id="rider"
                  type="symbol"
                  layout={{
                    "icon-image": "rider",
                    "icon-size": 0.5,
                    "icon-rotate": ["get", "bearing"],
                    "icon-rotation-alignment": "map",
                    "icon-allow-overlap": true,
                    "icon-ignore-placement": true,
                  }}
                />
              </GeoJSONSource>
            ) : null}
          </Map>

          {nav && !landscape ? <InstructionBar nav={nav} /> : null}

          {warning && !landscape ? (
            <Banner
              top={belowBar}
              right={bannerRight}
              compact={landscape}
              tone={warning.corner.severity === "hairpin" ? "rust" : "signal"}
              title={t(warning.corner.severity === "hairpin" ? "ride.banner.hairpin" : "ride.banner.sharp", {
                direction: t(warning.corner.direction === "left" ? "ride.dir.left" : "ride.dir.right").toUpperCase(),
              })}
              sub={t("ride.banner.cornerSub", {
                distance: formatDistance(next?.distanceM ?? warning.distanceM),
                speed: warning.corner.advisoryKmh,
              })}
            />
          ) : null}

          {!warning && zone && nav ? (
            <Banner
              top={belowBar}
              right={bannerRight}
              compact={landscape}
              tone="ink"
              title={zone.kind === "camera" ? t("ride.banner.camera") : t("ride.banner.zone")}
              sub={
                zone.kind === "camera"
                  ? t(zone.kmh ? "ride.banner.cameraAheadKmh" : "ride.banner.cameraAhead", {
                      distance: formatDistance(Math.max(0, zone.atM - nav.progressM)),
                      kmh: zone.kmh ?? 0,
                    })
                  : t("ride.banner.zoneToGo", { distance: formatDistance(Math.max(0, zone.endM - nav.progressM)) })
              }
            />
          ) : null}

          {paused && mode === "gps" ? (
            <Banner
              top={belowBar}
              right={bannerRight}
              compact={landscape}
              tone="ink"
              title={t("ride.banner.paused")}
              sub={t("ride.banner.pausedSub")}
            />
          ) : null}

          {mode === "gps" && prep === "locating" ? (
            <Banner
              top={belowBar}
              right={bannerRight}
              compact={landscape}
              tone="ink"
              title={t("ride.banner.locating")}
              sub={t("ride.banner.locatingSub")}
            />
          ) : null}

          {mode === "gps" && prep === "routing" ? (
            <Banner
              top={belowBar}
              right={bannerRight}
              compact={landscape}
              tone="ink"
              title={routingTo ? t("ride.banner.routingTo", { place: routingTo }) : t("ride.banner.routingStart")}
              sub={routingTo ? t("ride.banner.routingSubTo", { place: routingTo }) : t("ride.banner.routingSubStart")}
            />
          ) : null}

          {nav?.phase === "approach" && ride.approachDirect ? (
            <Banner
              top={belowBar}
              right={bannerRight}
              compact={landscape}
              tone="signal"
              title={
                ride.approachName
                  ? t("ride.banner.noRouteTo", { place: ride.approachName })
                  : ride.approachTarget === "route"
                    ? t("ride.banner.noRouteBack")
                    : t("ride.banner.noRouteStart")
              }
              sub={t("ride.banner.noRouteSub")}
            />
          ) : null}

          {basemapFailed ? (
            <Banner
              top={belowBar}
              right={bannerRight}
              compact={landscape}
              tone="ink"
              title={t("ride.banner.mapOffline")}
              sub={t("ride.banner.mapOfflineSub")}
            />
          ) : null}

          {permission === "denied" ? (
            <Banner
              top={belowBar}
              right={bannerRight}
              compact={landscape}
              tone="ink"
              title={t("ride.banner.locationOff")}
              sub={t("ride.banner.locationOffSub")}
            />
          ) : null}

          <SkipSquare skip={skip} top={belowBar} compact={landscape} onPress={() => setConfirming(true)} />

          {basemap !== "off" ? (
            <Text style={[styles.attribution, { bottom: lower + 12 + 48 + 4 }]}>{ATTRIBUTION}</Text>
          ) : null}

          {/* A question on screen has the room to itself: the map controls step aside (and leave the screen reader's tree). */}
          {modalOpen ? null : (
            <View
              testID="map-buttons"
              style={[styles.controls, landscape && styles.controlsSide, { bottom: lower + 12 }]}
            >
              {/* Side by side: the column of buttons stands on the panel and must not reach the bar at the top. */}
              <View style={styles.zoomRow}>
                <RoundButton label="−" name={t("ride.map.zoomOut")} onPress={() => zoomBy(-1)} />
                <RoundButton label="+" name={t("ride.map.zoomIn")} onPress={() => zoomBy(1)} />
              </View>
              <RoundButton icon="map-outline" name={t("ride.map.routeName")} onPress={overview} />
              {running ? (
                <RoundButton icon="locate" name={t("ride.map.meName")} onPress={() => setFollow(true)} />
              ) : null}
              <RoundButton
                icon="layers-outline"
                name={t("ride.map.basemapName", { basemap: BASEMAP_LABEL[basemap] })}
                onPress={nextBasemap}
              />
              <RoundButton
                icon="information-circle-outline"
                name={t("ride.map.keyName")}
                onPress={() => setLegend(true)}
              />
              <RoundButton
                icon={VOICE_ICON[voice]}
                name={t("ride.voice.tap", { name: voiceName(voice) })}
                onPress={changeVoice}
              />
              <RoundButton icon="speedometer-outline" name={t("ride.map.gaugesName")} onPress={() => setGauges(true)} />
            </View>
          )}

          {modalOpen ? null : (
            <InstrumentsOverlay
              top={gaugesTop}
              settings={gaugeSettings}
              values={instruments.values}
              calibrated={calibration !== null}
              onCalibrate={() => setGauges(true)}
              landscape={landscape}
            />
          )}

          {modalOpen ? null : (
            <View style={[styles.fuelChip, { bottom: lower + 12 }]} pointerEvents="box-none">
              {places.selected ? (
                <SelectedPlaceChip
                  place={places.selected}
                  progressM={nav?.progressM ?? 0}
                  onClear={() => places.select(null)}
                />
              ) : null}
              <View style={styles.chipRow}>
                <PlacesChip onPress={() => setPlacesOpen(true)} />
                <WeatherRow status={weather.status} outlook={weather.outlook} onPress={() => setWeatherOpen(true)} />
                <TrafficChip status={traffic.status} outlook={traffic.outlook} onPress={() => setTrafficOpen(true)} />
                {/* Sideways the map's own compass at its top right says where north is: one compass, not two. */}
                {running && nav && !landscape ? <CompassChip headingDeg={nav.bearingDeg} /> : null}
              </View>
            </View>
          )}
        </View>

        <View
          testID="hud"
          style={[
            styles.hud,
            landscape && styles.hudSide,
            landscape && { width: hudW, paddingLeft: 16 + sideL, paddingTop: topPad },
          ]}
          onLayout={(e) => setPanelH(Math.round(e.nativeEvent.layout.height))}
          // The panel takes a vertical drag before the buttons on it can swallow it, so a swipe works from anywhere on it.
          onStartShouldSetResponderCapture={(e) => {
            touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
            return false;
          }}
          onMoveShouldSetResponderCapture={(e) => {
            if (!running || !touch.current) return false;
            const dx = Math.abs(e.nativeEvent.pageX - touch.current.x);
            const dy = Math.abs(e.nativeEvent.pageY - touch.current.y);
            return dy > DRAG_DP && dy > dx;
          }}
          onResponderTerminationRequest={() => false}
          onResponderRelease={(e) => {
            if (!touch.current) return;
            const swipe = swipeOf(e.nativeEvent.pageX - touch.current.x, e.nativeEvent.pageY - touch.current.y);
            if (swipe) setControls(swipe === "up");
          }}
        >
          {landscape ? (
            <>
              {nav ? (
                <InstructionBar
                  nav={nav}
                  inline
                  corner={
                    warning
                      ? {
                          tone: warning.corner.severity === "hairpin" ? "rust" : "signal",
                          title: t(
                            warning.corner.severity === "hairpin" ? "ride.banner.hairpin" : "ride.banner.sharp",
                            {
                              direction: t(
                                warning.corner.direction === "left" ? "ride.dir.left" : "ride.dir.right",
                              ).toUpperCase(),
                            },
                          ),
                          sub: t("ride.banner.cornerSub", {
                            distance: formatDistance(next?.distanceM ?? warning.distanceM),
                            speed: warning.corner.advisoryKmh,
                          }),
                        }
                      : undefined
                  }
                />
              ) : null}
              <View style={styles.hudBodySide}>{hudBody}</View>
              {buttonRow}
            </>
          ) : (
            <>
              {hudBody}
              {buttonRow}
            </>
          )}
        </View>
      </View>

      {/* Sheets sit above everything, the bottom panel included, and scroll: their buttons are always reachable. */}
      {join && !choosingMore ? (
        <JoinCard
          options={join.options}
          top={belowBar}
          onGo={join.pick}
          onMore={() => setChoosingMore(true)}
          onCancel={stop}
        />
      ) : null}
      {join && choosingMore ? (
        <StartFromList
          choices={choices}
          current={join.options.nearest}
          top={belowBar}
          onClose={() => setChoosingMore(false)}
          onPick={(c) => {
            setChoosingMore(false);
            join.pick(c);
          }}
        />
      ) : null}
      {legend ? <LegendCard top={belowBar} onClose={() => setLegend(false)} /> : null}
      {crash.alert ? (
        <CrashAlert
          alert={crash.alert}
          contact={crashSettings.contact}
          position={fix ? { lat: fix.lat, lon: fix.lon, time: fix.time } : null}
          onOk={crash.ok}
        />
      ) : null}
      {placesOpen ? (
        <PlacesCard
          top={belowBar}
          kind={places.kind}
          status={places.status}
          results={places.results}
          progressM={nav?.progressM ?? 0}
          onKind={places.search}
          onSelect={(p) => {
            places.select(p);
            setPlacesOpen(false);
            setFollow(false);
            camera.current?.easeTo({ center: [p.poi.lon, p.poi.lat], zoom: 14.5, duration: 600 });
          }}
          onFuel={() => {
            setPlacesOpen(false);
            setFuelOpen(true);
          }}
          onClose={() => setPlacesOpen(false)}
        />
      ) : null}
      {weatherOpen ? (
        <WeatherCard
          top={belowBar}
          status={weather.status}
          outlook={weather.outlook}
          enabled={weather.enabled}
          onToggle={() => weather.setEnabled(!weather.enabled)}
          onRetry={weather.reload}
          onClose={() => setWeatherOpen(false)}
        />
      ) : null}
      {trafficOpen ? (
        <TrafficCard
          top={belowBar}
          status={traffic.status}
          outlook={traffic.outlook}
          enabled={traffic.enabled}
          budget={traffic.budget}
          countries={traffic.countries}
          onToggle={() => traffic.setEnabled(!traffic.enabled)}
          onRetry={traffic.reload}
          onClose={() => setTrafficOpen(false)}
        />
      ) : null}
      {fuelOpen ? (
        <FuelCard
          top={belowBar}
          status={fuel.status}
          stops={fuel.stops}
          progressM={nav?.progressM ?? 0}
          totalM={rb.totalM}
          rangeKm={fuel.rangeKm}
          onRange={fuel.setRangeKm}
          onRetry={fuel.reload}
          onClose={() => setFuelOpen(false)}
        />
      ) : null}
      {gauges ? (
        <InstrumentsCard
          top={belowBar}
          settings={gaugeSettings}
          onChange={setGaugeSettings}
          calibration={calibration}
          onCalibrate={calibrateNow}
          onResetPeaks={instruments.resetPeaks}
          onClose={() => setGauges(false)}
        />
      ) : null}
      {ending ? (
        <EndConfirm
          roadbookName={rb.roadbook.name}
          leaving={ending === "back"}
          top={belowBar}
          onKeep={() => setEnding(null)}
          onEnd={endNow}
        />
      ) : null}
      {confirming && skip.plan ? <SkipConfirm skip={skip} top={belowBar} onClose={() => setConfirming(false)} /> : null}
    </View>
  );
}

/** Until the panel is measured. */
const PANEL_GUESS = 300;

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.paper },
    layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    stage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    banner: { position: "absolute", left: 12, borderRadius: 4, padding: 16, minHeight: SKIP_SQUARE },
    bannerCompact: { padding: 8, minHeight: SKIP_SQUARE_SIDE, justifyContent: "center" },
    bannerTitleCompact: { fontSize: 22 },
    bannerSubCompact: { fontSize: 15 },
    bannerTitle: { fontFamily: fonts.bold, fontSize: 28 },
    bannerSub: { fontFamily: fonts.sans, fontSize: 18 },
    attribution: {
      position: "absolute",
      left: 12,
      color: colors.ink,
      backgroundColor: colors.paper,
      paddingHorizontal: 4,
      fontFamily: fonts.mono,
      fontSize: 10,
    },
    controls: { position: "absolute", right: 12, gap: 4, alignItems: "flex-end" },
    zoomRow: { flexDirection: "row", gap: 4 },
    round: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.rule,
      alignItems: "center",
      justifyContent: "center",
    },
    roundText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 18 },
    fuelChip: { position: "absolute", left: 12, gap: 8, alignItems: "flex-start" },
    chipRow: { flexDirection: "row", gap: 8 },
    hud: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.moss,
      padding: 16,
      paddingTop: 24,
      gap: 8,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    // Landscape: a column on the left, the full height, scrolling if it holds more than the screen shows.
    // The readouts take what the bar above and the buttons below leave: no scrolling in a panel (ADR 0045).
    hudBodySide: { flexGrow: 1, flexShrink: 1, justifyContent: "center", gap: 4 },
    hudSide: {
      right: undefined,
      top: 0,
      paddingBottom: 8,
      gap: 6,
      borderRadius: 0,
      justifyContent: "space-between",
    },
    controlsSide: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", width: 204 },
    // A wide, tall target inside the top of the panel, so nothing clips it; only the pill is drawn.
    grabber: {
      position: "absolute",
      zIndex: 1, // above the readouts that overlap its lower half, or they swallow the taps
      top: 0,
      // The middle of the panel, wide enough to hit: the corners are for the readouts (the fuel stop stands at the right).
      left: 112,
      right: 112,
      height: 48,
      alignItems: "center",
      justifyContent: "flex-start",
      paddingTop: 8,
    },
    grabberPill: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.mossMuted },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 },
    col: { alignItems: "flex-end" },
    // Sideways the fuel stop and the distance left share one row, so the column keeps its height.
    colSide: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
    colTexts: { alignItems: "flex-end" },
    speedBadge: { borderRadius: 8, paddingHorizontal: 8 },
    speedOver: { backgroundColor: colors.limitRed },
    speed: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 56, lineHeight: 64 },
    speedTextOver: { color: colors.white },
    speedSide: { fontSize: 46, lineHeight: 52 },
    bigSide: { fontSize: 24 },
    big: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 28 },
    unit: { color: colors.mossMuted, fontFamily: fonts.mono, fontSize: 12 },
    line: { color: colors.mossText, fontFamily: fonts.sans, fontSize: 16 },
    note: { color: colors.mossMuted, fontFamily: fonts.mono, fontSize: 11 },
    buttonSide: { height: 48 },
    button: { flex: 1, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 4 },
    // The column is narrower than speed, limit and distance side by side: the distance goes under them.
    rowWrap: { flexWrap: "wrap", rowGap: 4 },
    rowSlide: { paddingTop: 8 },
    buttonText: { fontFamily: fonts.bold, fontSize: 18 },
    start: { backgroundColor: colors.signal },
    stop: { backgroundColor: colors.rust },
    secondary: { backgroundColor: colors.moss2 },
  }),
);
