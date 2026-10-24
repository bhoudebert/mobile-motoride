import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush, seconds } from "./flush.ts";
import { first, turnRoadbook } from "./helpers.ts";

// Spec languages: the ride screen and what it says, in the language in use.
const speak = Speech.speak as jest.Mock;

beforeEach(async () => {
  jest.useFakeTimers();
  resetMapMock();
  speak.mockClear();
  location.state.permission = "granted";
  location.state.watcher = null;
  await AsyncStorage.clear();
  setLanguage("fr");
});
afterEach(() => {
  setLanguage("en");
  jest.useRealTimers();
});

test("the ride screen at rest is in French, and its buttons are named in French", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush();
  expect(screen.getByText("Démarrer")).toBeTruthy();
  expect(screen.getByText("Démo")).toBeTruthy();
  expect(screen.getByText("Retour")).toBeTruthy();
  expect(screen.getByLabelText("Retour à la liste")).toBeTruthy();
  expect(screen.getByText(/^Les vitesses conseillées sont indicatives/)).toBeTruthy();
  expect(screen.getByLabelText("Zoom avant")).toBeTruthy();
  expect(screen.getByLabelText("Afficher la légende de la carte")).toBeTruthy();
  expect(screen.queryByText("Start")).toBeNull();
});

test("a refused location permission is said in French", async () => {
  location.state.permission = "denied";
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Démarrer"));
  await flush();
  expect(screen.getByText("Localisation désactivée")).toBeTruthy();
  expect(screen.queryByText("Location is off")).toBeNull();
});

test("the map key opens in French", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByLabelText("Afficher la légende de la carte"));
  expect(screen.getByText("Légende de la carte")).toBeTruthy();
  expect(screen.getByText("Épingle")).toBeTruthy();
  expect(screen.getByText("Fermer")).toBeTruthy();
});

test("the demo is in French, and so are the buttons of the ride", async () => {
  await render(<RideScreen rb={turnRoadbook()} onBack={() => {}} />);
  await flush();
  await fireEvent.press(screen.getByText("Démo"));
  await seconds(5);
  expect(screen.getByText(/ DÉMO/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Afficher les boutons du trajet"));
  expect(screen.getByLabelText("Mettre la démo en pause")).toBeTruthy();
  expect(screen.getByLabelText("Terminer la démo")).toBeTruthy();
  expect(screen.getByText("Terminer")).toBeTruthy();
  await fireEvent.press(screen.getByText("Pause"));
  expect(screen.getByText(/ DÉMO · EN PAUSE/)).toBeTruthy();
});

test("everything the ride says aloud is spoken with the French voice", async () => {
  await render(<RideScreen rb={turnRoadbook()} onBack={() => {}} />);
  await flush();
  const voiceButton = () =>
    screen.getAllByLabelText(/Touchez pour changer$/).filter((b) => !/^Carte/.test(b.props.accessibilityLabel))[0]!;
  // Full, then Alerts (its name is spoken), Off, and Full again (spoken too)
  await fireEvent.press(voiceButton());
  expect(speak).toHaveBeenCalledTimes(1);
  expect(speak.mock.calls[0]![1]).toMatchObject({ language: "fr-FR" });
  await fireEvent.press(voiceButton());
  await fireEvent.press(voiceButton());
  speak.mockClear();
  await fireEvent.press(screen.getByText("Démo"));
  await seconds(260);
  expect(speak.mock.calls.length).toBeGreaterThan(0);
  for (const call of speak.mock.calls) expect(call[1]).toMatchObject({ language: "fr-FR" });
});

test("in English the voice is the British one", async () => {
  setLanguage("en");
  await render(<RideScreen rb={turnRoadbook()} onBack={() => {}} />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Voice: full guidance. Tap to change"));
  expect(speak.mock.calls[0]![1]).toMatchObject({ language: "en-GB" });
  await act(async () => {});
});
