import assert from "node:assert/strict";
import { test } from "node:test";
import { CrashDetector, REARM_S, type CrashEvent, type CrashSample } from "../src/core/crash.ts";
import type { Vec3 } from "../src/core/instruments.ts";

const HZ = 20;
const UPRIGHT: Vec3 = { x: 0, y: 1, z: 0 };
/** The same bike on its side: gravity along the phone's other axis. */
const LYING: Vec3 = { x: 1, y: 0.05, z: 0 };
/** A little noise, deterministic. */
const noise = (i: number): Vec3 => ({
  x: Math.sin(i * 1.7) * 0.03,
  y: Math.cos(i * 2.3) * 0.03,
  z: Math.sin(i * 3.1) * 0.03,
});

interface Segment {
  seconds: number;
  /** The GPS speed, m/s, a number or a function of the second in the segment (it updates once a second). */
  speed: number | null | ((s: number) => number | null);
  /** The accelerometer, g. */
  accel?: Vec3 | ((s: number) => Vec3);
  /** A shock of this many g at the start of the segment, for 2 samples. */
  shock?: number;
}

/** Feed a scenario to a detector, returning the events with the second each came at. */
function run(segments: Segment[], det = new CrashDetector(), startMs = 0): Array<CrashEvent & { at: number }> {
  const events: Array<CrashEvent & { at: number }> = [];
  let t = startMs;
  let i = 0;
  for (const seg of segments) {
    const n = Math.round(seg.seconds * HZ);
    for (let k = 0; k < n; k++) {
      const sec = k / HZ;
      const whole = Math.floor(sec);
      const speed = typeof seg.speed === "function" ? seg.speed(whole) : seg.speed;
      const base = typeof seg.accel === "function" ? seg.accel(sec) : (seg.accel ?? UPRIGHT);
      const nz = noise(i++);
      let a: Vec3 = { x: base.x + nz.x, y: base.y + nz.y, z: base.z + nz.z };
      if (seg.shock !== undefined && k < 2) a = { x: seg.shock * 0.6, y: seg.shock * 0.8, z: 0 };
      const sample: CrashSample = { t, a, speedMps: speed };
      const e = det.push(sample);
      if (e) events.push({ ...e, at: t });
      t += 1000 / HZ;
    }
  }
  return events;
}

test("riding along, a corner, hard braking to a stop and standing still raise nothing", () => {
  const events = run([
    { seconds: 30, speed: 20 },
    // A corner: the phone's gravity stays along the bike's own axis, a little more of it.
    { seconds: 8, speed: 20, accel: { x: 0, y: 1.2, z: 0 } },
    // Hard braking from 25 m/s over 4 s: 0.8 g backwards, no shock.
    { seconds: 4, speed: (s) => 25 - s * 6, accel: { x: 0, y: 1, z: 0.8 } },
    { seconds: 60, speed: 0 },
  ]);
  assert.deepEqual(events, []);
});

test("a pothole at speed is a shock and the bike goes on: not a crash", () => {
  const events = run([
    { seconds: 20, speed: 20 },
    { seconds: 1, speed: 20, shock: 6 },
    { seconds: 40, speed: 20 },
  ]);
  assert.deepEqual(events, []);
});

test("a crash at 72 km/h: a shock, the speed falls to nothing and the bike lies on its side for ten seconds", () => {
  const events = run([
    { seconds: 30, speed: 20 },
    { seconds: 3, speed: (s) => (s === 0 ? 20 : s === 1 ? 5 : 0), accel: LYING, shock: 8 },
    { seconds: 20, speed: 0, accel: LYING },
  ]);
  assert.equal(events.length, 1);
  const e = events[0]!;
  assert.equal(e.kind, "crash");
  assert.equal(e.preSpeedMps, 20);
  assert.ok(e.tiltDeg! > 60, String(e.tiltDeg));
  // Ten seconds after it stopped (2 s after the shock), not before.
  const sinceShock = (e.at - 30_000) / 1000;
  assert.ok(sinceShock >= 11.5 && sinceShock <= 13.5, String(sinceShock));
  assert.equal(e.impactAt, 30_000);
});

