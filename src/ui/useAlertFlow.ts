import { useCallback, useEffect, useRef, useState } from "react";
import { Vibration } from "react-native";
import { COUNTDOWN_S, secondsLeft, TEST_COUNTDOWN_S } from "../core/crashAlert.ts";
import { t } from "../core/i18n/index.ts";
import { speak, stopSpeaking } from "./speech.ts";

export interface AlertState {
  /** A test of the alert sends nothing. */
  test: boolean;
  phase: "countdown" | "sent";
  startedAt: number;
  left: number;
  /** In the sent phase: the followers of a live ride were told. */
  live: boolean;
}

const TICK_MS = 250;
const SAY_EVERY_MS = 8000;
const VIBRATION = [0, 700, 350];

/**
 * The alert after a possible crash (spec crash-detection): a countdown with vibration and the voice asking if the rider is all
 * right; at the end `onSent` tells whoever can be told (it says whether followers were), and the alert stays until the rider
 * says they are fine. A test of it runs the same on ten seconds and tells no one.
 */
export function useAlertFlow(onSent: () => boolean, onCleared: () => void) {
  const [alert, setAlert] = useState<AlertState | null>(null);
  const sentRef = useRef(onSent);
  sentRef.current = onSent;
  const clearedRef = useRef(onCleared);
  clearedRef.current = onCleared;
  const timers = useRef<{ tick?: ReturnType<typeof setInterval>; say?: ReturnType<typeof setInterval> }>({});

  const quiet = useCallback(() => {
    if (timers.current.tick) clearInterval(timers.current.tick);
    if (timers.current.say) clearInterval(timers.current.say);
    timers.current = {};
    Vibration.cancel();
    stopSpeaking();
  }, []);
  useEffect(() => quiet, [quiet]);

  const start = useCallback(
    (test = false) => {
      quiet();
      const startedAt = Date.now();
      const total = test ? TEST_COUNTDOWN_S : COUNTDOWN_S;
      setAlert({ test, phase: "countdown", startedAt, left: total, live: false });
      Vibration.vibrate(VIBRATION, true);
      speak(t("safety.alert.say"));
      timers.current.say = setInterval(() => speak(t("safety.alert.say")), SAY_EVERY_MS);
      timers.current.tick = setInterval(() => {
        const left = secondsLeft(startedAt, Date.now(), total);
        if (left > 0) {
          setAlert((a) => (a && a.phase === "countdown" ? { ...a, left } : a));
          return;
        }
        if (timers.current.tick) clearInterval(timers.current.tick);
        if (timers.current.say) clearInterval(timers.current.say);
        timers.current = {};
        const live = test ? false : sentRef.current();
        setAlert((a) => (a ? { ...a, phase: "sent", left: 0, live } : a));
        if (!test) speak(t("safety.say.sent"));
        else Vibration.cancel();
      }, TICK_MS);
    },
    [quiet],
  );

  /** The rider is all right (or the test is over): everything stops. */
  const ok = useCallback(() => {
    quiet();
    setAlert((a) => {
      if (a && !a.test) clearedRef.current();
      return null;
    });
  }, [quiet]);

  return { alert, start, ok };
}
