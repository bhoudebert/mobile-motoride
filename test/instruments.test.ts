import assert from "node:assert/strict";
import { test } from "node:test";
import {
  altitudeText,
  calibrate,
  compassHeading,
  compassText,
  DEFAULT_INSTRUMENTS,
  Elevation,
  gText,
  leanDeg,
  lateralG,
  leanText,
  Motion,
  slopeG,
  needsSensors,
  parseInstruments,
  pointOf,
  slopeText,
  type Vec3,
} from "../src/core/instruments.ts";
import { unproject } from "../src/core/geo.ts";

/** `m` metres further north. */
const north = (p: [number, number], m: number): [number, number] => unproject([0, m], p);

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

/** A phone upright in a handlebar mount, screen to the rider: gravity's reaction is along +y, the back of the screen along +z. */
const UPRIGHT: Vec3 = { x: 0, y: 1, z: 0 };
const still = (v: Vec3, n = 30): Vec3[] => Array.from({ length: n }, () => v);

test("the stored settings are read back, and anything wrong gives the default", () => {
  assert.deepEqual(parseInstruments(undefined), DEFAULT_INSTRUMENTS);
  assert.deepEqual(parseInstruments("not json"), DEFAULT_INSTRUMENTS);
  assert.deepEqual(parseInstruments("7"), DEFAULT_INSTRUMENTS);
  const stored = { on: false, widgets: { compass: false, lean: true } };
  assert.deepEqual(parseInstruments(JSON.stringify(stored)), {
    on: false,
    widgets: { ...DEFAULT_INSTRUMENTS.widgets, compass: false, lean: true },
  });
  assert.deepEqual(parseInstruments({ on: "yes", widgets: { slope: 1 } }), DEFAULT_INSTRUMENTS);
});

test("the sensors are listened to only for lean or braking that is on", () => {
  assert.equal(needsSensors(DEFAULT_INSTRUMENTS), false);
  const lean = { on: true, widgets: { ...DEFAULT_INSTRUMENTS.widgets, lean: true } };
  assert.equal(needsSensors(lean), true);
  assert.equal(needsSensors({ ...lean, on: false }), false);
  const braking = { on: true, widgets: { ...DEFAULT_INSTRUMENTS.widgets, braking: true } };
  assert.equal(needsSensors(braking), true);
});

test("the compass shows the point and the degrees, keeps the last heading when slow, and dashes before one", () => {
  assert.equal(pointOf(0), "N");
  assert.equal(pointOf(47), "NE");
  assert.equal(pointOf(359), "N");
  assert.equal(pointOf(200), "S");
  assert.equal(pointOf(-90), "W");
  assert.equal(compassText(47), "NE 47°");
  assert.equal(compassText(null), "–");
  assert.equal(compassHeading(null, 90, 15), 90);
  assert.equal(compassHeading(90, 180, 1), 90, "too slow for the GPS course");
  assert.equal(compassHeading(90, -1, 15), 90, "no course");
  assert.equal(compassHeading(null, null, 15), null);
});

test("altitude is smoothed and the climb counts a rise only once it exceeds 3 m", () => {
  const e = new Elevation();
  let r = e.push(100, 50, 3, 15);
  assert.equal(r.altitudeM, 100);
  assert.equal(r.climbM, 0);
  // noise of ±1 m adds nothing
  for (const alt of [101, 99, 101, 100, 99, 101]) r = e.push(alt, 50, 3, 15);
  assert.equal(r.climbM, 0);
  // a real climb of 20 m adds up to about 20 m
  for (let i = 1; i <= 40; i++) r = e.push(100 + i * 0.5, 50, 3, 15);
  near(r.climbM, 17, 4);
  assert.match(altitudeText(r), /^1\d\d m · \+\d+ m$/);
  assert.equal(altitudeText({ altitudeM: null, climbM: 0, slopePct: null }), "–");
});

test("the slope is the height over the last 150 m, only while moving and after 100 m", () => {
  const e = new Elevation();
  let p: [number, number] = [50, 3];
  let alt = 200;
  let r = e.push(alt, p[0], p[1], 15);
  assert.equal(r.slopePct, null, "no distance yet");
  // north at 15 m/s, 15 m per fix, +0.6 m per fix: a 4 % climb
  for (let i = 0; i < 30; i++) {
    p = north(p, 15);
    alt += 0.6;
    r = e.push(alt, p[0], p[1], 15);
  }
  near(r.slopePct ?? NaN, 4, 0.6);
  assert.match(slopeText(r.slopePct), /^\+4 %$/);
  // a stop starts it again
  r = e.push(alt, p[0], p[1], 0);
  assert.equal(r.slopePct, null);
  assert.equal(slopeText(null), "–");
  assert.equal(slopeText(-5.2), "−5 %");
  assert.equal(slopeText(0.2), "0 %");
});

