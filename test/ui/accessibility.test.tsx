import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import App from "../../App.tsx";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { RoadbookList } from "../../src/ui/RoadbookList.tsx";
import { PALETTES, type Palette } from "../../src/ui/theme.ts";
import { SCHEMES } from "../../src/core/theme.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush, seconds } from "./flush.ts";
import { at, first, prepared, skippableRoadbook, revealButtons } from "./helpers.ts";
import * as location from "./location.mock.ts";

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

// Every text colour on its background, as the screens use them (src/ui/*). Large text needs 3:1, the rest 4.5:1.
const pairs = (c: Palette): [name: string, fg: string, bg: string, large: boolean][] => [
  ["list title", c.accent, c.paper, true],
  ["list subtitle", c.ink2, c.paper, false],
  ["card name", c.ink, c.card, false],
  ["card figures", c.rustText, c.card, false],
  ["card description", c.ink2, c.card, false],
  ["HUD speed and distance", c.mossText, c.moss, true],
  ["HUD lines", c.mossText, c.moss, false],
  ["HUD units and note", c.mossMuted, c.moss, false],
  ["instruction", c.mossText, c.moss, true],
  ["instruction detail", c.mossMuted, c.moss, false],
  ["instruction arrow", c.signal, c.moss, true],
  ["off route bar", c.paper, c.ink, true],
  ["hairpin banner", c.onRust, c.rust, true],
  ["sharp banner", c.onSignal, c.signal, true],
  ["Start button", c.onSignal, c.signal, true],
  ["Stop button", c.onRust, c.rust, true],
  ["Back and Demo buttons", c.mossText, c.moss2, true],
  ["map buttons", c.accent, c.card, true],
  ["attribution", c.ink, c.paper, false],
  ["error title", c.rustText, c.paper, true],
  ["error message", c.ink, c.paper, false],
  ["error button", c.mossText, c.moss, true],
  ["limit sign number", c.onSignal, c.white, true],
  ["limit sign over", c.white, c.limitRed, true],
  ["speed badge over", c.white, c.limitRed, true],
  ["limit sign unknown", c.mossText, c.moss2, true],
  ["limit sign captions", c.mossMuted, c.moss, false],
  ["skip button", c.mossText, c.moss2, false],
  ["skip button, refused", c.mossMuted, c.moss, false],
  ["skip question title", c.ink, c.card, true],
  ["skip question detail", c.ink2, c.card, false],
  ["skip confirm button", c.onRust, c.rust, true],
  ["skip cancel button", c.mossText, c.moss2, true],
  ["undo bar", c.paper, c.ink, false],
  ["undo button", c.onSignal, c.signal, true],
  ["end question title", c.ink, c.card, true],
  ["end question detail", c.ink2, c.card, false],
  ["keep riding button", c.mossText, c.moss2, true],
  ["end ride button", c.onRust, c.rust, true],
  ["join card primary", c.onSignal, c.signal, true],
  ["join card other choices", c.mossText, c.moss2, true],
  ["join card cancel", c.ink2, c.card, true],
  ["map key title", c.ink, c.card, true],
  ["map key detail", c.ink2, c.card, false],
  ["start from row", c.ink, c.card, false],
  ["start from current row", c.ink, c.paper2, false],
  ["start from distance", c.ink2, c.paper2, false],
  ["gauge value", c.mossText, c.moss, true],
  ["gauge label", c.signal, c.moss, false],
  ["gauge peaks", c.mossMuted, c.moss, false],
  ["gauges card title", c.ink, c.card, true],
  ["gauges card detail", c.ink2, c.card, false],
  ["gauges card button", c.mossText, c.moss2, true],
];

describe.each(SCHEMES)("contrast in the %s look", (scheme) => {
  test.each(pairs(PALETTES[scheme]))("%s", (_name, fg, bg, large) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(large ? 3 : 4.5);
  });
});

test.each(SCHEMES)("the route and the markers stand out from the map and from each other in the %s look", (scheme) => {
  const c = PALETTES[scheme];
  expect(contrast(c.route, c.paper)).toBeGreaterThanOrEqual(3);
  expect(contrast(c.hazard, c.paper)).toBeGreaterThanOrEqual(3);
  expect(contrast(c.signal, c.onSignal)).toBeGreaterThanOrEqual(3); // the marker's outline
  expect(contrast(c.limitRed, c.white)).toBeGreaterThanOrEqual(3); // the sign's ring on its disc
  expect(contrast(c.white, c.moss)).toBeGreaterThanOrEqual(3); // the over sign's ring on the HUD
});

beforeEach(() => resetMapMock());

const minSize = (el: any) => {
  const style = StyleSheet.flatten(el.props.style) ?? {};
  const width = style.width ?? style.minWidth ?? 48;
  const height = style.height ?? style.minHeight ?? (style.paddingVertical ?? 0) * 2 + 20;
  return { width, height };
};