test("a crash at 54 km/h or more that leaves the phone upright is still a crash", () => {
  const events = run([
    { seconds: 30, speed: 17 },
    { seconds: 3, speed: (s) => (s === 0 ? 17 : 0), shock: 7 },
    { seconds: 20, speed: 0 },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.kind, "crash");
});

test("a shock and a stop at 36 km/h with the phone upright is not a crash, but with the bike on its side it is", () => {
  const stop = (accel: Vec3) =>
    run([
      { seconds: 30, speed: 10 },
      { seconds: 3, speed: (s) => (s === 0 ? 10 : 0), accel, shock: 6 },
      { seconds: 20, speed: 0, accel },
    ]);
  assert.deepEqual(stop(UPRIGHT), []);
  const lying = stop(LYING);
  assert.equal(lying.length, 1);
  assert.equal(lying[0]!.kind, "crash");
});

test("a tip-over at a standstill, after a ride, is a fall: a small shock and the bike lying", () => {
  const events = run([
    { seconds: 30, speed: 12 },
    { seconds: 10, speed: (s) => Math.max(0, 12 - s * 3) },
    { seconds: 20, speed: 0 },
    { seconds: 3, speed: 0, accel: LYING, shock: 3 },
    { seconds: 20, speed: 0, accel: LYING },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.kind, "fall");
});

test("a bike on its side stand, a phone knocked while parked, and a phone lifted off after a long stop raise nothing", () => {
  const leaning: Vec3 = { x: 0.34, y: 0.94, z: 0 }; // 20 degrees
  assert.deepEqual(
    run([
      { seconds: 30, speed: 12 },
      { seconds: 5, speed: 0 },
      { seconds: 60, speed: 0, accel: leaning },
    ]),
    [],
  );
  // Parked for hours: a knock is not a ride's fall.
  const det = new CrashDetector();
  run(
    [
      { seconds: 30, speed: 12 },
      { seconds: 5, speed: 0 },
    ],
    det,
  );
  assert.deepEqual(
    run(
      [
        { seconds: 2, speed: 0, accel: LYING, shock: 3 },
        { seconds: 30, speed: 0, accel: LYING },
      ],
      det,
      36_000_000,
    ),
    [],
  );
});

test("a shock with the speed unknown cannot be confirmed: nothing is raised", () => {
  const events = run([
    { seconds: 30, speed: 20 },
    { seconds: 3, speed: null, accel: LYING, shock: 8 },
    { seconds: 30, speed: null, accel: LYING },
  ]);
  assert.deepEqual(events, []);
});

test("stopping a long while after the shock is not a crash", () => {
  const events = run([
    { seconds: 30, speed: 20 },
    { seconds: 1, speed: 20, shock: 6 },
    { seconds: 25, speed: 20 },
    { seconds: 3, speed: 0, accel: LYING },
    { seconds: 25, speed: 0, accel: LYING },
  ]);
  assert.deepEqual(events, []);
});

test("an alert is not raised twice within two minutes, and again after", () => {
  const det = new CrashDetector();
  const crash = (): Segment[] => [
    { seconds: 30, speed: 20 },
    { seconds: 3, speed: (s) => (s === 0 ? 20 : 0), accel: LYING, shock: 8 },
    { seconds: 20, speed: 0, accel: LYING },
  ];
  const first = run(crash(), det);
  assert.equal(first.length, 1);
  // Another one right after, on the same detector, in the re-arm time: the rider has seen the alert.
  const soon = run(crash(), det, 120_000);
  assert.equal(soon.length, 0);
  const later = run(crash(), det, 120_000 + REARM_S * 1000 + 100_000);
  assert.equal(later.length, 1);
});

test("what upright is comes from the ride: a phone mounted at another angle is not seen as fallen", () => {
  const tilted: Vec3 = { x: 0.5, y: 0.87, z: 0 }; // mounted 30 degrees over
  const events = run([
    { seconds: 40, speed: 20, accel: tilted },
    { seconds: 3, speed: (s) => (s === 0 ? 20 : 0), accel: tilted, shock: 5 },
    { seconds: 20, speed: 0, accel: tilted },
  ]);
  // A hard shock and a stop from 72 km/h is a crash by speed even upright...
  assert.equal(events.length, 1);
  // ...but a shock and a stop from 36 km/h, with the phone as it always was, is not.
  const slow = run([
    { seconds: 40, speed: 10, accel: tilted },
    { seconds: 3, speed: (s) => (s === 0 ? 10 : 0), accel: tilted, shock: 5 },
    { seconds: 20, speed: 0, accel: tilted },
  ]);
  assert.deepEqual(slow, []);
});

test("reset forgets the ride", () => {
  const det = new CrashDetector();
  run([{ seconds: 30, speed: 20 }], det);
  assert.ok(det.tiltDeg() !== null);
  det.reset();
  assert.equal(det.tiltDeg(), null);
});
