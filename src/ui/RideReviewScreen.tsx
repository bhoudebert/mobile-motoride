import { TOP_INSET } from "./insets.ts";
import { Camera, GeoJSONSource, Layer, Map } from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Feature, Point } from "geojson";
import { boundsOf, formatDistance } from "../core/format.ts";
import { formatDateTime, formatNumber, t } from "../core/i18n/index.ts";
import { gText, leanText } from "../core/instruments.ts";
import { durationText, type RideMeta, type TrackPoint } from "../core/recording.ts";
import {
  DEFAULT_REPLAY_SPEED,
  marksCollection,
  marksOf,
  nextReplaySpeed,
  profile,
  replayAt,
  reviewRide,
  SPEED_STEPS_KMH,
  timeline,
  trackBounds,
  traceCollection,
  type Mark,
  type Sample,
} from "../core/review.ts";
import { basemapStyle, ATTRIBUTION } from "./mapStyle.ts";
import { readRidePoints } from "./ridesStore.ts";
import { BackButton } from "./BackButton.tsx";
import { colors, fonts, radii, themed } from "./theme.ts";
import { useLanguage } from "./languageSetting.ts";

const TICK_MS = 100;
const PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

const dateText = (ms: number) =>
  formatDateTime(ms, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const clockText = (ms: number) => formatDateTime(ms, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const kmhText = (kmh: number) => t("review.kmh", { kmh: Math.round(kmh) });
const metresText = (m: number) => t("review.m", { m: Math.round(m) });
const gValue = (g: number) =>
  t("review.g", { g: formatNumber(g, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
const leanValue = (m: Mark) => leanText(m.side === "left" ? m.value : -m.value);

/**
 * The review of a recorded ride (spec ride-review, ADR 0034): its track in colours of speed on the map, its figures, its
 * profiles and a replay, all from the GPX the phone kept.
 */
export function RideReviewScreen({ ride, onBack }: { ride: RideMeta; onBack: () => void }) {
  useLanguage();
  const [points, setPoints] = useState<TrackPoint[] | null | "failed">(null);
  useEffect(() => {
    let live = true;
    readRidePoints(ride.id).then((p) => live && setPoints(p ?? "failed"));
    return () => {
      live = false;
    };
  }, [ride.id]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <BackButton onPress={onBack} label={t("review.back")} style={styles.back} />
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {ride.roadbookName}
          </Text>
          <Text style={styles.sub}>{dateText(ride.startedAt)}</Text>
        </View>
      </View>
      {points === null ? (
        <Text style={styles.message}>{t("review.loading")}</Text>
      ) : points === "failed" ? (
        <Text style={styles.message} accessibilityRole="alert">
          {t("review.unreadable")}
        </Text>
      ) : points.length < 2 ? (
        <Text style={styles.message} accessibilityRole="alert">
          {t("review.tooShort")}
        </Text>
      ) : (
        <Review points={points} />
      )}
    </View>
  );
}

function Review({ points }: { points: TrackPoint[] }) {
  const review = useMemo(() => reviewRide(points), [points]);
  const tl = useMemo(() => timeline(points), [points]);
  const trace = useMemo(() => traceCollection(points), [points]);
  const marks = useMemo(() => marksOf(review), [review]);
  const markPoints = useMemo(() => marksCollection(points, marks), [points, marks]);
  const samples = useMemo(() => profile(points, 60), [points]);
  const bounds = useMemo(() => boundsOf(trackBounds(points)), [points]);

  const [offset, setOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(DEFAULT_REPLAY_SPEED);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const atEnd = offset >= tl.totalMs;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setOffset((o) => Math.min(tl.totalMs, o + TICK_MS * speedRef.current));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, tl.totalMs]);
  useEffect(() => {
    if (playing && atEnd) setPlaying(false);
  }, [playing, atEnd]);

  const now = replayAt(points, tl, offset)!;
  const cursor: Feature<Point> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [now.lon, now.lat] },
  };
  const play = () => {
    if (playing) return setPlaying(false);
    if (atEnd) setOffset(0);
    setPlaying(true);
  };
  const jumpTo = (m: Mark) => {
    setPlaying(false);
    setOffset(tl.at[m.index] ?? 0);
  };

  return (
    <>
      <View style={styles.mapBox}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={basemapStyle("light")}
          attribution={false}
          logo={false}
          testID="review-map"
        >
          <Camera initialViewState={{ bounds, padding: PADDING }} />
          <GeoJSONSource id="trace" data={trace}>
            <Layer
              id="trace-casing"
              type="line"
              paint={{ "line-color": colors.paper, "line-width": 9 }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
            <Layer
              id="trace"
              type="line"
              paint={{
                "line-color": [
                  "match",
                  ["get", "speed"],
                  0,
                  colors.route,
                  1,
                  colors.signal,
                  2,
                  colors.hazard,
                  colors.limitRed,
                ],
                "line-width": 5,
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </GeoJSONSource>
          {marks.length > 0 ? (
            <GeoJSONSource id="marks" data={markPoints}>
              <Layer
                id="marks"
                type="circle"
                paint={{
                  "circle-radius": 8,
                  "circle-color": ["match", ["get", "kind"], "lean", colors.signal, colors.hazard],
                  "circle-stroke-width": 3,
                  "circle-stroke-color": colors.paper,
                }}
              />
            </GeoJSONSource>
          ) : null}
          <GeoJSONSource id="cursor" data={cursor}>
            <Layer
              id="cursor"
              type="circle"
              paint={{
                "circle-radius": 9,
                "circle-color": colors.white,
                "circle-stroke-width": 4,
                "circle-stroke-color": colors.moss,
              }}
            />
          </GeoJSONSource>
        </Map>
        <Text style={styles.attribution}>{ATTRIBUTION}</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.card}>
          <Text style={styles.section}>{t("review.replay")}</Text>
          <Text style={styles.readout} testID="review-readout">
            {readout(now)}
          </Text>
          <SeekBar progress={now.progress} onSeek={(p) => setOffset(p * tl.totalMs)} />
          <View style={styles.controls}>
            <Pressable
              style={[styles.control, styles.controlMain]}
              onPress={play}
              accessibilityRole="button"
              accessibilityLabel={playing ? t("review.pause") : t("review.play")}
            >
              <Text style={styles.controlMainText}>{playing ? t("review.pause") : t("review.play")}</Text>
            </Pressable>
            <Pressable
              style={styles.control}
              onPress={() => setSpeed(nextReplaySpeed(speed))}
              accessibilityRole="button"
              accessibilityLabel={t("review.speed", { n: speed })}
            >
              <Text style={styles.controlText}>{t("review.speed.button", { n: speed })}</Text>
            </Pressable>
          </View>
        </View>

        {marks.length > 0 ? (
          <View style={styles.chips}>
            {marks.map((m) => (
              <Pressable
                key={m.kind}
                style={styles.chip}
                onPress={() => jumpTo(m)}
                accessibilityRole="button"
                accessibilityLabel={`${markText(m)}. ${t("review.mark.hint")}`}
              >
                <View style={[styles.dot, { backgroundColor: m.kind === "lean" ? colors.signal : colors.hazard }]} />
                <Text style={styles.chipText}>{markText(m)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.legend} accessibilityLabel={t("review.legend.title")}>
          <Text style={styles.legendTitle}>{t("review.legend.title")}</Text>
          {[0, 1, 2, 3].map((cls) => (
            <View key={cls} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: SPEED_COLOURS()[cls] }]} />
              <Text style={styles.legendText}>{legendText(cls)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.grid}>
          <Stat label={t("review.stat.distance")} value={formatDistance(review.distanceM)} />
          <Stat label={t("review.stat.duration")} value={durationText(review.durationMs)} />
          <Stat label={t("review.stat.moving")} value={durationText(review.movingMs)} />
          {review.avgKmh !== null ? <Stat label={t("review.stat.avg")} value={kmhText(review.avgKmh)} /> : null}
          <Stat label={t("review.stat.max")} value={kmhText(review.maxKmh)} />
          {review.climbM !== null ? <Stat label={t("review.stat.climb")} value={metresText(review.climbM)} /> : null}
          {review.descentM !== null ? (
            <Stat label={t("review.stat.descent")} value={metresText(review.descentM)} />
          ) : null}
          {review.peakLeft || review.peakRight ? (
            <Stat
              label={t("review.stat.lean")}
              value={t("review.stat.leanBoth", {
                left: leanText(review.peakLeft?.value ?? 0),
                right: leanText(-(review.peakRight?.value ?? 0)),
              })}
            />
          ) : null}
          {review.maxLateralG !== null ? (
            <Stat label={t("review.stat.lateral")} value={gText(review.maxLateralG)} />
          ) : null}
          {review.brake ? <Stat label={t("review.stat.brake")} value={gText(review.brake.value)} /> : null}
          {review.accel ? <Stat label={t("review.stat.accel")} value={gText(review.accel.value)} /> : null}
        </View>

        <Profile
          title={t("review.profile.speed")}
          values={samples.map((s) => s.kmh)}
          marker={markerIndex(samples, now.index)}
          colorOf={(v) => SPEED_COLOURS()[SPEED_STEPS_KMH.filter((s) => v >= s).length]!}
        />
        {review.minAltitudeM !== null ? (
          <Profile
            title={t("review.profile.altitude")}
            values={samples.map((s) => s.altitudeM ?? review.minAltitudeM ?? 0)}
            marker={markerIndex(samples, now.index)}
            colorOf={() => colors.accent}
            from={review.minAltitudeM}
          />
        ) : null}
      </ScrollView>
    </>
  );
}

/** The colours of the four speed classes, as the map draws them. */
const SPEED_COLOURS = (): string[] => [colors.route, colors.signal, colors.hazard, colors.limitRed];

const legendText = (cls: number): string => {
  const [a, b, c] = SPEED_STEPS_KMH;
  return t(`review.legend.${cls}` as "review.legend.0", {
    from: cls === 1 ? a : cls === 2 ? b : c,
    to: cls === 0 ? a : cls === 1 ? b : c,
  });
};

const markText = (m: Mark): string =>
  m.kind === "lean" ? t("review.mark.lean", { lean: leanValue(m) }) : t("review.mark.brake", { g: gValue(m.value) });

/** The sample the replay is at, for the mark on the profiles. */
const markerIndex = (samples: Sample[], pointIndex: number): number => {
  let k = 0;
  while (k < samples.length - 1 && samples[k + 1]!.index <= pointIndex) k++;
  return k;
};

function readout(now: NonNullable<ReturnType<typeof replayAt>>): string {
  const parts = [clockText(now.time), kmhText(now.kmh)];
  if (now.altitudeM !== null) parts.push(metresText(now.altitudeM));
  if (now.leanDeg !== null) parts.push(t("review.at.lean", { lean: leanText(now.leanDeg) }));
  if (now.brakingG !== null && Math.abs(now.brakingG) >= 0.05)
    parts.push(
      now.brakingG > 0
        ? t("review.at.brake", { g: gText(now.brakingG) })
        : t("review.at.accel", { g: gText(-now.brakingG) }),
    );
  return parts.join(" · ");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={t("review.stat.aria", { label, value })}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

/** Bars over the distance: height is the value, the one under the replay is drawn full strength. */
function Profile({
  title,
  values,
  marker,
  colorOf,
  from = 0,
}: {
  title: string;
  values: number[];
  marker: number;
  colorOf: (v: number) => string;
  from?: number;
}) {
  const max = Math.max(...values, from + 1);
  return (
    <View style={styles.profile} accessible accessibilityLabel={title}>
      <Text style={styles.section}>{title}</Text>
      <View style={styles.bars}>
        {values.map((v, i) => (
          <View key={i} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                {
                  height: `${Math.max(4, ((v - from) / (max - from)) * 100)}%`,
                  backgroundColor: colorOf(v),
                  opacity: i === marker ? 1 : 0.55,
                },
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/** A bar to jump anywhere in the replay by touching or dragging it; adjustable for a screen reader. */
function SeekBar({ progress, onSeek }: { progress: number; onSeek: (p: number) => void }) {
  const width = useRef(1);
  const at = (x: number) => onSeek(Math.max(0, Math.min(1, x / width.current)));
  return (
    <View
      style={styles.seek}
      onLayout={(e: LayoutChangeEvent) => {
        width.current = Math.max(1, e.nativeEvent.layout.width);
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => at(e.nativeEvent.locationX)}
      onResponderMove={(e) => at(e.nativeEvent.locationX)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t("review.seek")}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) =>
        onSeek(Math.max(0, Math.min(1, progress + (e.nativeEvent.actionName === "increment" ? 0.05 : -0.05))))
      }
      testID="review-seek"
    >
      <View style={styles.seekTrack}>
        <View style={[styles.seekFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={[styles.seekThumb, { left: `${progress * 100}%` }]} />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.paper, paddingTop: TOP_INSET + 8 },
    header: { flexDirection: "row", alignItems: "center", paddingRight: 16 },
    back: { minHeight: 48, minWidth: 48, paddingHorizontal: 16, justifyContent: "center" },
    headerText: { flex: 1 },
    title: { color: colors.accent, fontFamily: fonts.bold, fontSize: 20 },
    sub: { color: colors.ink2, fontFamily: fonts.mono, fontSize: 12 },
    message: { color: colors.ink, fontFamily: fonts.sans, fontSize: 16, padding: 24 },
    mapBox: { height: "38%", backgroundColor: colors.paper2 },
    attribution: {
      position: "absolute",
      left: 8,
      bottom: 6,
      color: colors.ink,
      backgroundColor: colors.paper,
      fontFamily: fonts.mono,
      fontSize: 10,
      paddingHorizontal: 4,
      opacity: 0.85,
    },
    body: { flex: 1 },
    bodyContent: { padding: 16, gap: 14, paddingBottom: 32 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: colors.rule,
      padding: 14,
      gap: 10,
    },
    section: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    readout: { color: colors.ink, fontFamily: fonts.mono, fontSize: 13 },
    controls: { flexDirection: "row", gap: 10 },
    control: {
      minHeight: 48,
      minWidth: 72,
      paddingHorizontal: 16,
      borderRadius: radii.card,
      backgroundColor: colors.moss2,
      alignItems: "center",
      justifyContent: "center",
    },
    controlMain: { flex: 1 },
    controlMainText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 17 },
    controlText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 16 },
    seek: { height: 48, justifyContent: "center" },
    seekTrack: { height: 6, borderRadius: 3, backgroundColor: colors.rule, overflow: "hidden" },
    seekFill: { height: 6, backgroundColor: colors.accent },
    seekThumb: {
      position: "absolute",
      width: 22,
      height: 22,
      marginLeft: -11,
      borderRadius: 11,
      backgroundColor: colors.accent,
      borderWidth: 3,
      borderColor: colors.card,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.rule,
    },
    chipText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
    dot: { width: 12, height: 12, borderRadius: 6 },
    legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
    legendTitle: { color: colors.ink2, fontFamily: fonts.mono, fontSize: 12 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    swatch: { width: 18, height: 8, borderRadius: 4 },
    legendText: { color: colors.ink2, fontFamily: fonts.mono, fontSize: 12 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    stat: {
      minWidth: "47%",
      flexGrow: 1,
      backgroundColor: colors.card,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: colors.rule,
      padding: 12,
      gap: 2,
    },
    statLabel: { color: colors.ink2, fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase" },
    statValue: { color: colors.ink, fontFamily: fonts.bold, fontSize: 20 },
    profile: { gap: 6 },
    bars: { height: 90, flexDirection: "row", alignItems: "flex-end", gap: 1 },
    barSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
    bar: { width: "100%", borderRadius: 1 },
  }),
);