test("every control on the ride screen is a labelled button of at least 48 dp", async () => {
  jest.useFakeTimers();
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  const check = () => {
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(7);
    for (const b of buttons) {
      // A button is named by its label or, failing that, by its own text.
      const named = (b.props.accessibilityLabel ?? "").length > 0 || within(b).queryAllByText(/\S/).length > 0;
      expect(named).toBe(true);
      const { width, height } = minSize(b);
      expect(width).toBeGreaterThanOrEqual(48);
      expect(height).toBeGreaterThanOrEqual(48);
    }
  };
  check();
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(2);
  check();
  expect(screen.getByLabelText("Zoom in")).toBeTruthy();
  expect(screen.getByLabelText("Zoom out")).toBeTruthy();
  expect(screen.getByLabelText("Show the whole roadbook")).toBeTruthy();
  expect(screen.getByLabelText("Follow me")).toBeTruthy();
  expect(screen.getByLabelText(/^Map: Light/)).toBeTruthy();
  jest.useRealTimers();
});

/** Climb from an element to the first ancestor that has the given prop value. */
const ancestorWith = (el: any, prop: string, value: string) => {
  for (let n = el; n; n = n.parent) if (n.props?.[prop] === value) return n;
  return null;
};

test("the screen reader hears the instruction and the banners change", async () => {
  jest.useFakeTimers();
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(2);
  const instruction = screen.getByText(/^(Straight .+|Left in .+|Right in .+|U-turn in .+|Finish in .+)$/);
  expect(ancestorWith(instruction, "accessibilityLiveRegion", "polite")).not.toBeNull();
  jest.useRealTimers();
});

test("every roadbook card on the list is a button a screen reader can name", async () => {
  await render(<RoadbookList roadbooks={prepared()} onOpen={() => {}} />);
  const cards = screen.getAllByRole("button");
  expect(cards.length).toBe(prepared().length);
  for (const rb of prepared())
    expect(screen.getByRole("button", { name: new RegExp(rb.roadbook.name.slice(0, 12)) })).toBeTruthy();
});

test("the whole app is reachable with buttons only: map, list, ride, back", async () => {
  await render(<App />);
  await fireEvent.press(screen.getByRole("button", { name: "Roadbooks" }));
  await fireEvent.press(screen.getByRole("button", { name: /Pays des Collines/ }));
  await revealButtons();
  expect(screen.getByRole("button", { name: "Back to the list" })).toBeTruthy();
  await revealButtons();
  await fireEvent.press(screen.getByRole("button", { name: "Back to the list" }));
  expect(screen.getByText("Pick a roadbook")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Back to the map" }));
  expect(screen.getByRole("button", { name: "Where to?" })).toBeTruthy();
});

test("the skip button, its question and the undo are labelled buttons of at least 48 dp", async () => {
  jest.useFakeTimers();
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  location.state.position = { latitude: here[0], longitude: here[1] };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  await act(async () => location.pushFix(here[0], here[1], 0, 1000, 90));
  const named = (b: any) => (b.props.accessibilityLabel ?? "").length > 0 || within(b).queryAllByText(/\S/).length > 0;
  const check = () => {
    for (const b of screen.getAllByRole("button")) {
      expect(named(b)).toBe(true);
      const { width, height } = minSize(b);
      expect(width).toBeGreaterThanOrEqual(48);
      expect(height).toBeGreaterThanOrEqual(48);
    }
  };
  check();
  await fireEvent.press(screen.getByLabelText("Skip 1. Mont"));
  expect(screen.getByText("Skip 1. Mont?")).toBeTruthy();
  check();
  expect(screen.getByLabelText(/^Skip 1\. Mont and go to 2\. Cassel$/)).toBeTruthy();
  jest.useRealTimers();
});

test("the end question, the join card, its list and the key are labelled buttons of at least 48 dp", async () => {
  jest.useFakeTimers();
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  const far: [number, number] = [at(rb, 1200)[0] + 0.0027, at(rb, 1200)[1]];
  location.state.position = { latitude: far[0], longitude: far[1] };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  const named = (b: any) => (b.props.accessibilityLabel ?? "").length > 0 || within(b).queryAllByText(/\S/).length > 0;
  const check = () => {
    for (const b of screen.getAllByRole("button")) {
      expect(named(b)).toBe(true);
      const { width, height } = minSize(b);
      expect(width).toBeGreaterThanOrEqual(48);
      expect(height).toBeGreaterThanOrEqual(48);
    }
  };
  await fireEvent.press(screen.getByLabelText("Show the map key"));
  expect(screen.getByText("Map key")).toBeTruthy();
  check();
  await fireEvent.press(screen.getByText("Close"));
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  expect(screen.getByText("Where do you join?")).toBeTruthy();
  check();
  expect(screen.getByLabelText(/^Go to 2\. Cassel, .* away, skips Start, 1\. Mont$/)).toBeTruthy();
  await fireEvent.press(screen.getByText("Choose another point…"));
  check();
  await fireEvent.press(screen.getByText("Cancel")); // the list: back to the card
  await fireEvent.press(screen.getByText("Cancel")); // the card: no ride
  location.state.position = { latitude: here[0], longitude: here[1] };
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  await act(async () => location.pushFix(here[0], here[1], 0, 1000, 90));
  await revealButtons();
  await fireEvent.press(screen.getByText("End"));
  expect(screen.getByText("End the ride?")).toBeTruthy();
  check();
  jest.useRealTimers();
});
