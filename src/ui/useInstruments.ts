import { Accelerometer, Gyroscope } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import {
  calibrate,
  compassHeading,
  Elevation,
  Motion,
  needsSensors,
  type Calibration,
  type ElevationReading,
  type InstrumentSettings,
  type MotionReading,
  type Vec3,
} from "../core/instruments.ts";
import type { Fix } from "../core/types.ts";

export interface InstrumentValues {
  heading: number | null;
  elevation: ElevationReading;
  /** Null until the sensors have said something, and whenever lean and braking are off or the phone is not calibrated. */
  motion: MotionReading | null;
}

const NO_ELEVATION: ElevationReading = { altitudeM: null, climbM: 0, slopePct: null };
const NONE: InstrumentValues = { heading: null, elevation: NO_ELEVATION, motion: null };

/** The sensors are read at about 20 Hz and shown about four times a second. */
const SENSOR_MS = 50;
const SHOW_MS = 250;
/** The pause after the tap, which shakes the phone, and how long the phone is then held still to calibrate it. */
const SETTLE_MS = 600;
const CALIBRATE_MS = 1500;

export type CalibrationResult = { done: Calibration } | { failed: "moving" | "unreadable" };

/** Reads the accelerometer for a moment with the bike upright and the phone still (spec instruments). */
export function runCalibration(): Promise<CalibrationResult> {
  return new Promise((resolve) => {
    const samples: Vec3[] = [];
    setTimeout(() => {
      Accelerometer.setUpdateInterval(SENSOR_MS);
      const sub = Accelerometer.addListener((a) => samples.push({ x: a.x, y: a.y, z: a.z }));
      setTimeout(() => {
        sub.remove();
        const result = calibrate(samples, Date.now());
        resolve(typeof result === "string" ? { failed: result } : { done: result });
      }, CALIBRATE_MS);
    }, SETTLE_MS);
  });
}

/**
 * Compass, altitude, slope from the GPS fixes, and lean and G from the phone's sensors: the readings of a ride that
 * is running, started again with each ride. The sensors are listened to only when lean or braking is on and the phone
 * is calibrated (spec instruments, ADR 0031).
 */
export function useInstruments({
  settings,
  calibration,
  active,
  fix,
  shared,
}: {
  settings: InstrumentSettings;
  calibration: Calibration | null;
  active: boolean;
  fix: Fix | null;
  /** Written with the latest motion reading, for the recording of the ride (spec ride-recording). */
  shared?: { current: MotionReading | null };
}): { values: InstrumentValues; resetPeaks: () => void } {
  const [values, setValues] = useState<InstrumentValues>(NONE);
  const elevation = useRef(new Elevation());
  const heading = useRef<number | null>(null);
  const speed = useRef<number | null>(null);
  const slope = useRef<number | null>(null);
  const motion = useRef<Motion | null>(null);
  const latest = useRef<MotionReading | null>(null);

  // A new ride starts the readings again.
  useEffect(() => {
    elevation.current = new Elevation();
    slope.current = null;
    heading.current = null;
    latest.current = null;
    setValues(NONE);
  }, [active]);

  useEffect(() => {
    if (!active || !fix) return;
    speed.current = fix.speedMps;
    heading.current = compassHeading(heading.current, fix.headingDeg, fix.speedMps);
    const e = elevation.current.push(fix.altitudeM, fix.lat, fix.lon, fix.speedMps);
    slope.current = e.slopePct;
    setValues((v) => ({ ...v, heading: heading.current, elevation: e }));
  }, [fix, active]);

  const listen = active && needsSensors(settings) && calibration !== null;
  useEffect(() => {
    if (!listen || !calibration) {
      motion.current = null;
      latest.current = null;
      if (shared) shared.current = null;
      setValues((v) => (v.motion ? { ...v, motion: null } : v));
      return;
    }
    const m = new Motion(calibration);
    motion.current = m;
    let gyro: Vec3 = { x: 0, y: 0, z: 0 };
    Accelerometer.setUpdateInterval(SENSOR_MS);
    Gyroscope.setUpdateInterval(SENSOR_MS);
    const gyroSub = Gyroscope.addListener((g) => {
      gyro = { x: g.x, y: g.y, z: g.z };
    });
    const accelSub = Accelerometer.addListener((a) => {
      latest.current = m.push({ x: a.x, y: a.y, z: a.z }, gyro, speed.current, slope.current);
      if (shared) shared.current = latest.current;
    });
    const show = setInterval(() => {
      const reading = latest.current;
      if (reading) setValues((v) => ({ ...v, motion: reading }));
    }, SHOW_MS);
    return () => {
      clearInterval(show);
      gyroSub.remove();
      accelSub.remove();
      if (shared) shared.current = null;
    };
  }, [listen, calibration]);

  return {
    values,
    resetPeaks: () => {
      motion.current?.resetPeaks();
      setValues((v) => (v.motion ? { ...v, motion: { ...v.motion, peakLeftDeg: 0, peakRightDeg: 0 } } : v));
    },
  };
}
