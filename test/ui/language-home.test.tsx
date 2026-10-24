import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import App from "../../App.tsx";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { flush } from "./flush.ts";

// Spec languages: the phone's language by default, switchable in the menu, kept between launches.
const phoneSpeaks = (locale: string) => {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...resolved.call(this), locale };
  });
};

beforeEach(async () => {
  await AsyncStorage.clear();
  setLanguage("en");
});
afterEach(() => {
  jest.restoreAllMocks();
  setLanguage("en");
});

const openMenu = async (label: string) => {
  await fireEvent.press(screen.getByLabelText(label));
  return within(screen.getByTestId("home-menu"));
};

test("on a French phone with no choice the app is in French, and in English on any other", async () => {
  phoneSpeaks("fr-FR");
  await AsyncStorage.setItem("language", "system");
  await render(<App />);
  await flush();
  expect(screen.getByLabelText("Où aller ?")).toBeTruthy();
  expect(screen.queryByLabelText("Where to?")).toBeNull();
});

test("a phone in another language gets English", async () => {
  phoneSpeaks("de-DE");
  await AsyncStorage.setItem("language", "system");
  await render(<App />);
  await flush();
  expect(screen.getByLabelText("Where to?")).toBeTruthy();
});

test("the language item cycles System, English, Français, redraws at once and is kept", async () => {
  phoneSpeaks("fr-FR");
  await AsyncStorage.setItem("language", "system");
  await render(<App />);
  await flush();
  const menu = await openMenu("Ouvrir le menu");
  const item = () => menu.getByLabelText(/^Langue : |^Language: /);
  expect(item().props.accessibilityLabel).toBe("Langue : Système (français). Touchez pour changer");

  await fireEvent.press(item());
  expect(item().props.accessibilityLabel).toBe("Language: English. Tap to change");
  expect(menu.getByLabelText("Close the menu")).toBeTruthy();
  expect(menu.getByText("My rides")).toBeTruthy();
  expect(await AsyncStorage.getItem("language")).toBe("en");

  await fireEvent.press(item());
  expect(item().props.accessibilityLabel).toBe("Langue : Français. Touchez pour changer");
  expect(menu.getByText("Mes sorties")).toBeTruthy();
  expect(await AsyncStorage.getItem("language")).toBe("fr");

  await fireEvent.press(item());
  expect(item().props.accessibilityLabel).toBe("Langue : Système (français). Touchez pour changer");
  expect(await AsyncStorage.getItem("language")).toBe("system");
});

test("a stored choice wins over the phone's language, and System follows the phone again", async () => {
  phoneSpeaks("fr-FR");
  await AsyncStorage.setItem("language", "en");
  await render(<App />);
  await flush();
  const menu = await openMenu("Open the menu");
  const item = menu.getByLabelText(/^Language: /);
  expect(item.props.accessibilityLabel).toBe("Language: English. Tap to change");
  await fireEvent.press(item); // English -> Français
  await fireEvent.press(menu.getByLabelText(/^Langue : /)); // Français -> System, which is French on this phone
  expect(menu.getByLabelText(/^Langue : /).props.accessibilityLabel).toBe(
    "Langue : Système (français). Touchez pour changer",
  );
});
