import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { BackHandler, Dimensions, StyleSheet } from "react-native";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { layers, resetMapMock, sources } from "./maplibre.mock.tsx";
import * as location from "./location.mock.ts";
import { flush } from "./flush.ts";
import { at, first, skippableRoadbook, revealButtons } from "./helpers.ts";

let backHandler: (() => boolean) | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
  backHandler = null;
  jest.spyOn(BackHandler, "addEventListener").mockImplementation(((_: string, h: () => boolean) => {
    backHandler = h;
    return { remove: () => {} };
  }) as never);
});
afterEach(() => jest.useRealTimers());

test("a Key button opens a card that explains every mark of the map in plain words", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByLabelText("Show the map key"));
  expect(screen.getByText("Map key")).toBeTruthy();
  for (const [title, detail] of [
    ["Your route", /Follow the green line.*arrows/],
    ["Way to your next point", /Dashed red/],
    ["Route point", /point of your roadbook/],
    ["Stop on the way", /café or fuel stop/],
    ["Hairpin", /Red dot: slow right down/],
    ["Sharp corner", /Yellow dot: slow down/],
    ["You", /yellow arrow/],
  ] as const) {
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(detail)).toBeTruthy();
  }
  expect(screen.getByText("Corner dots show when you zoom in.")).toBeTruthy();
});

test("each row of the key reads as one sentence to a screen reader", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByLabelText("Show the map key"));
  expect(screen.getByLabelText("Hairpin. Red dot: slow right down.")).toBeTruthy();
  expect(screen.getByLabelText("Sharp corner. Yellow dot: slow down.")).toBeTruthy();
});

test("the map controls step aside while the key is open, and Close brings them back", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  expect(screen.getByLabelText("Zoom in")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Show the map key"));
  expect(screen.queryByLabelText("Zoom in")).toBeNull();
  await fireEvent.press(screen.getByText("Close"));
  expect(screen.queryByText("Map key")).toBeNull();
  expect(screen.getByLabelText("Zoom in")).toBeTruthy();
});

test("the phone's Back button closes the key before it does anything else", async () => {
  const onBack = jest.fn();
  await render(<RideScreen rb={first()} onBack={onBack} />);
  await fireEvent.press(screen.getByLabelText("Show the map key"));
  await act(async () => expect(backHandler!()).toBe(true));
  expect(screen.queryByText("Map key")).toBeNull();
  expect(onBack).not.toHaveBeenCalled();
});

test("the key is there during a demo as well", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  expect(screen.getByLabelText("Show the map key")).toBeTruthy();
});

test("the overview is quiet: corner marks wait for zoom 11, and route points are bigger than corner marks", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  expect(layers["corners"].minzoom).toBe(11);
  const corner = layers["corners"].paint["circle-radius"];
  const stop = layers["stops"].paint["circle-radius"];
  expect(corner).toBe(5);
  // The expression gives a route point radius 10, a service stop 7: both bigger than a corner.
  expect(JSON.stringify(stop)).toBe(JSON.stringify(["match", ["get", "kind"], "stop", 7, 10]));
  expect(Math.min(7, 10)).toBeGreaterThan(corner);
});

test("service stops are drawn as hollow dots, route points as dark ones, from the kind on each stop", async () => {
  await render(<RideScreen rb={skippableRoadbook()} onBack={() => {}} />);
  const kinds = sources["stops"].features.map((f: any) => [f.properties.name, f.properties.kind]);
  expect(kinds).toContainEqual(["pause: Café", "stop"]);
  expect(kinds).toContainEqual(["1. Mont", "waypoint"]);
  expect(layers["stops"].paint["circle-color"][1]).toEqual(["get", "kind"]);
});

test("the key is a sheet: its content scrolls and its Close button is pinned outside the scrolling part", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByLabelText("Show the map key"));
  const scroll = screen.getByTestId("sheet-scroll");
  const footer = screen.getByTestId("sheet-footer");
  expect(within(scroll).getByText("Hairpin")).toBeTruthy();
  expect(within(scroll).queryByText("Close")).toBeNull();
  expect(within(footer).getByText("Close")).toBeTruthy();
});

test("a sheet is never taller than the screen, so its buttons cannot end up off it", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByLabelText("Show the map key"));
  const sheet = StyleSheet.flatten(screen.getByTestId("sheet").props.style);
  const { height } = Dimensions.get("window");
  expect(sheet.maxHeight).toBeLessThanOrEqual(height);
  expect(sheet.maxHeight).toBeGreaterThanOrEqual(240);
  expect(sheet.top).toBeGreaterThan(0);
  expect((sheet.top as number) + (sheet.maxHeight as number)).toBeLessThanOrEqual(height);
});

test("every card is a sheet with its buttons in the pinned footer", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  location.state.position = { latitude: here[0], longitude: here[1] };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  await act(async () => location.pushFix(here[0], here[1], 0, 1000, 90));
  await revealButtons();
  await fireEvent.press(screen.getByText("End"));
  expect(within(screen.getByTestId("sheet-footer")).getByText("End ride")).toBeTruthy();
  await fireEvent.press(screen.getByText("Keep riding"));
  await fireEvent.press(screen.getByText("Skip 1. Mont"));
  expect(within(screen.getByTestId("sheet-footer")).getByText("Skip")).toBeTruthy();
});

/** The path of child indexes to the first node of the rendered tree that satisfies `match`. */
function pathTo(node: any, match: (n: any) => boolean, path: number[] = []): number[] | null {
  if (match(node)) return path;
  const children = Array.isArray(node?.children) ? node.children : [];
  for (let i = 0; i < children.length; i++) {
    const found = typeof children[i] === "object" ? pathTo(children[i], match, [...path, i]) : null;
    if (found) return found;
  }
  return null;
}

test("a sheet is drawn after the ride screen, so nothing of the screen, the bottom panel included, is on top of it", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByLabelText("Show the map key"));
  const tree = screen.toJSON() as any;
  const sheet = pathTo(tree, (n) => n?.props?.testID === "sheet");
  const panel = pathTo(tree, (n) => Array.isArray(n?.children) && n.children.includes("Demo"));
  expect(sheet).not.toBeNull();
  expect(panel).not.toBeNull();
  // They share the root: the sheet's branch comes after the panel's, and so is drawn over it.
  expect(sheet![0]).toBeGreaterThan(panel![0]!);
});

test("under a sheet the ride screen is hidden from a screen reader on Android and on iOS, and is back when it closes", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  const layer = () => screen.getByTestId("ride-layer", { includeHiddenElements: true }).props;
  expect(layer().importantForAccessibility).toBe("auto");
  await fireEvent.press(screen.getByLabelText("Show the map key"));
  expect(layer().importantForAccessibility).toBe("no-hide-descendants");
  expect(layer().accessibilityElementsHidden).toBe(true);
  await fireEvent.press(screen.getByText("Close"));
  expect(layer().importantForAccessibility).toBe("auto");
  expect(layer().accessibilityElementsHidden).toBe(false);
});
