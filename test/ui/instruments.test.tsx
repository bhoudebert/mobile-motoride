import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { BackHandler } from "react-native";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { Accelerometer, Gyroscope, resetSensors } from "./sensors.mock.ts";
import { flush, seconds } from "./flush.ts";
import { at, skippableRoadbook } from "./helpers.ts";
import type { LatLon, PreparedRoadbook } from "../../src/core/types.ts";

let backHandler: (() => boolean) | null = null;
let listen: jest.SpyInstance;

beforeEach(async () => {
  jest.useFakeTimers();
  resetMapMock();
  resetSensors();
  await AsyncStorage.clear();
  // The gauges are tested alone: crash detection reads the accelerometer too (see crash.test.tsx).
  await AsyncStorage.setItem("crash-detection", "off");
  location.state.permission = "granted";
  location.state.watcher = null;
  backHandler = null;
  listen = jest.spyOn(BackHandler, "addEventListener").mockImplementation(((_: string, h: () => boolean) => {
    backHandler = h;
    return { remove: () => {} };
  }) as never);
});
afterEach(() => {
  jest.useRealTimers();
  listen.mockRestore();
});

let clock = 0;
const UPRIGHT = { x: 0, y: 1, z: 0 };
const CALIBRATION = {
  up: { x: 0, y: 1, z: 0 },
  forward: { x: 0, y: 0, z: -1 },
  right: { x: 1, y: 0, z: 0 },
  at: Date.UTC(2026, 9, 21, 10, 0),
};

const open = async (stored: { settings?: object; calibration?: object } = {}) => {
  clock = 0;
  if (stored.settings) await AsyncStorage.setItem("instruments", JSON.stringify(stored.settings));
  if (stored.calibration) await AsyncStorage.setItem("instruments-calibration", JSON.stringify(stored.calibration));
  const rb = skippableRoadbook();
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await flush();
  return rb;
};
const start = async (rb: PreparedRoadbook, here: LatLon) => {
  location.state.position = { latitude: here[0], longitude: here[1] };
  await fireEvent.press(screen.getByText("Start"));
  await flush();
};
const push = (p: LatLon, kmh: number, heading: number | null, altitude: number | null = null) =>
  act(async () => location.pushFix(p[0], p[1], kmh / 3.6, (clock += 1000), heading, altitude));
const openGauges = async () => {
  await fireEvent.press(screen.getByLabelText("Open the gauges"));
  await flush();
};
const stored = async (key: string) => JSON.parse((await AsyncStorage.getItem(key)) ?? "null");

const LEAN_ON = { on: true, widgets: { compass: true, altitude: true, slope: true, lean: true, braking: false } };

test("the compass shows the point and the degrees of the GPS course while riding, and dashes before a fix", async () => {
  const rb = await open();
  expect(screen.queryByTestId("gauge-compass")).toBeTruthy();
  expect(screen.getByLabelText("Heading unknown")).toBeTruthy();
  await start(rb, at(rb, 500));
  await push(at(rb, 500), 60, 47);
  expect(screen.getByText("NE 47°")).toBeTruthy();
  expect(screen.getByLabelText("Heading NE, 47 degrees")).toBeTruthy();
  await push(at(rb, 520), 0, 180);
  expect(screen.getByText("NE 47°")).toBeTruthy(); // too slow for a GPS course: the last one stays
});

test("altitude and slope follow the GPS, and dash when the GPS gives no altitude", async () => {
  const rb = await open();
  await start(rb, at(rb, 500));
  await push(at(rb, 500), 60, 90);
  expect(screen.getByLabelText("Altitude unknown")).toBeTruthy();
  expect(screen.getByLabelText("Slope unknown")).toBeTruthy();
  // 15 m a fix at 54 km/h, climbing 0.6 m a fix: a 4 % slope
  for (let i = 1; i <= 16; i++) await push(at(rb, 500 + 15 * i), 54, 90, 300 + 0.6 * i);
  expect(screen.getByLabelText(/^Altitude 30\d metres, climbed \d+ metres$/)).toBeTruthy();
  expect(screen.getByLabelText("Slope +4 %")).toBeTruthy();
});