test("with no altitude from the GPS there is no altitude and no slope", () => {
  const e = new Elevation();
  let p: [number, number] = [50, 3];
  let r = e.push(null, p[0], p[1], 15);
  for (let i = 0; i < 20; i++) {
    p = north(p, 15);
    r = e.push(undefined, p[0], p[1], 15);
  }
  assert.equal(r.altitudeM, null);
  assert.equal(r.slopePct, null);
});

test("calibration finds the bike's axes from a phone held upright, screen to the rider", () => {
  const cal = calibrate(still(UPRIGHT), 123);
  assert.ok(typeof cal !== "string");
  assert.deepEqual(roundV(cal.up), { x: 0, y: 1, z: 0 });
  assert.deepEqual(roundV(cal.forward), { x: 0, y: 0, z: -1 }, "forward is away from the rider");
  assert.deepEqual(roundV(cal.right), { x: 1, y: 0, z: 0 }, "the rider's right is the phone's +x");
  assert.equal(cal.at, 123);
});

test("calibration of a phone tilted back on its mount still finds a level forward axis", () => {
  const t = (25 * Math.PI) / 180;
  // the phone leans back 25°: gravity's reaction has a +z part
  const cal = calibrate(still({ x: 0, y: Math.cos(t), z: Math.sin(t) }), 0);
  assert.ok(typeof cal !== "string");
  near(cal.forward.y * cal.up.y + cal.forward.z * cal.up.z, 0, 1e-9);
  assert.ok(cal.forward.z < 0, "still away from the rider");
});

test("a phone lying flat takes its top edge as forward", () => {
  const cal = calibrate(still({ x: 0, y: 0, z: 1 }), 0);
  assert.ok(typeof cal !== "string");
  assert.deepEqual(roundV(cal.forward), { x: 0, y: 1, z: 0 });
});

test("a phone that moves, or readings that are not gravity, are refused", () => {
  const shaken = [...still(UPRIGHT, 20), { x: 0.5, y: 1, z: 0.2 }, ...still(UPRIGHT, 5)];
  assert.equal(calibrate(shaken, 0), "moving");
  assert.equal(calibrate(still({ x: 0, y: 0, z: 0 }), 0), "unreadable");
  assert.equal(calibrate(still({ x: 0, y: 3, z: 0 }), 0), "unreadable");
  assert.equal(calibrate(still(UPRIGHT, 2), 0), "unreadable", "too few readings");
});

test("a steady corner at 20 m/s with a turning rate of 0.31 rad/s is a lean of 39° and 0.82 G", () => {
  const lean = leanDeg(20, 0.31);
  near(lean, 39, 0.5);
  near(lateralG(lean), 0.82, 0.01);
  assert.equal(leanText(lean), "39° L");
  assert.equal(gText(0.82), "0.82 G");
  near(leanDeg(20, -0.31), -39, 0.5);
  assert.equal(leanText(-12.4), "12° R");
  assert.equal(leanText(0.2), "0°");
});

test("below 5 m/s the lean is 0, and an impossible one is capped at 70°", () => {
  assert.equal(leanDeg(4.9, 2), 0);
  assert.equal(leanDeg(30, 5), 70);
  near(leanDeg(30, -5), -70, 1e-9);
});

const cal = calibrate(still(UPRIGHT), 0) as Exclude<ReturnType<typeof calibrate>, string>;

test("riding round a left corner reads left lean, and the peaks keep the most of each side", () => {
  const m = new Motion(cal);
  let r = m.push(UPRIGHT, { x: 0, y: 0, z: 0 }, 20);
  assert.equal(r.leanDeg, 0);
  // the gyroscope turns about the bike's upright axis (+y) to the left, then to the right
  for (let i = 0; i < 60; i++) r = m.push(UPRIGHT, { x: 0, y: 0.31, z: 0 }, 20);
  near(r.leanDeg, 39, 1);
  near(r.peakLeftDeg, 39, 1);
  assert.equal(r.peakRightDeg, 0);
  for (let i = 0; i < 60; i++) r = m.push(UPRIGHT, { x: 0, y: -0.2, z: 0 }, 20);
  assert.ok(r.leanDeg < 0);
  near(r.peakRightDeg, (Math.asin((20 * 0.2) / 9.81) * 180) / Math.PI, 1);
  near(r.peakLeftDeg, 39, 1);
  for (let i = 0; i < 200; i++) m.push(UPRIGHT, { x: 0, y: 0, z: 0 }, 20); // upright again
  m.resetPeaks();
  r = m.push(UPRIGHT, { x: 0, y: 0, z: 0 }, 20);
  near(r.peakLeftDeg, 0, 1e-3);
  near(r.peakRightDeg, 0, 1e-3);
});

