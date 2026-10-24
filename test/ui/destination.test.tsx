import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { BackHandler } from "react-native";
import App from "../../App.tsx";
import { searchPlaces } from "../../src/services/places.ts";
import { routeToStart } from "../../src/services/valhalla.ts";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";

jest.mock("../../src/services/places.ts", () => ({ searchPlaces: jest.fn() }));
const search = searchPlaces as jest.Mock;
const route = routeToStart as jest.Mock;

const MONS = { name: "Mons", detail: "Hainaut, Wallonia", lat: 50.4542, lon: 3.9523 };
let back: (() => boolean) | null = null;

beforeEach(() => {
  resetMapMock();
  search.mockReset();
  route.mockReset();
  location.state.permission = "granted";
  location.state.position = { latitude: 50.4, longitude: 3.2 };
  back = null;
  jest.spyOn(BackHandler, "addEventListener").mockImplementation(((_: string, h: () => boolean) => {
    back = h;
    return { remove: () => {} };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

const openSearch = async () => {
  await render(<App />);
  await fireEvent.press(screen.getByLabelText("Where to?"));
};
const submit = async (text: string) => {
  await fireEvent.changeText(screen.getByLabelText("Destination"), text);
  await fireEvent(screen.getByLabelText("Destination"), "submitEditing");
  await flush();
};

test("the map offers the search, and Back returns to the map", async () => {
  await openSearch();
  expect(screen.getByText("Go to a place")).toBeTruthy();
  expect(screen.queryByLabelText("Where to?")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Back to the map"));
  expect(screen.getByLabelText("Where to?")).toBeTruthy();
});

test("the phone's Back button leaves the search too", async () => {
  await openSearch();
  await act(async () => {
    back!();
  });
  expect(screen.getByLabelText("Where to?")).toBeTruthy();
});

test("a search starts when submitted, not as the rider types, and lists the places", async () => {
  search.mockResolvedValue([MONS]);
  await openSearch();
  await fireEvent.changeText(screen.getByLabelText("Destination"), "Mon");
  await fireEvent.changeText(screen.getByLabelText("Destination"), "Mons");
  expect(search).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText("Search"));
  await flush();
  expect(search).toHaveBeenCalledTimes(1);
  expect(search).toHaveBeenCalledWith("Mons");
  expect(screen.getByLabelText("Ride to Mons")).toBeTruthy();
  expect(screen.getByText("Hainaut, Wallonia")).toBeTruthy();
});

test("a query under 3 letters is not sent", async () => {
  await openSearch();
  await submit("Mo");
  expect(search).not.toHaveBeenCalled();
  expect(screen.getByText("Type at least 3 letters.")).toBeTruthy();
});

test("no place found and no network are said, and the rider can search again", async () => {
  search.mockResolvedValueOnce([]);
  await openSearch();
  await submit("Zzzzz");
  expect(screen.getByText("No place found")).toBeTruthy();
  search.mockResolvedValueOnce(null);
  await submit("Zzzzzz");
  expect(screen.getByText("The search needs the network. Try again.")).toBeTruthy();
  search.mockResolvedValueOnce([MONS]);
  await submit("Mons");
  expect(screen.getByLabelText("Ride to Mons")).toBeTruthy();
});

test("choosing a place routes from the phone's position and opens the ride named To <place>", async () => {
  search.mockResolvedValue([MONS]);
  route.mockResolvedValue([
    [50.4, 3.2],
    [50.43, 3.6],
    [50.4542, 3.9523],
  ]);
  await openSearch();
  await submit("Mons");
  await fireEvent.press(screen.getByLabelText("Ride to Mons"));
  await flush();
  expect(route).toHaveBeenCalledWith([50.4, 3.2], [50.4542, 3.9523]);
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.getByText("Demo")).toBeTruthy();
  expect(screen.getByText("To Mons")).toBeTruthy();
});

test("a refused location, an unknown position and a missing route are said and keep the results", async () => {
  search.mockResolvedValue([MONS]);
  await openSearch();
  await submit("Mons");

  location.state.permission = "denied";
  await fireEvent.press(screen.getByLabelText("Ride to Mons"));
  await flush();
  expect(screen.getByText(/position is needed/)).toBeTruthy();
  expect(route).not.toHaveBeenCalled();

  location.state.permission = "granted";
  location.state.position = null;
  await fireEvent.press(screen.getByLabelText("Ride to Mons"));
  await flush();
  expect(screen.getByText(/position is not known yet/)).toBeTruthy();

  location.state.position = { latitude: 50.4, longitude: 3.2 };
  route.mockResolvedValue(null);
  await fireEvent.press(screen.getByLabelText("Ride to Mons"));
  await flush();
  expect(screen.getByText(/No route could be had now/)).toBeTruthy();
  expect(screen.getByLabelText("Ride to Mons")).toBeTruthy();
  expect(screen.queryByText("Demo")).toBeNull();
});
