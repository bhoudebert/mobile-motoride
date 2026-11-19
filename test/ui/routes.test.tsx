import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { BackHandler } from "react-native";
import App from "../../App.tsx";
import type { RouteCandidate } from "../../src/core/routeChoices.ts";
import { searchPlaces } from "../../src/services/places.ts";
import { routesToPlace } from "../../src/services/valhalla.ts";
import * as location from "./location.mock.ts";
import { layers, resetMapMock } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { RoutesScreen } from "../../src/ui/RoutesScreen.tsx";

jest.mock("../../src/services/places.ts", () => ({ searchPlaces: jest.fn() }));
const search = searchPlaces as jest.Mock;
const routes = routesToPlace as jest.Mock;

const TOURNAI = { name: "Rue du Mont des Carliers 3", detail: "Tournai, Belgique", lat: 50.6, lon: 3.38 };
let back: (() => boolean) | null = null;

/** Three roads from (50.4, 3.2) to Tournai: the motorway the fastest, the back roads and the shortest a little longer. */
const road = (bend: number): [number, number][] => [
  [50.4, 3.2],
  [50.5 + bend, 3.3 - bend],
  [50.6, 3.38],
];
const three = (): RouteCandidate[] => [
  { kind: "fastest", line: road(0), timeS: 2400, lengthM: 51_000 },
  { kind: "noMotorway", line: road(0.06), timeS: 2940, lengthM: 46_000 },
  { kind: "shortest", line: road(-0.06), timeS: 3300, lengthM: 44_000 },
];

beforeEach(() => {
  resetMapMock();
  search.mockReset();
  routes.mockReset();
  location.state.permission = "granted";
  location.state.position = { latitude: 50.4, longitude: 3.2 };
  back = null;
  search.mockResolvedValue([TOURNAI]);
  jest.spyOn(BackHandler, "addEventListener").mockImplementation(((_: string, h: () => boolean) => {
    back = h;
    return { remove: () => {} };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

const choosePlace = async () => {
  await render(<App />);
  await fireEvent.press(screen.getByLabelText("Where to?"));
  await fireEvent.changeText(screen.getByLabelText("Destination"), "Tournai");
  await fireEvent(screen.getByLabelText("Destination"), "submitEditing");
  await flush();
  await fireEvent.press(screen.getByLabelText("Ride to Rue du Mont des Carliers 3"));
  await flush();
};

test("several roads are offered: each with its time and distance, the fastest selected and thick, the others thinner and apart", async () => {
  routes.mockResolvedValue(three());
  await choosePlace();
  expect(screen.getByText("Choose your route")).toBeTruthy();
  expect(screen.getByText("Fastest")).toBeTruthy();
  expect(screen.getByText("No motorway")).toBeTruthy();
  expect(screen.getByText("Shortest")).toBeTruthy();
  expect(screen.getByText("40 min · 51.0 km")).toBeTruthy();
  expect(screen.getByText("49 min · 46.0 km")).toBeTruthy();
  expect(screen.getByText("+9 min")).toBeTruthy();
  expect(screen.getByLabelText("Fastest, 40 min, 51.0 km").props.accessibilityState.selected).toBe(true);
  expect(layers["choice-0"].paint["line-width"]).toBe(8);
  expect(layers["choice-1"].paint["line-width"]).toBeLessThan(8);
  expect(layers["choice-2"].paint["line-width"]).toBeLessThan(8);
  expect(layers["choice-1"].paint["line-color"]).not.toBe(layers["choice-0"].paint["line-color"]);
  expect(layers["choice-1"].paint["line-color"]).not.toBe(layers["choice-2"].paint["line-color"]);
});

test("pressing another road selects it, and Start rides that road", async () => {
  routes.mockResolvedValue(three());
  await choosePlace();
  await fireEvent.press(screen.getByLabelText("No motorway, 49 min, 46.0 km"));
  expect(screen.getByLabelText("No motorway, 49 min, 46.0 km").props.accessibilityState.selected).toBe(true);
  expect(layers["choice-1"].paint["line-width"]).toBe(8);
  expect(layers["choice-0"].paint["line-width"]).toBeLessThan(8);
  await fireEvent.press(screen.getByLabelText("Start"));
  await flush();
  expect(screen.getByText("To Rue du Mont des Carliers 3")).toBeTruthy();
  expect(screen.getByText("Demo")).toBeTruthy();
  expect(screen.queryByText("Choose your route")).toBeNull();
});

test("Back returns to the results, as they were", async () => {
  routes.mockResolvedValue(three());
  await choosePlace();
  await fireEvent.press(screen.getByLabelText("Back to the results"));
  expect(screen.queryByText("Choose your route")).toBeNull();
  expect(screen.getByLabelText("Ride to Rue du Mont des Carliers 3")).toBeTruthy();
  await choosePlaceAgain();
  await act(async () => {
    back!();
  });
  expect(screen.queryByText("Choose your route")).toBeNull();
});

const choosePlaceAgain = async () => {
  await fireEvent.press(screen.getByLabelText("Ride to Rue du Mont des Carliers 3"));
  await flush();
  expect(screen.getByText("Choose your route")).toBeTruthy();
};

test("one road only: the ride opens at once, with no choice asked", async () => {
  routes.mockResolvedValue([three()[0]]);
  await choosePlace();
  expect(screen.queryByText("Choose your route")).toBeNull();
  expect(screen.getByText("To Rue du Mont des Carliers 3")).toBeTruthy();
});

test("two of the three on the same road are shown once", async () => {
  const [fast] = three();
  routes.mockResolvedValue([fast, { ...fast!, kind: "shortest" }]);
  await choosePlace();
  expect(screen.queryByText("Choose your route")).toBeNull();
});

test("no road at all is said, and the results stay", async () => {
  routes.mockResolvedValue([]);
  await choosePlace();
  expect(screen.getByText(/No route could be had now/)).toBeTruthy();
  expect(screen.queryByText("Choose your route")).toBeNull();
});

test("a card says how much of its time is traffic, and when it is closed ahead", async () => {
  const [fast, other] = three();
  const jammed = { ...fast!, delayS: 780, closed: false, totalS: 3180 };
  const shut = { ...other!, delayS: 0, closed: true, totalS: 2940 };
  const open = { ...three()[2]!, delayS: 0, closed: false, totalS: 3300 };
  await render(<RoutesScreen place={TOURNAI} routes={[jammed, open, shut]} onBack={() => {}} onStart={() => {}} />);
  expect(screen.getByText("13 min of traffic")).toBeTruthy();
  expect(screen.getByText("Closed ahead")).toBeTruthy();
  expect(screen.getAllByText(/^\+/).length).toBeGreaterThan(0);
});
