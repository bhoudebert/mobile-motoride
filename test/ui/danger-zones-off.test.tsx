import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import * as Speech from "expo-speech";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { at, limitedRoadbook } from "./helpers.ts";

// The release gate (ADR 0011): with the setting off, no zone is ever warned.
jest.mock("../../src/ui/settings.ts", () => ({ DANGER_ZONES: false }));

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
});
afterEach(() => jest.useRealTimers());

test("with danger zones switched off nothing is shown or spoken near a camera", async () => {
  const rb = limitedRoadbook();
  const here = at(rb, 400);
  location.state.position = { latitude: here[0], longitude: here[1] };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  for (let m = 1000; m < 2200; m += 50) {
    const p = at(rb, m);
    await act(async () => location.pushFix(p[0], p[1], 16, m));
    expect(screen.queryByText("SPEED CAMERA")).toBeNull();
  }
  expect(Speech.speak).not.toHaveBeenCalled();
});