test("the gauges card has a switch for the column and for each reading, and a reading switched off is gone at once", async () => {
  const rb = await open();
  await start(rb, at(rb, 500));
  await push(at(rb, 500), 60, 90);
  expect(screen.getByTestId("gauge-compass")).toBeTruthy();
  expect(screen.queryByTestId("gauge-lean")).toBeNull();
  await openGauges();
  expect(screen.getByText("Gauges")).toBeTruthy();
  for (const w of ["compass", "altitude", "slope", "lean", "braking"])
    expect(screen.getByTestId(`gauge-switch-${w}`)).toBeTruthy();
  expect(screen.getByTestId("gauges-master").props.value).toBe(true);
  expect(screen.getByTestId("gauge-switch-lean").props.value).toBe(false);
  await fireEvent(screen.getByTestId("gauge-switch-compass"), "valueChange", false);
  await fireEvent.press(screen.getByText("Close"));
  expect(screen.queryByTestId("gauge-compass")).toBeNull();
  expect(screen.getByTestId("gauge-altitude")).toBeTruthy();
});

test("the column switch takes every reading off the screen and the card keeps the others' switches", async () => {
  const rb = await open();
  await start(rb, at(rb, 500));
  await openGauges();
  await fireEvent(screen.getByTestId("gauges-master"), "valueChange", false);
  expect(screen.getByTestId("gauge-switch-compass").props.disabled).toBe(true);
  await fireEvent.press(screen.getByText("Close"));
  expect(screen.queryByTestId("instruments")).toBeNull();
  await openGauges();
  await fireEvent(screen.getByTestId("gauges-master"), "valueChange", true);
  await fireEvent.press(screen.getByText("Close"));
  expect(screen.getByTestId("gauge-compass")).toBeTruthy();
});

test("the switches are kept between launches", async () => {
  const rb = await open();
  await start(rb, at(rb, 500));
  await openGauges();
  await fireEvent(screen.getByTestId("gauge-switch-slope"), "valueChange", false);
  expect((await stored("instruments")).widgets.slope).toBe(false);
});

test("the stored switches are read back when the app starts", async () => {
  await open({ settings: { on: true, widgets: { compass: false, altitude: false, slope: true } } });
  expect(screen.queryByTestId("gauge-compass")).toBeNull();
  expect(screen.queryByTestId("gauge-altitude")).toBeNull();
  expect(screen.getByTestId("gauge-slope")).toBeTruthy();
});

test("the motion sensors are not listened to while lean and braking are off", async () => {
  const rb = await open({ calibration: CALIBRATION });
  await start(rb, at(rb, 500));
  await push(at(rb, 500), 60, 90);
  expect(Accelerometer.addListener).not.toHaveBeenCalled();
  expect(Gyroscope.addListener).not.toHaveBeenCalled();
});

test("lean switched on before the phone is calibrated asks to calibrate, and the sensors stay quiet", async () => {
  const rb = await open({ settings: LEAN_ON });
  await start(rb, at(rb, 500));
  await push(at(rb, 500), 60, 90);
  expect(screen.getByText("Calibrate")).toBeTruthy();
  expect(Accelerometer.addListener).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText("Lean needs calibration. Open the gauges"));
  await flush();
  expect(screen.getByText("Not calibrated")).toBeTruthy();
});

