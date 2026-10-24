import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { BackHandler } from "react-native";
import * as Speech from "expo-speech";
import { HomeScreen } from "../../src/ui/HomeScreen.tsx";
import type { Recent } from "../../src/core/recents.ts";
import { routeToStart } from "../../src/services/valhalla.ts";
import * as location from "./location.mock.ts";
import { camera, lastMap, resetMapMock, sources } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { first, prepared } from "./helpers.ts";

const route = routeToStart as jest.Mock;
const MONS = { name: "Mons", detail: "Hainaut, Wallonia", lat: 50.4542, lon: 3.9523 };
const place = (name: string, i = 0): Recent => ({
  kind: "place",
  place: { name, detail: "Hainaut", lat: 50.4 + i / 100, lon: 3.9 },
  at: i,
});
const roadbookRecent = (): Recent => ({
  kind: "roadbook",
  id: first().roadbook.id,
  name: first().roadbook.name,
  detail: "122 km · loop",
  at: 9,
});

const handlers = {
  onOpenRoadbook: jest.fn(),
  onRoute: jest.fn(),
  onSearch: jest.fn(),
  onRoadbooks: jest.fn(),
  onClearRecents: jest.fn(),
  onImport: jest.fn(),
  onRides: jest.fn(),
  onServer: jest.fn(),
};
let back: (() => boolean) | null = null;

beforeEach(async () => {
  resetMapMock();
  route.mockReset();
  for (const h of Object.values(handlers)) h.mockReset();
  location.state.permission = "granted";
  location.state.position = { latitude: 50.45, longitude: 3.2 };
  location.requestForegroundPermissionsAsync.mockClear();
  (Speech.speak as jest.Mock).mockClear();
  await AsyncStorage.clear();
  back = null;
  jest.spyOn(BackHandler, "addEventListener").mockImplementation(((_: string, h: () => boolean) => {
    back = h;
    return { remove: () => {} };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

const open = async (recents: Recent[] = []) => {
  await render(<HomeScreen roadbooks={prepared()} recents={recents} {...handlers} />);
  await flush();
};

test("the home screen is the map, with no name of the app on it", async () => {
  await open();
  expect(screen.getByTestId("map")).toBeTruthy();
  expect(screen.queryByText(/MobileMotoRide|MotoRide/)).toBeNull();
  expect(lastMap.props.mapStyle).toBe("https://tiles.openfreemap.org/styles/positron");
});

test("the map is centred on the phone's position, which has a marker", async () => {
  await open();
  expect(camera.easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [3.2, 50.45], zoom: 14 }));
  const marker = sources["here"].features[0].geometry.coordinates;
  expect(marker).toEqual([3.2, 50.45]);
});

test("the control brings the map back to the rider", async () => {
  await open();
  camera.easeTo.mockClear();
  location.state.position = { latitude: 50.5, longitude: 3.3 };
  await fireEvent.press(screen.getByLabelText("Centre the map on me"));
  await flush();
  expect(camera.easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [3.3, 50.5] }));
});

test("a refused location leaves the map wide and the rest working, and says what is needed", async () => {
  location.state.permission = "denied";
  await open();
  expect(screen.getByText("Allow location to see where you are.")).toBeTruthy();
  expect(sources["here"]).toBeUndefined();
  expect(camera.easeTo).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText("Where to?"));
  expect(handlers.onSearch).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByLabelText("Roadbooks"));
  expect(handlers.onRoadbooks).toHaveBeenCalledTimes(1);
});

test("with no recent ride the panel says where they will appear", async () => {
  await open();
  expect(screen.getByText("Places and roadbooks you ride will appear here.")).toBeTruthy();
});

test("two recent rides show at rest, all of them when the panel is pulled up, and fold back", async () => {
  const recents = [place("A", 1), place("B", 2), place("C", 3), place("D", 4), roadbookRecent()];
  await open(recents);
  expect(screen.getAllByLabelText(/^Ride/)).toHaveLength(2);
  await fireEvent.press(screen.getByLabelText("Show all recent rides"));
  expect(screen.getAllByLabelText(/^Ride/)).toHaveLength(5);
  await fireEvent.press(screen.getByLabelText("Fold the recent rides"));
  expect(screen.getAllByLabelText(/^Ride/)).toHaveLength(2);
});

