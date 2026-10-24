import { Animated } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { resetMapMock } from "./maplibre.mock.tsx";
import { seconds } from "./flush.ts";
import { first } from "./helpers.ts";

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
});
afterEach(() => jest.useRealTimers());

const startDemo = async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(1);
};

test("before a ride every button is on screen and there is no grabber", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  for (const name of ["Back", "Demo", "Start"]) expect(screen.getByText(name)).toBeTruthy();
  expect(screen.queryByLabelText("Show the ride buttons")).toBeNull();
});

test("while riding the buttons are folded away and the grabber offers them", async () => {
  await startDemo();
  for (const name of ["Back", "Pause", "End"]) expect(screen.queryByText(name)).toBeNull();
  expect(screen.getByLabelText("Show the ride buttons")).toBeTruthy();
  expect(screen.getByLabelText("Follow me")).toBeTruthy();
});

test("a tap on the grabber brings the buttons, a second tap folds them", async () => {
  await startDemo();
  await fireEvent.press(screen.getByLabelText("Show the ride buttons"));
  for (const name of ["Back", "Pause", "End"]) expect(screen.getByText(name)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Hide the ride buttons"));
  expect(screen.queryByText("End")).toBeNull();
});

test("the buttons fold by themselves after a few seconds, and Pause keeps them a little longer", async () => {
  await startDemo();
  await fireEvent.press(screen.getByLabelText("Show the ride buttons"));
  await seconds(5);
  await fireEvent.press(screen.getByText("Pause"));
  await seconds(5);
  expect(screen.getByText("Resume")).toBeTruthy();
  await seconds(4);
  expect(screen.queryByText("Resume")).toBeNull();
  expect(screen.getByText(/PAUSED/)).toBeTruthy();
});

test("the grabber is a 48 dp target and draws no text", async () => {
  await startDemo();
  const grabber = screen.getByLabelText("Show the ride buttons");
  expect(JSON.stringify(grabber.props.style)).toContain('"height":48');
  // It overlaps the readouts, so it must be drawn above them to get the touches on its whole height.
  expect(JSON.stringify(grabber.props.style)).toContain('"zIndex":1');
  expect(screen.queryByText(/Buttons/i)).toBeNull();
});

const at = (y: number) => ({ nativeEvent: { pageX: 100, pageY: y, touches: [{ pageX: 100, pageY: y }] } });

/** A finger down at `from`, dragged to `to` and lifted, through the responder events of the panel. */
const drag = async (from: number, to: number) => {
  const hud = screen.getByTestId("hud");
  hud.props.onStartShouldSetResponderCapture(at(from));
  const taken = hud.props.onMoveShouldSetResponderCapture(at(to));
  if (taken) await fireEvent(hud, "responderRelease", at(to));
  return taken;
};

test("a swipe up on the panel brings the buttons, a swipe down folds them", async () => {
  await startDemo();
  await drag(900, 820);
  for (const name of ["Back", "Pause", "End"]) expect(screen.getByText(name)).toBeTruthy();
  await drag(820, 900);
  expect(screen.queryByText("End")).toBeNull();
});

test("the panel takes a vertical drag before a button can, but leaves a tap and a sideways drag alone", async () => {
  await startDemo();
  expect(await drag(900, 840)).toBe(true);
  const hud = screen.getByTestId("hud");
  hud.props.onStartShouldSetResponderCapture(at(900));
  expect(hud.props.onMoveShouldSetResponderCapture(at(895))).toBe(false);
  expect(hud.props.onMoveShouldSetResponderCapture({ nativeEvent: { pageX: 300, pageY: 880 } })).toBe(false);
});

test("a tap or a short drag on the panel changes nothing", async () => {
  await startDemo();
  await drag(900, 900);
  await drag(900, 880);
  expect(screen.queryByText("End")).toBeNull();
});

test("a swipe before a ride does nothing, the buttons are already there", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await drag(900, 820);
  await drag(820, 900);
  expect(screen.getByText("Start")).toBeTruthy();
});

test("a screen reader can expand and collapse the buttons", async () => {
  await startDemo();
  await fireEvent(screen.getByLabelText("Show the ride buttons"), "accessibilityAction", {
    nativeEvent: { actionName: "expand" },
  });
  expect(screen.getByText("End")).toBeTruthy();
  await fireEvent(screen.getByLabelText("Hide the ride buttons"), "accessibilityAction", {
    nativeEvent: { actionName: "collapse" },
  });
  expect(screen.queryByText("End")).toBeNull();
});

test("opening a sheet folds the buttons, and they stay folded after it closes", async () => {
  await startDemo();
  await fireEvent.press(screen.getByLabelText("Show the ride buttons"));
  await fireEvent.press(screen.getByLabelText("Show the map key"));
  expect(screen.queryByText("End")).toBeNull();
  expect(screen.queryByLabelText(/ride buttons$/)).toBeNull();
  await fireEvent.press(screen.getByText("Close"));
  expect(screen.queryByText("End")).toBeNull();
});

test("ending a ride shows the buttons of the idle screen again", async () => {
  await startDemo();
  await fireEvent.press(screen.getByLabelText("Show the ride buttons"));
  await fireEvent.press(screen.getByText("End"));
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.getByText("Demo")).toBeTruthy();
  expect(screen.queryByLabelText("Show the ride buttons")).toBeNull();
});

test("the row slides out and back in about a fifth of a second, and does not just appear", async () => {
  const timing = jest.spyOn(Animated, "timing");
  await startDemo();
  timing.mockClear();
  await fireEvent.press(screen.getByLabelText("Show the ride buttons"));
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 220 }));
  timing.mockClear();
  await fireEvent.press(screen.getByLabelText("Hide the ride buttons"));
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: 220 }));
  await seconds(1);
  expect(screen.queryByText("End")).toBeNull();
  timing.mockRestore();
});

test("no slide is started before a ride, nor when nothing was opened", async () => {
  const timing = jest.spyOn(Animated, "timing");
  await startDemo();
  expect(timing).not.toHaveBeenCalled();
  timing.mockRestore();
});

test("the row's animated style is made once, or a render in mid-slide would detach it and stop the slide", async () => {
  const interpolate = jest.spyOn(Animated.Value.prototype, "interpolate");
  await startDemo();
  await fireEvent.press(screen.getByLabelText("Show the ride buttons"));
  const made = interpolate.mock.calls.length;
  await seconds(3);
  expect(interpolate.mock.calls.length).toBe(made);
  interpolate.mockRestore();
});
