import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { CompassChip } from "../../src/ui/CompassChip.tsx";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { resetFiles } from "./filesystem.mock.ts";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { at, first } from "./helpers.ts";

// Spec ride-navigation, "The compass": a chip beside the traffic chip while riding.
beforeEach(async () => {
  jest.useFakeTimers();
  resetMapMock();
  resetFiles();
  await AsyncStorage.clear();
  setLanguage("en");
  location.state.permission = "granted";
  location.state.watcher = null;
});
afterEach(() => {
  jest.useRealTimers();
  setLanguage("en");
});

const turn = () => {
  const needle = screen.getByTestId("compass-needle");
  const t = (StyleSheet.flatten(needle.props.style) as { transform: { rotate: string }[] }).transform;
  return t[0]!.rotate;
};

test("the chip names the point faced and turns its needle to the north of the screen", async () => {
  await render(<CompassChip headingDeg={90} />);
  expect(screen.getByLabelText("Heading: east")).toBeTruthy();
  expect(screen.getByText("E")).toBeTruthy();
  expect(turn()).toBe("270deg");
  await screen.rerender(<CompassChip headingDeg={0} />);
  expect(screen.getByLabelText("Heading: north")).toBeTruthy();
  expect(turn()).toBe("0deg");
});

test("it is in French in French", async () => {
  setLanguage("fr");
  await render(<CompassChip headingDeg={225} />);
  expect(screen.getByLabelText("Cap : sud-ouest")).toBeTruthy();
  expect(screen.getByText("SO")).toBeTruthy();
});

test("the ride screen shows it once riding, not before Start", async () => {
  const [lat, lon] = at(first(), 1_000);
  location.state.position = { latitude: lat, longitude: lon };
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush(30);
  expect(screen.queryByTestId("compass-chip")).toBeNull();
  await fireEvent.press(screen.getByText("Start"));
  await flush(30);
  const [lat2, lon2] = at(first(), 1_200);
  await act(async () => location.pushFix(lat2, lon2, 20, Date.now()));
  expect(screen.getByTestId("compass-chip").props.accessibilityLabel).toMatch(/^Heading: /);
});
