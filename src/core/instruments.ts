import { haversineM } from "./geo.ts";
import { HEADING_MIN_SPEED_MPS, travelHeading } from "./heading.ts";
import { formatNumber, t } from "./i18n/index.ts";

/** Gravity, m/s². */
export const GRAVITY = 9.81;

/** The readings the rider can switch on (spec instruments). */
export const WIDGETS = ["compass", "altitude", "slope", "lean", "braking"] as const;
export type Widget = (typeof WIDGETS)[number];

export interface InstrumentSettings {
  /** The whole column. */
  on: boolean;
  widgets: Record<Widget, boolean>;
}

/** Lean and braking wait for a calibration, so they start off. */
export const DEFAULT_INSTRUMENTS: InstrumentSettings = {
  on: true,
  widgets: { compass: true, altitude: true, slope: true, lean: false, braking: false },
};

/** What was stored, or the default for anything missing or wrong. */
export function parseInstruments(raw: unknown): InstrumentSettings {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return DEFAULT_INSTRUMENTS;
    }
  }
  if (typeof value !== "object" || value === null) return DEFAULT_INSTRUMENTS;
  const v = value as { on?: unknown; widgets?: Record<string, unknown> };
  const widgets = { ...DEFAULT_INSTRUMENTS.widgets };
  for (const w of WIDGETS) if (typeof v.widgets?.[w] === "boolean") widgets[w] = v.widgets[w] as boolean;
  return { on: typeof v.on === "boolean" ? v.on : DEFAULT_INSTRUMENTS.on, widgets };
}

/** The motion sensors are listened to only for a lean or braking reading that is on. */
export const needsSensors = (s: InstrumentSettings): boolean => s.on && (s.widgets.lean || s.widgets.braking);

// ---- Compass

/** "NE": the point of a heading in degrees. */
export const pointOf = (deg: number): string =>
  t(`common.point.${Math.round((((deg % 360) + 360) % 360) / 45) % 8}` as "common.point.0");

/** The heading to show: the GPS course while moving, the last one when slower, null before there is one. */
export function compassHeading(
  last: number | null,
  headingDeg: number | null | undefined,
  speedMps: number | null,
): number | null {
  return travelHeading(headingDeg, speedMps) ?? last;
}

/** "NE 47°". */
export const compassText = (deg: number | null): string => (deg === null ? "–" : `${pointOf(deg)} ${Math.round(deg)}°`);

// ---- Altitude, climb and slope

/** A rise only counts once it exceeds this, so GPS noise does not add up to a climb. */
export const CLIMB_STEP_M = 3;
const SLOPE_WINDOW_M = 150;
const SLOPE_MIN_M = 100;
const ALTITUDE_SMOOTHING = 0.3;

export interface ElevationReading {
  altitudeM: number | null;
  climbM: number;
  /** Percent, signed; null when it cannot be told. */
  slopePct: number | null;
}

/** Altitude, the climb since the start and the slope over the last 150 m, from the fixes. */
export class Elevation {
  private alt: number | null = null;
  private ref: number | null = null;
  private climb = 0;
  private last: [number, number] | null = null;
  private ridden = 0;
  private trail: { d: number; alt: number }[] = [];
  private slope: number | null = null;

  push(altitudeM: number | null | undefined, lat: number, lon: number, speedMps: number | null): ElevationReading {
    if (typeof altitudeM === "number" && Number.isFinite(altitudeM)) {
      this.alt = this.alt === null ? altitudeM : this.alt + ALTITUDE_SMOOTHING * (altitudeM - this.alt);
      if (this.ref === null) this.ref = this.alt;
      else if (this.alt - this.ref > CLIMB_STEP_M) {
        this.climb += this.alt - this.ref;
        this.ref = this.alt;
      } else if (this.ref - this.alt > CLIMB_STEP_M) this.ref = this.alt;
    }
    const moving = speedMps !== null && speedMps >= HEADING_MIN_SPEED_MPS;
    if (this.last) this.ridden += moving ? haversineM(this.last, [lat, lon]) : 0;
    this.last = [lat, lon];
    if (!moving || this.alt === null) {
      // A stop starts the slope again: the height of a parked bike says nothing about the road.
      this.trail = [];
      this.slope = null;
    } else {
      this.trail.push({ d: this.ridden, alt: this.alt });
      while (this.trail.length > 2 && this.ridden - this.trail[1]!.d >= SLOPE_WINDOW_M) this.trail.shift();
      const first = this.trail[0]!;
      const span = this.ridden - first.d;
      this.slope = span >= SLOPE_MIN_M ? ((this.alt - first.alt) / span) * 100 : null;
    }
    return { altitudeM: this.alt, climbM: this.climb, slopePct: this.slope };
  }
}

export const altitudeText = (r: ElevationReading): string =>
  r.altitudeM === null ? "–" : `${Math.round(r.altitudeM)} m · +${Math.round(r.climbM)} m`;

export const slopeText = (pct: number | null): string =>
  pct === null ? "–" : `${pct > 0.5 ? "+" : pct < -0.5 ? "−" : ""}${Math.abs(Math.round(pct))} %`;

// ---- The phone's sensors: lean and G

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const length = (a: Vec3): number => Math.sqrt(dot(a, a));
const unit = (a: Vec3): Vec3 => scale(a, 1 / length(a));

/** The bike's axes in the phone's frame, found with the bike upright (spec instruments, ADR 0031). */
export interface Calibration {
  up: Vec3;
  forward: Vec3;
  right: Vec3;
  /** When it was made, ms. */
  at: number;
}

