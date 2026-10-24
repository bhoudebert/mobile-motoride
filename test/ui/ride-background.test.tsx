import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { at, skippableRoadbook, revealButtons } from "./helpers.ts";
import { RIDE_TASK } from "../../src/ui/background.ts";
import type { PreparedRoadbook } from "../../src/core/types.ts";

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
  location.state.permission = "granted";
  location.state.watcher = null;
  location.service.running = false;
  location.service.fail = false;
  location.service.options = null;
  location.startLocationUpdatesAsync.mockClear();
  location.stopLocationUpdatesAsync.mockClear();
});
afterEach(() => jest.useRealTimers());

const startGps = async (rb: PreparedRoadbook) => {
  const here = at(rb, 500);
  location.state.position = { latitude: here[0], longitude: here[1] };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
};

test("a GPS ride runs as a foreground service that names the roadbook, and nothing else asks for more permission", async () => {
  const rb = skippableRoadbook();
  await startGps(rb);
  expect(location.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  expect(location.startLocationUpdatesAsync.mock.calls[0]![0]).toBe(RIDE_TASK);
  expect(location.service.options.foregroundService.notificationBody).toBe(`Riding ${rb.roadbook.name}`);
  expect(location.service.running).toBe(true);
  expect(location.requestForegroundPermissionsAsync).toHaveBeenCalled();
});

test("pausing stops the service, resuming starts it again", async () => {
  await startGps(skippableRoadbook());
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  await flush();
  expect(location.service.running).toBe(false);
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Resume the ride"));
  await flush();
  expect(location.service.running).toBe(true);
});

test("leaving the ride screen stops the service", async () => {
  await startGps(skippableRoadbook());
  expect(location.service.running).toBe(true);
  await screen.unmount();
  await flush();
  expect(location.service.running).toBe(false);
});

test("a demo does not start the service", async () => {
  await render(<RideScreen rb={skippableRoadbook()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await flush();
  expect(location.startLocationUpdatesAsync).not.toHaveBeenCalled();
});

test("when the phone refuses the service the ride carries on with the screen on", async () => {
  location.service.fail = true;
  const rb = skippableRoadbook();
  await startGps(rb);
  expect(location.service.running).toBe(false);
  const here = at(rb, 600);
  await act(async () => location.pushFix(here[0], here[1], 10, Date.now(), 90));
  expect(location.state.watcher).not.toBeNull();
  expect(screen.queryByText("Location is off")).toBeNull();
});