test("a turn about any other axis than the bike's upright one is not lean", () => {
  const m = new Motion(cal);
  let r = m.push(UPRIGHT, { x: 0, y: 0, z: 0 }, 20);
  for (let i = 0; i < 60; i++) r = m.push(UPRIGHT, { x: 0.5, y: 0, z: 0.5 }, 20);
  near(r.leanDeg, 0, 0.01);
});

test("braking is positive and accelerating negative, along the bike's forward axis", () => {
  const m = new Motion(cal);
  let r = m.push(UPRIGHT, { x: 0, y: 0, z: 0 }, 20);
  near(r.brakingG, 0, 1e-9);
  // braking: the force on the phone points backwards, towards the rider (+z) 0.4 g
  for (let i = 0; i < 80; i++) r = m.push({ x: 0, y: 1, z: 0.4 }, { x: 0, y: 0, z: 0 }, 20);
  near(r.brakingG, 0.4, 0.02);
  for (let i = 0; i < 80; i++) r = m.push({ x: 0, y: 1, z: -0.3 }, { x: 0, y: 0, z: 0 }, 20);
  near(r.brakingG, -0.3, 0.02);
});

test("a climb or a descent at a steady speed is not braking: the slope is taken off", () => {
  const sinTen = Math.sin(Math.atan(0.1));
  // on a 10 % climb the forward axis points up, so the phone reads the support force along it: z = -sin
  const climb = { x: 0, y: 1, z: -sinTen };
  const m = new Motion(cal);
  let r = m.push(climb, { x: 0, y: 0, z: 0 }, 20, 10);
  for (let i = 0; i < 80; i++) r = m.push(climb, { x: 0, y: 0, z: 0 }, 20, 10);
  near(r.brakingG, 0, 0.01);
  const blind = new Motion(cal);
  for (let i = 0; i < 80; i++) r = blind.push(climb, { x: 0, y: 0, z: 0 }, 20, null);
  near(r.brakingG, -sinTen, 0.01);
  // descent, then a real 0.4 g stop on top of it
  const down = new Motion(cal);
  for (let i = 0; i < 80; i++) r = down.push({ x: 0, y: 1, z: sinTen }, { x: 0, y: 0, z: 0 }, 20, -10);
  near(r.brakingG, 0, 0.01);
  for (let i = 0; i < 80; i++) r = down.push({ x: 0, y: 1, z: sinTen + 0.4 }, { x: 0, y: 0, z: 0 }, 20, -10);
  near(r.brakingG, 0.4, 0.02);
});

test("the slope term is zero when unknown, and an impossible grade is capped", () => {
  assert.equal(slopeG(null), 0);
  assert.equal(slopeG(Number.NaN), 0);
  near(slopeG(10), 0.0995, 1e-3);
  near(slopeG(-10), -0.0995, 1e-3);
  assert.equal(slopeG(900), slopeG(35));
});

test("with no GPS speed the lean is 0", () => {
  const m = new Motion(cal);
  const r = m.push(UPRIGHT, { x: 0, y: 0.5, z: 0 }, null);
  assert.equal(r.leanDeg, 0);
});

function roundV(v: Vec3): Vec3 {
  const r = (n: number) => Math.round(n * 1e6) / 1e6 + 0;
  return { x: r(v.x), y: r(v.y), z: r(v.z) };
}

test("a knock on the phone is a spike of the turning rate: it is capped and smoothed, and leaves no big peak", () => {
  const m = new Motion(cal);
  let r = m.push(UPRIGHT, { x: 0, y: 0, z: 0 }, 15);
  // a tap: a few samples at 8 rad/s, then still
  for (let i = 0; i < 3; i++) r = m.push(UPRIGHT, { x: 0, y: 8, z: 0 }, 15);
  for (let i = 0; i < 40; i++) r = m.push(UPRIGHT, { x: 0, y: 0, z: 0 }, 15);
  assert.ok(r.peakLeftDeg < 1 && r.peakRightDeg < 1, `${r.peakLeftDeg} ${r.peakRightDeg}`);
});
