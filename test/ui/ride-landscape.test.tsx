import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Orientation from "expo-screen-orientation";
import { Dimensions, StyleSheet } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { resetFiles } from "./filesystem.mock.ts";
import * as location from "./location.mock.ts";
import { camera, lastMap, resetMapMock } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { at, first } from "./helpers.ts";

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
  expect(style("hud").width).toBeGreaterThanOrEqual(287);
  expect(style("hud").top).toBe(0);
  expect(style("hud").right).toBeUndefined();
  expect(style("ride-stage").left).toBe(style("hud").width);
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.getByLabelText("Zoom in")).toBeTruthy();
  // The map buttons stand at the bottom of the map, not on a panel's top edge.
  expect(style("map-buttons").bottom).toBe(12);
});

test("sideways, the warning of a corner and the instruction are one card at the head of the column, none on the map", async () => {
  size(844, 390);
  const rb = first();
  const corner = rb.corners.find((c) => c.severity !== "bend")!;
  const [lat, lon] = at(rb, corner.startM - 400);
  location.state.position = { latitude: lat, longitude: lon };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  const push = async (m: number) => {
    const [la, lo] = at(rb, m);
    await act(async () => location.pushFix(la, lo, 17, Date.now()));
  };
  await push(corner.startM - 400);
  expect(screen.queryByTestId("corner-card", { hidden: true })).toBeNull();
  await push(corner.startM - 120);
  const card = screen.getByTestId("corner-card", { hidden: true });
  expect(card.props.accessibilityLabel).toMatch(/^(HAIRPIN|SHARP) (LEFT|RIGHT)\. /);
  // One element says it: the corner and the instruction, and no second yellow notice lies on the map.
  expect(screen.getAllByText(/^(HAIRPIN|SHARP) (LEFT|RIGHT)$/)).toHaveLength(1);
});

test("sideways, the sides leave the room the system reports for the camera cut-out", async () => {
  size(844, 390);
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 20, left: 40, right: 12 }}>
      <RideScreen rb={first()} onBack={() => {}} />
    </SafeAreaInsetsContext.Provider>,
  );
  await flush(30);
  const hud = style("hud");
  expect(hud.paddingLeft).toBe(16 + 40);
  expect(hud.width).toBe(287 + 40);
  expect(style("ride-stage").left).toBe(287 + 40);
  // The map bleeds to the right edge; what stands on it keeps clear of the inset.
  expect(style("ride-stage").right).toBe(0);
  expect(style("ride-overlay").right).toBe(12);
  // The map buttons stand above the gesture bar.
  expect(style("map-buttons").bottom).toBe(20 + 12);
});

test("sideways the compass chip stands at the top right of the map, not in the row of chips", async () => {
  const [lat, lon] = at(first(), 1_000);
  location.state.position = { latitude: lat, longitude: lon };
  size(844, 390);
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush(30);
  await fireEvent.press(screen.getByText("Start"));
  await flush(30);
  const [la, lo] = at(first(), 1_200);
  await act(async () => location.pushFix(la, lo, 20, Date.now()));
  const chip = screen.getByTestId("compass-chip", { hidden: true });
  expect(screen.getAllByTestId("compass-chip", { hidden: true })).toHaveLength(1);
  expect(lastMap.props.compass).toBe(false);
  // Its holder is pinned to the top right, not to the row of chips at the bottom.
  const holder = StyleSheet.flatten(chip.parent!.props.style) as Record<string, unknown>;
  expect(holder.right).toBe(8);
  expect(holder.top).toBeDefined();
  expect(holder.bottom).toBeUndefined();
});

test("upright the compass chip is the only compass: the map's own is off", async () => {
  const [lat, lon] = at(first(), 1_000);
  location.state.position = { latitude: lat, longitude: lon };
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush(30);
  await fireEvent.press(screen.getByText("Start"));
  await flush(30);
  const [la, lo] = at(first(), 1_200);
  await act(async () => location.pushFix(la, lo, 20, Date.now()));
  expect(screen.getByTestId("compass-chip", { hidden: true })).toBeTruthy();
  expect(lastMap.props.compass).toBe(false);
});

test("turning the phone before the ride fits the route to the new size, and not while riding", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush(30);
  camera.fitBounds.mockClear();
  size(844, 390);
  await screen.rerender(<RideScreen rb={first()} onBack={() => {}} />);
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(camera.fitBounds).toHaveBeenCalledTimes(1);
  expect(camera.fitBounds.mock.calls[0]![1]).toMatchObject({ padding: expect.objectContaining({ bottom: 40 }) });
});