/** Still means the readings stay within this of their mean, in g. */
const STILL_G = 0.05;
const ONE_G_RANGE = [0.8, 1.2] as const;
/** Under this much of the phone's back direction is level, the phone lies flat and its top edge is taken as forward. */
const FLAT_BELOW = 0.3;

/** The axes from accelerometer samples (in g, gravity included) taken with the bike upright and still. */
export function calibrate(samples: Vec3[], at: number): Calibration | "moving" | "unreadable" {
  if (samples.length < 5) return "unreadable";
  const mean = scale(samples.reduce(add, { x: 0, y: 0, z: 0 }), 1 / samples.length);
  const g = length(mean);
  if (!(g >= ONE_G_RANGE[0] && g <= ONE_G_RANGE[1])) return "unreadable";
  if (samples.some((s) => length(add(s, scale(mean, -1))) > STILL_G)) return "moving";
  const up = unit(mean);
  // The phone faces the rider: its back (the screen's side, +z) points to the rider, so forward is its opposite, level.
  const back: Vec3 = { x: 0, y: 0, z: 1 };
  const level = add(back, scale(up, -dot(back, up)));
  const forward =
    length(level) >= FLAT_BELOW
      ? scale(unit(level), -1)
      : unit(add({ x: 0, y: 1, z: 0 }, scale(up, -dot({ x: 0, y: 1, z: 0 }, up))));
  return { up, forward, right: cross(forward, up), at };
}

/** Below this speed a turn is the steering, not the lean. */
export const LEAN_MIN_SPEED_MPS = 5;
const LEAN_MAX_DEG = 70;

/** Left positive: the lean whose sine is speed × turning rate about the upright axis ÷ g. */
export function leanDeg(speedMps: number, turningRate: number): number {
  if (speedMps < LEAN_MIN_SPEED_MPS) return 0;
  const limit = Math.sin((LEAN_MAX_DEG * Math.PI) / 180);
  const s = Math.max(-limit, Math.min(limit, (speedMps * turningRate) / GRAVITY));
  return (Math.asin(s) * 180) / Math.PI;
}

/** The sideways force of a corner, in g: the tangent of the lean. */
export const lateralG = (lean: number): number => Math.tan((lean * Math.PI) / 180);

export interface MotionReading {
  leanDeg: number;
  lateralG: number;
  /** Positive when braking, negative when accelerating. */
  brakingG: number;
  peakLeftDeg: number;
  peakRightDeg: number;
  /** The smoothed turning rate about the bike's upright axis, rad/s, left positive. */
  turnRate: number;
}

/**
 * A tap or a bump on the phone is a short spike of the turning rate: the median of the last seven samples (a third of a
 * second) drops it, and what is left is capped and smoothed. A corner lasts seconds, so it is not lost.
 */
const MOTION_SMOOTHING = 0.15;
const MAX_TURNING_RATE = 1.5;
const MEDIAN_OF = 7;

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

/** Beyond this grade the altitude is more likely a GPS jump than a road. */
const MAX_SLOPE_PCT = 35;

/**
 * What a slope puts on the forward axis, in g: on a climb the axis points up and the accelerometer reads the support
 * force along it. Zero when the slope is not known yet.
 */
export function slopeG(slopePct: number | null): number {
  if (slopePct === null || !Number.isFinite(slopePct)) return 0;
  const pct = Math.max(-MAX_SLOPE_PCT, Math.min(MAX_SLOPE_PCT, slopePct));
  return Math.sin(Math.atan(pct / 100));
}

/** Lean, lateral G and braking G from accelerometer and gyroscope samples and the GPS speed. */
export class Motion {
  private rate = 0;
  private recent: number[] = Array<number>(MEDIAN_OF).fill(0);
  private along = 0;
  private left = 0;
  private right = 0;
  private readonly cal: Calibration;
  constructor(cal: Calibration) {
    this.cal = cal;
  }

  /**
   * `accel` in g, gravity included; `gyro` in rad/s; `speedMps` from the GPS, 0 when unknown; `slopePct` the road's
   * grade (up positive), taken off the braking G so that a climb or a descent does not read as a force.
   */
  push(accel: Vec3, gyro: Vec3, speedMps: number | null, slopePct: number | null = null): MotionReading {
    this.recent.push(dot(gyro, this.cal.up));
    if (this.recent.length > MEDIAN_OF) this.recent.shift();
    const turning = Math.max(-MAX_TURNING_RATE, Math.min(MAX_TURNING_RATE, median(this.recent)));
    this.rate += MOTION_SMOOTHING * (turning - this.rate);
    this.along += MOTION_SMOOTHING * (dot(accel, this.cal.forward) - slopeG(slopePct) - this.along);
    const lean = leanDeg(speedMps ?? 0, this.rate);
    if (lean > this.left) this.left = lean;
    if (-lean > this.right) this.right = -lean;
    return {
      leanDeg: lean,
      lateralG: lateralG(lean),
      brakingG: -this.along,
      peakLeftDeg: this.left,
      peakRightDeg: this.right,
      turnRate: this.rate,
    };
  }

  resetPeaks(): void {
    this.left = 0;
    this.right = 0;
  }
}

/** "23° L", "4° R", "0°". */
export const leanText = (deg: number): string =>
  Math.abs(deg) < 0.5 ? "0°" : `${Math.round(Math.abs(deg))}° ${t(deg > 0 ? "rec.side.left" : "rec.side.right")}`;

/** "0.82 G". */
export const gText = (g: number): string =>
  `${formatNumber(Math.abs(g), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} G`;
