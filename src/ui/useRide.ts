import { t } from "../core/i18n/index.ts";
import * as Location from "expo-location";
import { startRideService, stopRideService } from "./background.ts";
import type { RideMeta } from "../core/recording.ts";
import { RideRecorder } from "./recorder.ts";
import { speak, stopSpeaking } from "./speech.ts";
import { DEFAULT_VOICE, speaks, type VoiceKind, type VoiceMode } from "../core/voice.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Vibration } from "react-native";
import { backOnRoute, needsApproach, withApproach } from "../core/approach.ts";
import { haversineM } from "../core/geo.ts";
import type { MotionReading } from "../core/instruments.ts";
import { replayFixAt, type ReplayPhase } from "../core/replay.ts";
import {
  joinOptions,
  planSkip,
  START_HERE_M,
  type JoinOptions,
  type SkipPlan,
  type StartChoice,
} from "../core/skip.ts";
import { pointAt } from "../core/track.ts";
import { createNavigator, type CornerWarning, type NavState, type ZoneWarning } from "../core/navigator.ts";
import { DEMO_SPEED_MPS, demoStartM, simulatedFix } from "../core/simulate.ts";
import type { Fix, LatLon, PreparedRoadbook } from "../core/types.ts";
import { routeToStart } from "../services/valhalla.ts";
import { DANGER_ZONES } from "./settings.ts";

export type Permission = "unknown" | "granted" | "denied";
/** `gps` follows the phone, `demo` rides the line by itself (spec ride-navigation). */
export type RideMode = "idle" | "gps" | "demo";
/** Before the first fix is followed: finding the rider, asking where to join, then the way there. */
export type Prep = "idle" | "locating" | "choosing" | "routing" | "ready";

/** Skipping the next route point during the ride (spec live-corrections). */
export interface SkipState {
  /** What a skip would do now; null when none is on offer (not riding with GPS, or no point to go to). */
  plan: SkipPlan | null;
  /** The skip is allowed now: stopped or slow, and no route being found. */
  canSkip: boolean;
  /** A route to the target is being found. */
  busy: boolean;
  confirm: () => void;
  /** The last skip, for the Undo; cleared by the screen after 15 seconds. */
  last: { skipped: string; target: string } | null;
  undo: () => void;
  forgetLast: () => void;
}

/** A rider away from the roadbook is asked where to join it (spec ride-control). */
export interface JoinState {
  options: JoinOptions;
  /** Go to a route point: the way there is routed and what lies before it is dropped. Null: go to the start. */
  pick: (point: StartChoice | null) => void;
}

export interface RideState {
  permission: Permission;
  prep: Prep;
  /** The roadbook as ridden: with the approach to the start in front of it when there is one. */
  ride: PreparedRoadbook;
  nav: NavState | null;
  speedMps: number | null;
  /** The last position, for the instruments (spec instruments). */
  fix: Fix | null;
  /** The warning on screen: raised on a fix, cleared once the corner is passed. */
  warning: CornerWarning | null;
  /** The danger zone on screen: raised on a fix, cleared once passed. */
  zone: ZoneWarning | null;
  /** The demo reached the finish. */
  finished: boolean;
  skip: SkipState;
  join: JoinState | null;
  /** The name of the point a route is being found to, while it is; null for the start of the roadbook. */
  routingTo: string | null;
}

interface Live {
  nav: NavState | null;
  /** The ride `nav` was computed on: a skip changes the ride before the next fix replaces `nav`. */
  rideOf: PreparedRoadbook | null;
  speedMps: number | null;
  fix: Fix | null;
  warning: CornerWarning | null;
  zone: ZoneWarning | null;
  finished: boolean;
}

const NO_LIVE: Live = {
  nav: null,
  rideOf: null,
  speedMps: null,
  fix: null,
  warning: null,
  zone: null,
  finished: false,
};
/** One vibration per going over, at most this often (spec speed-limits). */
const VIBRATE_EVERY_MS = 10_000;
const LOCATE_TIMEOUT_MS = 20_000;
const ZONE_PASSED_M = 30;
/** Back to the route: ask for a road route at most this often, and only after moving this far (ADR 0012). */
const REROUTE_EVERY_MS = 30_000;
const REROUTE_MIN_MOVE_M = 50;

const timeout = <T>(ms: number): Promise<T | null> => new Promise((resolve) => setTimeout(() => resolve(null), ms));

