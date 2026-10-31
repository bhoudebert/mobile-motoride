import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, screen } from "@testing-library/react-native";
import * as Orientation from "expo-screen-orientation";
import { Dimensions, StyleSheet } from "react-native";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { resetFiles } from "./filesystem.mock.ts";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { first } from "./helpers.ts";

// ADR 0045, spec ride-navigation "Landscape": the phone turns on the ride screen only.
const lock = Orientation.lockAsync as jest.Mock;
const size = (width: number, height: number) =>
  Dimensions.set({
    window: { width, height, scale: 2, fontScale: 1 },
    screen: { width, height, scale: 2, fontScale: 1 },
  });

beforeEach(async () => {
  jest.useFakeTimers();
  resetMapMock();
  resetFiles();
  await AsyncStorage.clear();
  location.state.permission = "granted";
  location.state.watcher = null;
  size(390, 844);
});
afterEach(() => {
  jest.useRealTimers();
  size(390, 844);
});

const style = (id: string) =>
  StyleSheet.flatten(screen.getByTestId(id, { hidden: true }).props.style) as Record<string, unknown>;
const open = async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush(30);
};

test("the phone may turn while the ride screen is open, and is locked upright again when it closes", async () => {
  await open();
  expect(lock).toHaveBeenLastCalledWith(Orientation.OrientationLock.DEFAULT);
  await screen.unmount();
  await flush();
  expect(lock).toHaveBeenLastCalledWith(Orientation.OrientationLock.PORTRAIT_UP);
});

test("upright, the panel is the bottom sheet and the map has the whole screen", async () => {
  await open();
  expect(style("hud").left).toBe(0);
  expect(style("hud").right).toBe(0);
  expect(style("ride-stage").left).toBe(0);
});

test("sideways, the panel is a column on the left and the map takes the rest, buttons still reachable", async () => {
  size(844, 390);
  await open();
  expect(style("hud").width).toBeGreaterThanOrEqual(338);
  expect(style("hud").top).toBe(0);
  expect(style("hud").right).toBeUndefined();
  expect(style("ride-stage").left).toBe(style("hud").width);
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.getByLabelText("Zoom in")).toBeTruthy();
  // The map buttons stand at the bottom of the map, not on a panel's top edge.
  expect(style("map-buttons").bottom).toBe(12);
});
