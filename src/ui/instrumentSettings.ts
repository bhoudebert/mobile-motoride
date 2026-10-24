import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  DEFAULT_INSTRUMENTS,
  parseInstruments,
  type Calibration,
  type InstrumentSettings,
} from "../core/instruments.ts";

const SETTINGS_KEY = "instruments";
const CALIBRATION_KEY = "instruments-calibration";

/** The switches of the gauges: the default until the stored ones are read, kept when they change (spec instruments). */
export function useInstrumentSettings(): [InstrumentSettings, (next: InstrumentSettings) => void] {
  const [settings, setSettings] = useState<InstrumentSettings>(DEFAULT_INSTRUMENTS);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((stored) => {
        if (live && stored) setSettings(parseInstruments(stored));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const change = (next: InstrumentSettings) => {
    setSettings(next);
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  };
  return [settings, change];
}

const isVec = (v: unknown): boolean =>
  typeof v === "object" &&
  v !== null &&
  ["x", "y", "z"].every((k) => Number.isFinite((v as Record<string, unknown>)[k]));

const parseCalibration = (raw: string): Calibration | null => {
  try {
    const c = JSON.parse(raw) as Partial<Calibration>;
    return isVec(c.up) && isVec(c.forward) && isVec(c.right) && Number.isFinite(c.at) ? (c as Calibration) : null;
  } catch {
    return null;
  }
};

/** The calibration of the phone on its mount, kept between launches; null until it is made. */
export function useCalibration(): [Calibration | null, (next: Calibration) => void] {
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(CALIBRATION_KEY)
      .then((stored) => {
        if (live && stored) setCalibration(parseCalibration(stored));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const change = (next: Calibration) => {
    setCalibration(next);
    AsyncStorage.setItem(CALIBRATION_KEY, JSON.stringify(next)).catch(() => {});
  };
  return [calibration, change];
}
