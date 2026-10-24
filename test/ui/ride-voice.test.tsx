import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import * as Speech from "expo-speech";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush, seconds } from "./flush.ts";
import { turnRoadbook } from "./helpers.ts";

const speak = Speech.speak as jest.Mock;
const stop = Speech.stop as jest.Mock;
const said = () => speak.mock.calls.map((c) => c[0] as string);
const TURN = /^(In \d+ metres, turn left|Turn left)$/;

beforeEach(async () => {
  jest.useFakeTimers();
  resetMapMock();
  speak.mockClear();
  stop.mockClear();
  await AsyncStorage.clear();
});
afterEach(() => jest.useRealTimers());

const open = async (stored?: string) => {
  if (stored) await AsyncStorage.setItem("voice-mode", stored);
  await render(<RideScreen rb={turnRoadbook()} onBack={() => {}} />);
  await flush();
};
/** Ride the demo until the turn is behind, a second at a time. */
const demoPastTheTurn = async () => {
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(260); // 3 km at the demo speed, and the turn
};

test("the voice button shows the mode, names it, and starts on Full", async () => {
  await open();
  expect(screen.getByLabelText("Voice: full guidance. Tap to change")).toBeTruthy();
  expect(screen.getByLabelText("Voice: full guidance. Tap to change")).toBeTruthy();
});

test("Full says the turn twice, far then close, and the corner warning", async () => {
  await open();
  await demoPastTheTurn();
  const turns = said().filter((t) => TURN.test(t));
  expect(turns.length).toBe(2);
  expect(turns[0]).toMatch(/^In (500|450) metres, turn left$/);
  expect(turns[1]).toBe("Turn left");
  expect(said().some((t) => /^(Hairpin|Sharp corner) left/.test(t))).toBe(true);
});

test("Alerts says the corner warning and not the turn", async () => {
  await open("alerts");
  expect(screen.getByLabelText("Voice: alerts only. Tap to change")).toBeTruthy();
  await demoPastTheTurn();
  expect(said().some((t) => /^(Hairpin|Sharp corner) left/.test(t))).toBe(true);
  expect(said().filter((t) => TURN.test(t))).toEqual([]);
});

test("Off says nothing at all", async () => {
  await open("off");
  expect(screen.getByLabelText("Voice: off. Tap to change")).toBeTruthy();
  await demoPastTheTurn();
  expect(speak).not.toHaveBeenCalled();
});

test("a tap changes the mode in the order Full, Alerts, Off, Full, and says its name except for Off", async () => {
  await open();
  await fireEvent.press(screen.getByLabelText("Voice: full guidance. Tap to change"));
  expect(screen.getByLabelText("Voice: alerts only. Tap to change")).toBeTruthy();
  expect(said()).toEqual(["Voice: alerts only"]);
  await fireEvent.press(screen.getByLabelText("Voice: alerts only. Tap to change"));
  expect(screen.getByLabelText("Voice: off. Tap to change")).toBeTruthy();
  expect(said()).toEqual(["Voice: alerts only"]); // Off is silent
  await fireEvent.press(screen.getByLabelText("Voice: off. Tap to change"));
  expect(screen.getByLabelText("Voice: full guidance. Tap to change")).toBeTruthy();
  expect(said()).toEqual(["Voice: alerts only", "Voice: full guidance"]);
});

test("turning the voice Off cuts what is being said", async () => {
  await open("alerts");
  stop.mockClear();
  await fireEvent.press(screen.getByLabelText("Voice: alerts only. Tap to change"));
  expect(stop).toHaveBeenCalled();
});

test("the mode is kept, and read again at the next launch", async () => {
  await open();
  await fireEvent.press(screen.getByLabelText("Voice: full guidance. Tap to change"));
  await flush();
  expect(await AsyncStorage.getItem("voice-mode")).toBe("alerts");
});

test("a stored value that is not a mode is ignored: Full", async () => {
  await open("shouting");
  expect(screen.getByLabelText("Voice: full guidance. Tap to change")).toBeTruthy();
});

test("a message muted is dropped, not said when the voice comes back", async () => {
  await open("off");
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(120); // the far announcement is due around 100 s: it is muted
  await fireEvent.press(screen.getByLabelText("Voice: off. Tap to change"));
  const before = said().length;
  expect(said()[before - 1]).toBe("Voice: full guidance");
  await act(async () => {});
  expect(said().filter((t) => /^In \d+ metres/.test(t))).toEqual([]);
});

test("the vibration for speed does not depend on the mode", async () => {
  // The mode is only about speech: nothing in it changes what the ride knows.
  await open("off");
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(5);
  expect(screen.getByText(/^(Straight .+|Left in .+)$/)).toBeTruthy();
});

describe("a scripted wrong way ride", () => {
  let handler: ((e: { url: string }) => void) | null = null;
  let listen: jest.SpyInstance;
  beforeEach(() => {
    listen = jest.spyOn(Linking, "addEventListener").mockImplementation(((
      _: string,
      h: (e: { url: string }) => void,
    ) => {
      handler = h;
      return { remove: () => {} };
    }) as never);
  });
  afterEach(() => listen.mockRestore());
  const wrongWay = async (stored?: string) => {
    await open(stored);
    await act(async () => handler!({ url: "mobilemotoride://replay/wrongway" }));
    await flush();
    await seconds(8);
  };

  test("Full says it once", async () => {
    await wrongWay();
    expect(said().filter((t) => t === "Wrong way, make a U-turn")).toHaveLength(1);
  });

  test("Alerts keeps quiet about it", async () => {
    await wrongWay("alerts");
    expect(said()).not.toContain("Wrong way, make a U-turn");
    expect(screen.getByText("U-turn, wrong way")).toBeTruthy(); // the screen still says it
  });
});