test("a swipe up on the panel pulls it up and a swipe down folds it", async () => {
  await open([place("A", 1), place("B", 2), place("C", 3)]);
  const sheet = within(screen.getByTestId("home-sheet"));
  const header = sheet.getByLabelText("Where to?").parent!;
  const drag = async (fromY: number, toY: number) => {
    await fireEvent(header, "startShouldSetResponderCapture", { nativeEvent: { pageX: 100, pageY: fromY } });
    await fireEvent(header, "responderRelease", { nativeEvent: { pageX: 100, pageY: toY } });
  };
  await drag(600, 400);
  expect(screen.getAllByLabelText(/^Ride/)).toHaveLength(3);
  await drag(400, 600);
  expect(screen.getAllByLabelText(/^Ride/)).toHaveLength(2);
});

test("a recent roadbook opens its ride", async () => {
  await open([roadbookRecent()]);
  await fireEvent.press(screen.getByLabelText(`Ride ${first().roadbook.name}`));
  expect(handlers.onOpenRoadbook).toHaveBeenCalledTimes(1);
  expect(handlers.onOpenRoadbook.mock.calls[0]![0].roadbook.id).toBe(first().roadbook.id);
});

test("a recent place is routed to from the phone's position, and hands over the ride", async () => {
  route.mockResolvedValue([
    [50.45, 3.2],
    [50.4542, 3.9523],
  ]);
  await open([{ kind: "place", place: MONS, at: 1 }]);
  await fireEvent.press(screen.getByLabelText("Ride to Mons"));
  await flush();
  expect(route).toHaveBeenCalledWith([50.45, 3.2], [50.4542, 3.9523]);
  expect(handlers.onRoute).toHaveBeenCalledTimes(1);
  expect(handlers.onRoute.mock.calls[0]![0].roadbook.name).toBe("To Mons");
  expect(handlers.onRoute.mock.calls[0]![1]).toEqual(MONS);
});

test("when the route cannot be had the home screen says so and stays", async () => {
  route.mockResolvedValue(null);
  await open([{ kind: "place", place: MONS, at: 1 }]);
  await fireEvent.press(screen.getByLabelText("Ride to Mons"));
  await flush();
  expect(screen.getByText(/No route could be had now/)).toBeTruthy();
  expect(handlers.onRoute).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Ride to Mons")).toBeTruthy();
});

test("the menu opens, lists what the app can do and closes in three ways", async () => {
  await open([place("A", 1)]);
  expect(screen.queryByTestId("home-menu")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  const menu = within(screen.getByTestId("home-menu"));
  for (const label of ["Roadbooks", "Go to a place", "Clear recent rides"])
    expect(menu.getByLabelText(label)).toBeTruthy();
  expect(menu.getByText("Map data © OpenStreetMap contributors, OpenFreeMap.")).toBeTruthy();
  await fireEvent.press(menu.getByLabelText("Close menu"));
  expect(screen.queryByTestId("home-menu")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("Close the menu"));
  expect(screen.queryByTestId("home-menu")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await act(async () => {
    back!();
  });
  expect(screen.queryByTestId("home-menu")).toBeNull();
  expect(screen.getByLabelText("Where to?")).toBeTruthy();
});

test("the menu goes to the roadbooks and to the search, and closes", async () => {
  await open();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(within(screen.getByTestId("home-menu")).getByLabelText("Roadbooks"));
  expect(handlers.onRoadbooks).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("home-menu")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(within(screen.getByTestId("home-menu")).getByLabelText("Go to a place"));
  expect(handlers.onSearch).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("home-menu")).toBeNull();
});

test("the menu changes the voice with one tap, in the same order as the ride screen, and keeps it", async () => {
  await open();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  expect(screen.getByLabelText("Voice: full guidance. Tap to change")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Voice: full guidance. Tap to change"));
  expect(screen.getByLabelText("Voice: alerts only. Tap to change")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Voice: alerts only. Tap to change"));
  await fireEvent.press(screen.getByLabelText("Voice: off. Tap to change"));
  expect(screen.getByLabelText("Voice: full guidance. Tap to change")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Voice: full guidance. Tap to change"));
  expect(await AsyncStorage.getItem("voice-mode")).toBe("alerts");
});

test("the menu clears the recent rides and closes", async () => {
  await open([place("A", 1)]);
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("Clear recent rides"));
  expect(handlers.onClearRecents).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("home-menu")).toBeNull();
});

test("a basemap that fails to load leaves the plain map", async () => {
  await open();
  await act(async () => lastMap.props.onDidFailLoadingMap());
  expect(lastMap.props.mapStyle.version).toBe(8);
});