/** Fixes in (GPS or demo), navigation state out; speaks each warning once. Foreground only. */
export function useRide(
  rb: PreparedRoadbook,
  mode: RideMode,
  options: {
    paused?: boolean;
    replay?: ReplayPhase[] | null;
    start?: StartChoice | null;
    ask?: boolean;
    voice?: VoiceMode;
    /** A ride that ends is saved as it is; told here once it is (spec ride-recording). */
    onSaved?: (meta: RideMeta) => void;
    /** Fed every position of a ride on the phone's GPS, to share it live (spec live-share). */
    liveShare?: { current: { add(fix: Fix): void } | null };
    /** The lean and G readings of the moment, written to the track (spec ride-recording). */
    motion?: { current: MotionReading | null };
  } = {},
): RideState {
  const {
    paused = false,
    replay = null,
    start = null,
    ask = true,
    voice = DEFAULT_VOICE,
    onSaved,
    liveShare,
    motion,
  } = options;
  const savedRef = useRef(onSaved);
  savedRef.current = onSaved;
  // The mode of the moment, for callbacks made before it changed.
  const voiceNow = useRef(voice);
  voiceNow.current = voice;
  /** Say it if the mode says that kind of thing (spec voice-guidance); a message the mode keeps quiet is dropped. */
  const say = (kind: VoiceKind, text: string) => {
    if (!speaks(voiceNow.current, kind)) return;
    stopSpeaking();
    speak(text);
  };
  const [routingTo, setRoutingTo] = useState<string | null>(null);
  const [joinState, setJoinState] = useState<{ pos: LatLon; options: JoinOptions } | null>(null);
  const [permission, setPermission] = useState<Permission>("unknown");
  const [prep, setPrep] = useState<Prep>("idle");
  const [ride, setRide] = useState(rb);
  const [live, setLive] = useState<Live>(NO_LIVE);
  const recorder = useRef<RideRecorder | null>(null);
  // One recording from Start to End on the phone's GPS (a pause does not end it); a demo and a scripted ride are not recorded.
  const recording = mode === "gps" && !replay;
  useEffect(() => {
    if (!recording) return;
    const r = new RideRecorder(rb.roadbook, Date.now());
    recorder.current = r;
    return () => {
      recorder.current = null;
      void r.finish().then((meta) => meta && savedRef.current?.(meta));
    };
  }, [recording]);
  const navigator = useMemo(() => createNavigator(ride, { dangerZones: DANGER_ZONES }), [ride, mode]);
  const shown = useRef<CornerWarning | null>(null);
  const shownZone = useRef<ZoneWarning | null>(null);
  const wasOver = useRef(false);
  const lastVibration = useRef<number | null>(null);
  const lastReroute = useRef<{ time: number; pos: LatLon } | null>(null);
  const rerouting = useRef(false);
  const skipping = useRef(false);
  const lastFix = useRef<Fix | null>(null);
  /** Changes whenever a skip or an undo replaces the ride, so a route that was asked for before is dropped. */
  const epoch = useRef(0);
  const [history, setHistory] = useState<PreparedRoadbook[]>([]);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SkipState["last"]>(null);
  /** Changes when a ride ends, so a route that arrives late is dropped. */
  const runId = useRef(0);
  const currentRun = runId.current;

  /** Forget what was on screen for the ride that ends; the last state stays until the next fix replaces it. */
  const quiet = () => {
    stopSpeaking();
    shown.current = null;
    shownZone.current = null;
    wasOver.current = false;
    lastVibration.current = null;
  };

  // The ride is over: the screen goes back to the overview. A new route inside a ride does not blank it.
  useEffect(() => {
    if (mode === "idle") setLive(NO_LIVE);
  }, [mode]);

  const apply = (fix: Fix) => {
    lastFix.current = fix;
    const nav = navigator.update(fix);
    // Back on the road of the roadbook before the point the way back led to: ride the roadbook again from here.
    if (mode === "gps" && nav.offRoute && backOnRoute(rb, ride, [fix.lat, fix.lon])) {
      epoch.current++;
      setRide(rb);
      return;
    }
    recorder.current?.add(fix, nav.remainingM, motion?.current ?? null);
    if (mode === "gps" && !replay) liveShare?.current?.add(fix);
    if (nav.warning) {
      shown.current = nav.warning;
      say("corner", nav.warning.text);
    } else if (shown.current && nav.progressM > shown.current.corner.endM) {
      shown.current = null;
    }
    if (nav.zoneWarning) {
      shownZone.current = nav.zoneWarning;
      say("zone", nav.zoneWarning.text);
    } else if (shownZone.current && nav.progressM > shownZone.current.endM + ZONE_PASSED_M) {
      shownZone.current = null;
    }
    if (nav.statusWarning) say("status", nav.statusWarning.text);
    if (nav.junctionWarning) say("junction", nav.junctionWarning.text);
    if (nav.turnWarning) say("turn", nav.turnWarning.text);
    if (
      nav.over &&
      !wasOver.current &&
      (lastVibration.current === null || fix.time - lastVibration.current >= VIBRATE_EVERY_MS)
    ) {
      Vibration.vibrate(250);
      lastVibration.current = fix.time;
    }
    wasOver.current = nav.over;
    setLive({
      nav,
      rideOf: ride,
      speedMps: fix.speedMps,
      fix,
      warning: shown.current,
      zone: shownZone.current,
      finished: false,
    });
    if (mode === "gps" && nav.offRoute && nav.rejoin) maybeRejoin(fix, nav.rejoin.atM);
  };

  /** Off route: one road route back to the line, now and then; the direction guidance covers the rest (ADR 0012). */
  const maybeRejoin = (fix: Fix, rejoinAtM: number) => {
    const here: LatLon = [fix.lat, fix.lon];
    const last = lastReroute.current;
    if (rerouting.current) return;
    if (last && (fix.time - last.time < REROUTE_EVERY_MS || haversineM(last.pos, here) < REROUTE_MIN_MOVE_M)) return;
    lastReroute.current = { time: fix.time, pos: here };
    rerouting.current = true;
    const epochAt = epoch.current;
    // The target is on the whole roadbook, whatever the current approach put in front of it.
    const joinM = ride.joinM + Math.max(0, rejoinAtM - ride.approachM);
    const target = pointAt(rb.roadbook.line, rb.cumulativeM, joinM);
    void routeToStart(here, target).then((route) => {
      rerouting.current = false;
      if (runId.current !== currentRun || epoch.current !== epochAt) return;
      setRide(route ? withApproach(rb, route, false, joinM, "route") : withApproach(rb, [here], true, joinM, "route"));
    });
  };

  const plan =
    mode === "gps" && prep === "ready" && live.nav && live.rideOf === ride ? planSkip(ride, live.nav.progressM) : null;

  /** Skip the next route point: a route from here to the one after it, ridden with the rest of the roadbook. */
  const confirm = () => {
    const fix = lastFix.current;
    if (!plan || !fix || skipping.current) return;
    skipping.current = true;
    setBusy(true);
    const epochAt = ++epoch.current;
    const here: LatLon = [fix.lat, fix.lon];
    const target = pointAt(rb.roadbook.line, rb.cumulativeM, plan.joinM);
    const previous = ride;
    void routeToStart(here, target).then((route) => {
      skipping.current = false;
      setBusy(false);
      if (runId.current !== currentRun || epoch.current !== epochAt) return;
      setHistory((h) => [...h, previous]);
      setRide(
        route
          ? withApproach(rb, route, false, plan.joinM, "route", plan.target.name)
          : withApproach(rb, [here], true, plan.joinM, "route", plan.target.name),
      );
      setLast({ skipped: plan.skipped.name, target: plan.target.name });
      say("skip", t("ride.skip.say", { skipped: plan.skipped.name, target: plan.target.name }));
    });
  };

  /** Back to the ride as it was before the last skip; needs no network. */
  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    epoch.current++;
    setHistory((h) => h.slice(0, -1));
    setRide(previous);
    setLast(null);
  };

  /** The way to the start of the roadbook, from `pos`: routed, or a straight line when there is no route. */
  const toStart = async (pos: LatLon, run: number) => {
    setRoutingTo(null);
    setPrep("routing");
    const route = await routeToStart(pos, rb.roadbook.line[0]!);
    if (runId.current !== run) return;
    setRide(route ? withApproach(rb, route, false) : withApproach(rb, [pos], true));
    setPrep("ready");
  };

  /** To a chosen route point (spec ride-control): everything before it is dropped, the rider is sent to it. */
  const goTo = async (pos: LatLon | null, point: StartChoice, run: number) => {
    const target = pointAt(rb.roadbook.line, rb.cumulativeM, point.atM);
    if (!pos || haversineM(pos, target) < START_HERE_M) {
      setRide(withApproach(rb, pos ? [pos] : [], true, point.atM, "route", point.name));
      return setPrep("ready");
    }
    setRoutingTo(point.name);
    setPrep("routing");
    const route = await routeToStart(pos, target);
    if (runId.current !== run) return;
    setRide(
      route
        ? withApproach(rb, route, false, point.atM, "route", point.name)
        : withApproach(rb, [pos], true, point.atM, "route", point.name),
    );
    setPrep("ready");
  };

  // GPS 1/2: permission, where the rider is, and, away from the roadbook, where to join it.
  useEffect(() => {
    if (mode !== "gps") return;
    const run = runId.current;
    const gone = () => runId.current !== run;
    (async () => {
      // A scripted GPS (development builds, ADR 0014) needs no permission and gives its first position at once.
      if (!replay) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (gone()) return;
        if (status !== "granted") return setPermission("denied");
      }
      setPermission("granted");
      setPrep("locating");
      const here = replay
        ? null
        : await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
            timeout<Location.LocationObject>(LOCATE_TIMEOUT_MS),
          ]);
      if (gone()) return;
      // Where the rider is now is the first position of a shared ride, before the GPS has sent its first fix.
      if (here) {
        liveShare?.current?.add({
          lat: here.coords.latitude,
          lon: here.coords.longitude,
          speedMps: here.coords.speed ?? null,
          headingDeg: here.coords.heading,
          accuracyM: here.coords.accuracy ?? null,
          time: here.timestamp,
        });
      }
      const pos: LatLon | null = replay ? replay[0]!.at : here ? [here.coords.latitude, here.coords.longitude] : null;
      if (start) return goTo(pos, start, run);
      if (!pos || !needsApproach(rb, pos)) {
        setRide(rb);
        return setPrep("ready");
      }
      // Away from the roadbook: ask where to join, with the nearest next point as the answer (ADR 0016).
      const options = ask ? joinOptions(rb, pos) : null;
      if (options) {
        setJoinState({ pos, options });
        return setPrep("choosing");
      }
      return toStart(pos, run);
    })();
    return () => {
      runId.current++;
      lastReroute.current = null;
      rerouting.current = false;
      skipping.current = false;
      setJoinState(null);
      setHistory([]);
      setBusy(false);
      setLast(null);
      setPermission("unknown");
      setPrep("idle");
      setRide(rb);
    };
  }, [mode, rb, replay, start, ask]);

  // GPS 2/2: follow the phone on the ride that was prepared.
  useEffect(() => {
    // Paused: the GPS is let go and the ride kept as it is (ADR 0015); resuming subscribes again.
    if (mode !== "gps" || prep !== "ready" || paused) return;
    if (replay) {
      const base = Date.now();
      let n = 0;
      const tick = () => {
        apply(replayFixAt(replay, n, base + n * 1000));
        n++;
      };
      tick();
      const timer = setInterval(tick, 1000);
      return () => {
        clearInterval(timer);
        quiet();
      };
    }
    let sub: Location.LocationSubscription | undefined;
    let cancelled = false;
    (async () => {
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (loc) => {
          const speed = loc.coords.speed !== null && loc.coords.speed >= 0 ? loc.coords.speed : null;
          apply({
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
            speedMps: speed,
            headingDeg: loc.coords.heading,
            altitudeM: loc.coords.altitude,
            accuracyM: loc.coords.accuracy,
            time: loc.timestamp,
          });
        },
      );
      if (cancelled) sub.remove();
      else void startRideService(rb.roadbook.name);
    })();
    return () => {
      cancelled = true;
      sub?.remove();
      void stopRideService();
      quiet();
    };
  }, [navigator, mode, prep, replay, paused]);

  // A demo starts from its beginning; pausing and resuming carry on from where it was.
  const demoProgress = useRef(0);
  const demoTime = useRef(0);
  useEffect(() => {
    if (mode !== "demo") return;
    demoProgress.current = demoStartM(rb);
    demoTime.current = 0;
    setPrep("ready");
    return () => {
      quiet();
      setPrep("idle");
    };
  }, [mode, rb]);

  useEffect(() => {
    if (mode !== "demo" || paused) return;
    const tick = () => {
      if (demoProgress.current >= rb.totalM) {
        clearInterval(timer);
        return setLive((l) => ({ ...l, finished: true }));
      }
      apply(simulatedFix(rb, demoProgress.current, DEMO_SPEED_MPS, demoTime.current));
      demoProgress.current += DEMO_SPEED_MPS;
      demoTime.current += 1000;
    };
    const timer = setInterval(tick, 1000);
    // The first position shows at once; a resume waits its second, so toggling Pause never nudges the demo.
    if (demoTime.current === 0) tick();
    return () => clearInterval(timer);
  }, [navigator, mode, rb, paused]);

  const skip: SkipState = {
    plan,
    canSkip: plan !== null && !busy,
    busy,
    confirm,
    last,
    undo,
    forgetLast: () => setLast(null),
  };
  const join: JoinState | null =
    prep === "choosing" && joinState
      ? {
          options: joinState.options,
          pick: (point) => {
            const { pos } = joinState;
            setJoinState(null);
            const run = runId.current;
            if (point === null || point.atM <= 1) void toStart(pos, run);
            else void goTo(pos, point, run);
          },
        }
      : null;
  return { permission, prep, ride, ...live, skip, join, routingTo };
}
