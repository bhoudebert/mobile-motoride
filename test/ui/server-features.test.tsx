import { Linking } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { HOSTING_GUIDE } from "../../src/ui/ServerFeatures.tsx";
import { ServerScreen } from "../../src/ui/ServerScreen.tsx";
import { resetServerSetting, saveServer } from "../../src/ui/serverSetting.ts";
import { flush } from "./flush.ts";

// Spec server-features: the server screen says what a server brings, switches nothing on that is not, and points to the hosting guide.
const fetchMock = globalThis.fetch as unknown as jest.Mock;
const SERVER = { url: "https://rides.example.org", token: "mrt_" + "A".repeat(43) };
const health = (body: unknown | null) =>
  fetchMock.mockImplementation(async () =>
    body === null ? Promise.reject(new TypeError("down")) : { ok: true, json: async () => body },
  );

beforeEach(async () => {
  await resetServerSetting();
  setLanguage("en");
  jest.spyOn(Linking, "openURL").mockResolvedValue();
});
afterEach(() => {
  jest.restoreAllMocks();
  fetchMock.mockImplementation(() => Promise.resolve({ ok: true }));
});

const open = async () => {
  await render(<ServerScreen onBack={() => {}} />);
  await flush();
};

test("with no server the screen says what one would add, that the app works without, and where to host one", async () => {
  await open();
  expect(screen.getByText("What a server adds")).toBeTruthy();
  expect(screen.getByText(/See slow traffic ahead on your route \(France today/)).toBeTruthy();
  expect(screen.getByText(/Without a server the app works fully/)).toBeTruthy();
  expect(screen.queryByText("Renting one: coming soon.")).toBeNull();
  expect(screen.getByText("Get a server")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Open the guide to host your own server"));
  expect(Linking.openURL).toHaveBeenCalledWith(HOSTING_GUIDE);
  expect(HOSTING_GUIDE).toBe("https://bhoudebert.github.io/agent-motoride/guide/self-hosting");
});

test("a server with traffic on says where it works", async () => {
  health({ ok: true, traffic: true, trafficCountries: ["FR"] });
  await saveServer(SERVER);
  await open();
  expect(screen.getByText("What this server brings")).toBeTruthy();
  expect(screen.getByLabelText(/^Live sharing\./)).toBeTruthy();
  expect(
    screen.getByLabelText("Traffic on your route. On. Works in France for now; more countries on request."),
  ).toBeTruthy();
});

test("a server with traffic on and no country list says only that it is on", async () => {
  health({ ok: true, traffic: true });
  await saveServer(SERVER);
  await open();
  expect(screen.getByLabelText("Traffic on your route. On.")).toBeTruthy();
});

test("a server without traffic says it is off and points to the guide", async () => {
  health({ ok: true, traffic: false });
  await saveServer(SERVER);
  await open();
  expect(
    screen.getByLabelText("Traffic on your route. Off on this server. Its host can turn it on: see the hosting guide."),
  ).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Open the guide to host your own server"));
  expect(Linking.openURL).toHaveBeenCalledWith(HOSTING_GUIDE);
});

test("a server that cannot be reached says so and claims nothing", async () => {
  health(null);
  await saveServer(SERVER);
  await open();
  expect(screen.getByText("Could not reach this server to check what it offers.")).toBeTruthy();
  expect(screen.queryByLabelText(/^Live sharing\./)).toBeNull();
});

test("in French the screen is in French", async () => {
  setLanguage("fr");
  health({ ok: true, traffic: true, trafficCountries: ["FR"] });
  await saveServer(SERVER);
  await open();
  expect(screen.getByText("Ce que ce serveur apporte")).toBeTruthy();
  expect(
    screen.getByLabelText(
      "Circulation sur votre parcours. Activée. Fonctionne en France pour l'instant ; d'autres pays sur demande.",
    ),
  ).toBeTruthy();
});

test("a build with the hosted server switched off still says that renting one is coming", async () => {
  process.env.EXPO_PUBLIC_HOSTED_SERVER = "0";
  await render(<ServerScreen onBack={() => {}} />);
  await flush();
  delete process.env.EXPO_PUBLIC_HOSTED_SERVER;
  expect(screen.getByText("Renting one: coming soon.")).toBeTruthy();
});
