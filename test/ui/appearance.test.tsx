import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { Appearance, StyleSheet } from "react-native";
import App from "../../App.tsx";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { BASEMAP_STYLES } from "../../src/ui/mapStyle.ts";
import { PALETTES, setScheme } from "../../src/ui/theme.ts";
import { flush } from "./flush.ts";

// Spec appearance: the phone's look by default, switchable in the menu, kept between launches.
const phoneIs = (scheme: "light" | "dark" | null) => jest.spyOn(Appearance, "getColorScheme").mockReturnValue(scheme);

beforeEach(async () => {
  await AsyncStorage.clear();
  setScheme("light");
  setLanguage("en");
});
afterEach(() => {
  jest.restoreAllMocks();
  setScheme("light");
  setLanguage("en");
});

const openMenu = async () => {
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  return within(screen.getByTestId("home-menu"));
};
// The menu panel is drawn with the paper of the look in use.
const paperOfMenu = () =>
  StyleSheet.flatten(screen.getByTestId("home-menu-panel").props.style).backgroundColor as string;

test("on a dark phone with no choice the app is dark, and light on a light one", async () => {
  phoneIs("dark");
  await AsyncStorage.setItem("theme", "system");
  await render(<App />);
  await flush();
  const menu = await openMenu();
  expect(menu.getByLabelText(/^Theme: /).props.accessibilityLabel).toBe("Theme: System (dark). Tap to change");
  expect(paperOfMenu()).toBe(PALETTES.dark.paper);
});

test("a phone that does not say gets the light look", async () => {
  phoneIs(null);
  await AsyncStorage.setItem("theme", "system");
  await render(<App />);
  await flush();
  const menu = await openMenu();
  expect(menu.getByLabelText(/^Theme: /).props.accessibilityLabel).toBe("Theme: System (light). Tap to change");
  expect(paperOfMenu()).toBe(PALETTES.light.paper);
});

test("the theme item cycles System, Light, Dark, redraws at once and is kept", async () => {
  phoneIs("dark");
  await AsyncStorage.setItem("theme", "system");
  await render(<App />);
  await flush();
  const menu = await openMenu();
  const item = () => menu.getByLabelText(/^Theme: /);

  await fireEvent.press(item());
  expect(item().props.accessibilityLabel).toBe("Theme: Light. Tap to change");
  expect(paperOfMenu()).toBe(PALETTES.light.paper);
  expect(await AsyncStorage.getItem("theme")).toBe("light");

  await fireEvent.press(item());
  expect(item().props.accessibilityLabel).toBe("Theme: Dark. Tap to change");
  expect(paperOfMenu()).toBe(PALETTES.dark.paper);
  expect(await AsyncStorage.getItem("theme")).toBe("dark");

  await fireEvent.press(item());
  expect(item().props.accessibilityLabel).toBe("Theme: System (dark). Tap to change");
  expect(await AsyncStorage.getItem("theme")).toBe("system");
});

test("a stored choice wins over the phone, and is read before the first screen", async () => {
  phoneIs("dark");
  await AsyncStorage.setItem("theme", "light");
  await render(<App />);
  await flush();
  const menu = await openMenu();
  expect(menu.getByLabelText(/^Theme: /).props.accessibilityLabel).toBe("Theme: Light. Tap to change");
  expect(paperOfMenu()).toBe(PALETTES.light.paper);
});

test("System follows the phone when it changes while the app runs", async () => {
  let current: "light" | "dark" = "light";
  jest.spyOn(Appearance, "getColorScheme").mockImplementation(() => current);
  const listeners: (() => void)[] = [];
  jest.spyOn(Appearance, "addChangeListener").mockImplementation(((l: () => void) => {
    listeners.push(l);
    return { remove: () => {} };
  }) as never);
  await AsyncStorage.setItem("theme", "system");
  await render(<App />);
  await flush();
  await openMenu();
  expect(paperOfMenu()).toBe(PALETTES.light.paper);
  current = "dark";
  await act(async () => listeners.forEach((l) => l()));
  expect(paperOfMenu()).toBe(PALETTES.dark.paper);
});

test("French names the look too", async () => {
  phoneIs("dark");
  await AsyncStorage.setItem("theme", "system");
  await AsyncStorage.setItem("language", "fr");
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Ouvrir le menu"));
  const item = within(screen.getByTestId("home-menu")).getByLabelText(/^Thème : /);
  expect(item.props.accessibilityLabel).toBe("Thème : Système (sombre). Touchez pour changer");
});

test("the map follows the look, and a basemap is the same object at every read in one look", () => {
  setScheme("light");
  const lightBlank = BASEMAP_STYLES.off;
  expect(BASEMAP_STYLES.off).toBe(lightBlank);
  expect(BASEMAP_STYLES.light).toContain("positron");
  setScheme("dark");
  expect(BASEMAP_STYLES.light).toContain("fiord");
  expect(BASEMAP_STYLES.colour).toContain("liberty");
  expect(BASEMAP_STYLES.off).not.toBe(lightBlank);
  expect(BASEMAP_STYLES.off).toBe(BASEMAP_STYLES.off);
});

test("a fixed choice does not follow the phone", async () => {
  phoneIs("dark");
  await AsyncStorage.setItem("theme", "light");
  await render(<App />);
  await flush();
  await openMenu();
  expect(paperOfMenu()).toBe(PALETTES.light.paper);
});