test("calibrating keeps the phone still for a moment, saves the axes, and the lean reads", async () => {
  const rb = await open({ settings: LEAN_ON });
  await start(rb, at(rb, 500));
  await openGauges();
  await fireEvent.press(screen.getByTestId("calibrate"));
  expect(screen.getByText("Hold the phone still…")).toBeTruthy();
  expect(Accelerometer.addListener).not.toHaveBeenCalled(); // the tap's own shake is let to settle first
  await act(async () => {
    jest.advanceTimersByTime(700);
  });
  for (let i = 0; i < 20; i++) Accelerometer.emit(UPRIGHT);
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  await flush();
  expect(screen.getByText("Calibrated.")).toBeTruthy();
  expect(screen.getByTestId("calibration-status").props.children).toMatch(/^Calibrated /);
  expect((await stored("instruments-calibration")).forward).toEqual({ x: 0, y: 0, z: -1 });
  await fireEvent.press(screen.getByText("Close"));
  // 72 km/h, turning left about the bike's upright axis at 0.31 rad/s: a lean of 39° to the left
  await push(at(rb, 600), 72, 90);
  for (let i = 0; i < 60; i++) {
    Gyroscope.emit({ x: 0, y: 0.31, z: 0 });
    Accelerometer.emit(UPRIGHT);
  }
  await seconds(1);
  expect(screen.getByLabelText("Lean 39 degrees left")).toBeTruthy();
  expect(screen.getByText(/^39° L · 0\.8\d G$/)).toBeTruthy();
  expect(screen.getByText(/^peak 39° L · 0°$/)).toBeTruthy();
});

test("a phone that moves while calibrating is refused and nothing is saved", async () => {
  const rb = await open({ settings: LEAN_ON });
  await start(rb, at(rb, 500));
  await openGauges();
  await fireEvent.press(screen.getByTestId("calibrate"));
  await act(async () => {
    jest.advanceTimersByTime(700);
  });
  for (let i = 0; i < 10; i++) Accelerometer.emit(UPRIGHT);
  Accelerometer.emit({ x: 0.6, y: 0.9, z: 0.3 });
  for (let i = 0; i < 10; i++) Accelerometer.emit(UPRIGHT);
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  await flush();
  expect(screen.getByText("Hold the phone still, and try again.")).toBeTruthy();
  expect(await AsyncStorage.getItem("instruments-calibration")).toBeNull();
  expect(screen.getByText("Not calibrated")).toBeTruthy();
});

test("braking reads positive while braking and the peaks can be reset", async () => {
  const rb = await open({
    settings: { on: true, widgets: { compass: false, altitude: false, slope: false, lean: true, braking: true } },
    calibration: CALIBRATION,
  });
  await start(rb, at(rb, 500));
  await push(at(rb, 500), 72, 90);
  for (let i = 0; i < 80; i++) {
    Gyroscope.emit({ x: 0, y: 0.2, z: 0 });
    // the force on the phone points to the rider when braking
    Accelerometer.emit({ x: 0, y: 1, z: 0.4 });
  }
  await seconds(1);
  expect(screen.getByText(/^0\.4\d G$/)).toBeTruthy();
  expect(screen.getByText("BRAKING")).toBeTruthy();
  expect(screen.getByText(/^peak 2\d° L · 0°$/)).toBeTruthy();
  await openGauges();
  await fireEvent.press(screen.getByTestId("reset-peaks"));
  await fireEvent.press(screen.getByText("Close"));
  expect(screen.getByText(/^peak 0° · 0°$/)).toBeTruthy();
});

test("the sensors are let go when lean is switched off, and when the ride ends", async () => {
  const rb = await open({ settings: LEAN_ON, calibration: CALIBRATION });
  await start(rb, at(rb, 500));
  await push(at(rb, 500), 60, 90);
  expect(Accelerometer.listeners.size).toBe(1);
  expect(Gyroscope.listeners.size).toBe(1);
  await openGauges();
  await fireEvent(screen.getByTestId("gauge-switch-lean"), "valueChange", false);
  expect(Accelerometer.listeners.size).toBe(0);
  expect(Gyroscope.listeners.size).toBe(0);
});

test("the card hides the gauges behind it, and the phone's Back button closes it", async () => {
  const rb = await open();
  await start(rb, at(rb, 500));
  await push(at(rb, 500), 60, 90);
  await openGauges();
  expect(screen.queryByTestId("gauge-compass")).toBeNull();
  await act(async () => {
    backHandler?.();
  });
  expect(screen.queryByTestId("gauges-master")).toBeNull();
  expect(screen.getByTestId("gauge-compass")).toBeTruthy();
});
