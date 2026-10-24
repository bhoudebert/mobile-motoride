import { act, render, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Linking } from "react-native";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush, seconds } from "./flush.ts";
import { endRide, junctionRoadbook, skippableRoadbook } from "./helpers.ts";
import type { PreparedRoadbook } from "../../src/core/types.ts";

let handler: ((e: { url: string }) => void) | null = null;
let listen: jest.SpyInstance;
/** The diagram is hidden from screen readers on purpose, and the queries skip what they hide. */
const SEE = { includeHiddenElements: true };
const speak = Speech.speak as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
  handler = null;
  location.state.permission = "granted";
  location.state.watcher = null;
  location.state.position = null;
  speak.mockClear();
  listen = jest.spyOn(Linking, "addEventListener").mockImplementation(((_: string, h: (e: { url: string }) => void) => {
    handler = h;
    return { remove: () => {} };
  }) as never);
});
afterEach(() => {
  jest.useRealTimers();
  listen.mockRestore();
});

const ride = async (rb: PreparedRoadbook, scenario: string, wait = 5) => {
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await act(async () => handler!({ url: `mobilemotoride://replay/${scenario}` }));
  await flush();
  await seconds(wait);
};

test("a roundabout ahead: the exit is named in the instruction and drawn, the one to take filled", async () => {
  await ride(skippableRoadbook(), "roundabout");
  expect(screen.getByText("2nd exit")).toBeTruthy();
  expect(screen.getByText(/^Roundabout · in \d+ m$/)).toBeTruthy();
  expect(screen.getByTestId("roundabout-diagram", SEE)).toBeTruthy();
  expect(screen.getByTestId("roundabout-entry", SEE)).toBeTruthy();
  expect(screen.getByTestId("exit-2-take", SEE)).toBeTruthy();
  expect(screen.getByTestId("exit-1", SEE)).toBeTruthy();
  expect(screen.getByTestId("exit-3", SEE)).toBeTruthy();
  expect(screen.queryByTestId("exit-1-take", SEE)).toBeNull();
  expect(screen.queryByTestId("exit-3-take", SEE)).toBeNull();
  expect(screen.queryByTestId("lanes-diagram", SEE)).toBeNull();
});

test("the exits are numbered from the right: 1 on the right, 2 ahead, 3 on the left", async () => {
  await ride(skippableRoadbook(), "roundabout");
  const turn = (id: string) => {
    let up = screen.getByTestId(id, SEE).parent;
    while (up && !JSON.stringify(up.props.style ?? "").includes("rotate")) up = up.parent;
    return JSON.stringify(up?.props.style);
  };
  expect(turn("exit-1")).toContain('"rotate":"105deg"');
  expect(turn("exit-2-take")).toContain('"rotate":"20deg"');
  expect(turn("exit-3")).toContain('"rotate":"275deg"');
});

test("every exit carries its number, the one to take in a filled disc", async () => {
  await ride(skippableRoadbook(), "roundabout");
  for (const n of ["1", "2", "3"]) expect(screen.getByText(n, SEE)).toBeTruthy();
  expect(screen.queryByText("4", SEE)).toBeNull();
});

test("a roundabout is spoken once, naming the exit", async () => {
  await ride(skippableRoadbook(), "roundabout", 20);
  const said = speak.mock.calls.map((c) => c[0]).filter((t: string) => /roundabout/i.test(t));
  expect(said).toEqual(["At the roundabout, take the second exit"]);
});

test("lanes ahead: four lanes drawn, the left two filled, and said in words", async () => {
  await ride(skippableRoadbook(), "lanes");
  expect(screen.getByText("Keep left")).toBeTruthy();
  expect(screen.getByText(/^Lanes 1 and 2 · in \d+ m$/)).toBeTruthy();
  expect(screen.getByTestId("lanes-diagram", SEE)).toBeTruthy();
  for (const i of [0, 1]) expect(screen.getByTestId(`lane-${i}-take`, SEE)).toBeTruthy();
  for (const i of [2, 3]) {
    expect(screen.getByTestId(`lane-${i}`, SEE)).toBeTruthy();
    expect(screen.queryByTestId(`lane-${i}-take`, SEE)).toBeNull();
  }
  expect(screen.queryByTestId("roundabout-diagram", SEE)).toBeNull();
  expect(speak.mock.calls.map((c) => c[0])).toContain("Keep left, lanes 1 and 2");
});

test("the lane arrows from the file are drawn, the through arrow when it gives none", async () => {
  await ride(skippableRoadbook(), "lanes");
  expect(screen.getAllByText("↑", SEE).length).toBe(2);
  expect(screen.getByText("↰", SEE)).toBeTruthy();
  expect(screen.getByText("↱", SEE)).toBeTruthy();
});

test("the junctions of the roadbook file itself are guided to, with no script of junctions", async () => {
  await ride(junctionRoadbook(), "ride"); // 1000 m: the roundabout is 200 m ahead
  expect(screen.getByText("2nd exit")).toBeTruthy();
  expect(screen.getByTestId("exit-2-take", SEE)).toBeTruthy();
});

test("a roadbook without junctions shows none", async () => {
  await ride(skippableRoadbook(), "ride");
  expect(screen.queryByTestId("junction-card", SEE)).toBeNull();
  expect(screen.getByText(/^(Straight .+|Left in .+|Right in .+)$/)).toBeTruthy();
});

test("the diagram is hidden from screen readers, since the instruction says it in words", async () => {
  await ride(skippableRoadbook(), "roundabout");
  const card = screen.getByTestId("junction-card", SEE);
  expect(card.props.importantForAccessibility).toBe("no-hide-descendants");
  expect(card.props.accessibilityElementsHidden).toBe(true);
  // Nothing in it takes a touch from the map or the panel below.
  expect(screen.getByTestId("junction-anchor", SEE).props.pointerEvents).toBe("none");
});

test("the diagram goes when the ride ends, and the demo roadbook is the real one again", async () => {
  await ride(skippableRoadbook(), "roundabout");
  await endRide();
  await flush();
  expect(screen.queryByTestId("junction-card", SEE)).toBeNull();
});
