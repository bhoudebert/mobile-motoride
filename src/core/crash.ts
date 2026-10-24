import type { Vec3 } from "./instruments.ts";

// ---- Crash and fall detection (spec crash-detection, ADR 0039)

/** One reading of the phone: when, the accelerometer in g (gravity included), and the GPS speed, null when it has none. */
export interface CrashSample {
  /** Milliseconds, any clock that does not go back. */
  t: number;
  a: Vec3;
  speedMps: number | null;
}

export interface CrashEvent {
  /** A crash at speed, or a fall of a bike that was moving slowly. */
  kind: "crash" | "fall";
  /** When the impact was. */
  impactAt: number;
  /** The fastest the bike went in the 5 s before it, m/s. */
  preSpeedMps: number;
  /** How far the phone is from upright now, degrees; null when no upright was learned. */
  tiltDeg: number | null;
}

/** An impact: the size of the shock, g, for a bike at speed and for a slow one that was moving a minute ago. */
export const IMPACT_G = 4;
export const FALL_IMPACT_G = 2.5;
/** At or above this a bike is at speed (about 29 km/h); at or above CRASH_STOP_MPS, even upright, a stop after an impact is a crash (54 km/h). */
export const AT_SPEED_MPS = 8;
export const CRASH_STOP_MPS = 15;
/** Standing still: under this speed, for this long, starting within this long of the impact. */
export const STILL_MPS = 1.5;
export const STILL_S = 10;
export const STILL_WITHIN_S = 8;
/** How far from upright the phone must be after the impact, degrees: a bike on its side, or its rider's phone in a hand beside it. */
export const CRASH_TILT_DEG = 45;
export const FALL_TILT_DEG = 60;
/** After an alert nothing is looked for for this long. */
export const REARM_S = 120;

const PRE_WINDOW_MS = 5000;
const RIDDEN_RECENTLY_MS = 60_000;
const SMOOTH_S = 1.5;
const UP_LEARN_S = 5;
const LEARN_MIN_MPS = 5;

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: Vec3) => Math.sqrt(dot(a, a));
const unit = (a: Vec3): Vec3 => {
  const n = norm(a) || 1;
  return { x: a.x / n, y: a.y / n, z: a.z / n };
};
const lerp = (a: Vec3, b: Vec3, k: number): Vec3 => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  z: a.z + (b.z - a.z) * k,
});
const angleDeg = (a: Vec3, b: Vec3): number =>
  (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;

interface Candidate {
  at: number;
  kind: "crash" | "fall";
  preSpeedMps: number;
  stillSince: number | null;
}

/**
 * Looks for a crash in the readings of the phone on the bike: a shock while the bike was moving, then no movement for ten seconds,
 * with the phone no longer upright (or the bike having been at 54 km/h or more). It learns what upright is from the ride itself.
 * A pothole (a shock, and the bike goes on), a hard stop (no shock) and a corner (the phone stays upright to the bike) are not crashes.
 */
export class CrashDetector {
  private up: Vec3 | null = null;
  private mean: Vec3 | null = null;
  private last = -Infinity;
  private speeds: Array<{ t: number; v: number }> = [];
  private lastMoved = -Infinity;
  private candidate: Candidate | null = null;
  private alertedAt = -Infinity;

  reset(): void {
    this.up = null;
    this.mean = null;
    this.last = -Infinity;
    this.speeds = [];
    this.lastMoved = -Infinity;
    this.candidate = null;
    this.alertedAt = -Infinity;
  }

  /** The tilt of the phone from upright, degrees. */
  tiltDeg(): number | null {
    return this.up && this.mean ? angleDeg(this.mean, this.up) : null;
  }

  push(s: CrashSample): CrashEvent | null {
    const dt = Number.isFinite(this.last) ? Math.max(0, (s.t - this.last) / 1000) : 0;
    this.last = s.t;
    const g = norm(s.a);
    if (!(g > 0)) return null;
    this.mean = this.mean ? lerp(this.mean, s.a, dt / (dt + SMOOTH_S)) : s.a;
    if (s.speedMps !== null) {
      this.speeds.push({ t: s.t, v: s.speedMps });
      while (this.speeds.length > 0 && this.speeds[0]!.t < s.t - RIDDEN_RECENTLY_MS) this.speeds.shift();
      if (s.speedMps >= 1) this.lastMoved = s.t;
    }
    const speed = s.speedMps;
    // What upright is, learned while riding along: the direction gravity (and the bike's own push) points in the phone's frame.
    if (speed !== null && speed >= LEARN_MIN_MPS && g >= 0.8 && g <= 1.3) {
      const u = unit(s.a);
      this.up = this.up ? unit(lerp(this.up, u, dt / (dt + UP_LEARN_S))) : u;
    }
    if (s.t - this.alertedAt < REARM_S * 1000) return null;

    const pre = this.preSpeed(s.t);
    if (!this.candidate) {
      const atSpeed = pre >= AT_SPEED_MPS;
      const ridden = s.t - this.lastMoved <= RIDDEN_RECENTLY_MS;
      if ((atSpeed && g >= IMPACT_G) || (!atSpeed && ridden && g >= FALL_IMPACT_G)) {
        this.candidate = { at: s.t, kind: atSpeed ? "crash" : "fall", preSpeedMps: pre, stillSince: null };
      }
      return null;
    }
    const c = this.candidate;
    if (speed !== null && speed < STILL_MPS) c.stillSince = c.stillSince ?? s.t;
    else if (speed !== null) c.stillSince = null;
    // Stillness has to start soon after the shock, and last: a bike that goes on, or stops a minute later, did not crash.
    if (c.stillSince === null && s.t - c.at > STILL_WITHIN_S * 1000) {
      this.candidate = null;
      return null;
    }
    if (c.stillSince !== null && c.stillSince - c.at > STILL_WITHIN_S * 1000) {
      this.candidate = null;
      return null;
    }
    if (c.stillSince !== null && s.t - c.stillSince >= STILL_S * 1000) {
      const tilt = this.tiltDeg();
      const lying = tilt !== null && tilt >= (c.kind === "crash" ? CRASH_TILT_DEG : FALL_TILT_DEG);
      const hardStop = c.kind === "crash" && c.preSpeedMps >= CRASH_STOP_MPS;
      this.candidate = null;
      if (!lying && !hardStop) return null;
      this.alertedAt = s.t;
      return { kind: c.kind, impactAt: c.at, preSpeedMps: c.preSpeedMps, tiltDeg: tilt };
    }
    return null;
  }

  private preSpeed(now: number): number {
    let best = 0;
    for (const p of this.speeds) if (p.t >= now - PRE_WINDOW_MS && p.v > best) best = p.v;
    return best;
  }
}
