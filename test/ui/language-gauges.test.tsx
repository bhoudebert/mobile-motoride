import { render, screen } from "@testing-library/react-native";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { DEFAULT_INSTRUMENTS } from "../../src/core/instruments.ts";
import { InstrumentsCard, InstrumentsOverlay } from "../../src/ui/InstrumentsUi.tsx";
import { ServerScreen } from "../../src/ui/ServerScreen.tsx";
import { LiveShareLine, LiveShareOffer } from "../../src/ui/LiveShareRow.tsx";
import { resetServerSetting } from "../../src/ui/serverSetting.ts";
import { flush } from "./flush.ts";

afterEach(() => {
  setLanguage("en");
});

const card = (calibration: { up: object; forward: object; right: object; at: number } | null) =>
  render(
    <InstrumentsCard
      top={0}
      settings={DEFAULT_INSTRUMENTS}
      onChange={() => {}}
      calibration={calibration as never}
      onCalibrate={async () => ({ failed: "moving" })}
      onResetPeaks={() => {}}
      onClose={() => {}}
    />,
  );

test("the gauges card is in English by default and in French when the language is French", async () => {
  await card(null);
  expect(screen.getByText("Gauges")).toBeTruthy();
  expect(screen.getByText("Not calibrated")).toBeTruthy();
});

test("with French, the gauges card and its switches are in French", async () => {
  setLanguage("fr");
  await card(null);
  expect(screen.getByText("Jauges")).toBeTruthy();
  expect(screen.getByText("Afficher les jauges")).toBeTruthy();
  expect(screen.getByText("Boussole")).toBeTruthy();
  expect(screen.getByText("Non étalonné")).toBeTruthy();
  expect(screen.getByText("Étalonner")).toBeTruthy();
  expect(screen.queryByText("Gauges")).toBeNull();
});

test("with French, the gauge chips and their spoken names are in French", async () => {
  setLanguage("fr");
  await render(
    <InstrumentsOverlay
      top={0}
      settings={DEFAULT_INSTRUMENTS}
      values={{ heading: null, elevation: { altitudeM: null, climbM: 0, slopePct: null }, motion: null }}
      calibrated={false}
      onCalibrate={() => {}}
    />,
  );
  expect(screen.getByText("CAP")).toBeTruthy();
  expect(screen.getByText("PENTE")).toBeTruthy();
  expect(screen.getByLabelText("Cap inconnu")).toBeTruthy();
  expect(screen.getByLabelText("Altitude inconnue")).toBeTruthy();
});

test("with French, the server screen is in French, with the plural of the PIN tries", async () => {
  await resetServerSetting();
  setLanguage("fr");
  await render(<ServerScreen onBack={() => {}} />);
  await flush();
  expect(screen.getByText("Serveur")).toBeTruthy();
  expect(screen.getByText("Enregistrer")).toBeTruthy();
  expect(screen.getByLabelText("Adresse du serveur")).toBeTruthy();
  expect(screen.getByLabelText("Jeton du serveur")).toBeTruthy();
  expect(screen.queryByText("Save")).toBeNull();
});

test("with French, the live sharing row is in French", async () => {
  setLanguage("fr");
  await render(<LiveShareLine status="interrupted" canLink onLink={() => {}} onStop={() => {}} />);
  expect(screen.getByText("Le partage est interrompu : nouvelle tentative")).toBeTruthy();
  expect(screen.getByLabelText("Renvoyer le lien")).toBeTruthy();
  expect(screen.getByLabelText("Arrêter le partage")).toBeTruthy();
  await render(<LiveShareOffer onShare={() => {}} />);
  expect(screen.getByText("Non partagé")).toBeTruthy();
});
