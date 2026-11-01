import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { ServerScreen } from "../../src/ui/ServerScreen.tsx";
import { resetServerSetting } from "../../src/ui/serverSetting.ts";
import { flush } from "./flush.ts";
import { stored } from "./securestore.mock.ts";

// Spec hosted-server: a rider with no server gets a free one from the app, with nothing to type or scan.
const fetchMock = globalThis.fetch as unknown as jest.Mock;
const SIDECAR = "https://sidecar.example.org";
const CODE = "mri_" + "a".repeat(32);
const LINK = `mobilemotoride://server?url=${encodeURIComponent("https://rides.example.org")}&code=${CODE}`;
const TOKEN = "mrt_" + "B".repeat(43);

const json = (status: number, body: unknown) => ({
  ok: status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});
const PLANS = {
  plans: [
    { id: "free", kind: "free", available: true, entitlements: { traffic: "open" } },
    { id: "plus", kind: "paid", available: false, entitlements: {} },
    { id: "premium", kind: "premium", available: false, entitlements: {} },
  ],
};

/** A fake sidecar and server: the answers of each path, in the order asked. */
const answers: Record<string, unknown[]> = {};
const calls: string[] = [];
const sidecar = () =>
  fetchMock.mockImplementation(async (url: string) => {
    const path = url.replace(SIDECAR, "").replace("https://rides.example.org", "");
    calls.push(path);
    if (path === "/enrol") return json(200, { token: TOKEN });
    const queue = answers[path];
    const next = queue && queue.length > 1 ? queue.shift() : queue?.[0];
    return next ?? json(404, {});
  });

beforeEach(async () => {
  jest.useFakeTimers();
  await resetServerSetting();
  stored.clear();
  calls.length = 0;
  for (const k of Object.keys(answers)) delete answers[k];
  setLanguage("en");
  process.env.EXPO_PUBLIC_HOSTED_SERVER = "1";
  process.env.EXPO_PUBLIC_SIDECAR_URL = SIDECAR;
  answers["/v1/plans"] = [json(200, PLANS)];
});
afterEach(() => {
  jest.useRealTimers();
  delete process.env.EXPO_PUBLIC_HOSTED_SERVER;
  delete process.env.EXPO_PUBLIC_SIDECAR_URL;
  fetchMock.mockImplementation(() => Promise.resolve({ ok: true }));
});

const open = async () => {
  await render(<ServerScreen onBack={() => {}} />);
  await flush();
};
const settle = async (ms = 0) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};

test("without the build switch there is no way to get a server", async () => {
  delete process.env.EXPO_PUBLIC_HOSTED_SERVER;
  await open();
  expect(screen.queryByText("Get a server")).toBeNull();
});

test("the plans: Free can be chosen, Plus and Premium are coming later", async () => {
  sidecar();
  await open();
  await fireEvent.press(screen.getByLabelText("See the plans for a server"));
  await flush();
  expect(screen.getByLabelText("Get a free server")).toBeTruthy();
  expect(screen.getAllByText("Coming later")).toHaveLength(2);
  expect(screen.getByText(/Sold by Adequate Function/)).toBeTruthy();
});

test("a free server: asked with the token alone, waited for, joined, and the setting saved", async () => {
  answers["/v1/accounts"] = [json(200, { state: "pending" })];
  answers["/v1/account/status"] = [json(200, { state: "pending" }), json(200, { state: "ready" })];
  answers["/v1/invitations"] = [json(200, { state: "ready", invitation: { code: CODE, link: LINK, expiresAt: "x" } })];
  sidecar();
  await open();
  await fireEvent.press(screen.getByLabelText("See the plans for a server"));
  await flush();
  await fireEvent.press(screen.getByLabelText("Get a free server"));
  await flush();
  expect(screen.getByText(/Creating your server/)).toBeTruthy();
  await settle(2000);
  await settle(2000);
  expect(calls.slice(0, 6)).toEqual([
    "/v1/plans",
    "/v1/accounts",
    "/v1/account/status",
    "/v1/account/status",
    "/v1/invitations",
    "/enrol",
  ]);
  expect(JSON.parse(stored.get("server-setting")!)).toEqual({ url: "https://rides.example.org", token: TOKEN });
  expect(stored.has("hosted-journal")).toBe(false);
  expect(stored.get("hosted-account-token")).toMatch(/^[0-9a-f-]{36}$/);
});

test("a setup that was under way when the app closed goes on by itself", async () => {
  stored.set("hosted-journal", JSON.stringify({ plan: "free" }));
  answers["/v1/accounts"] = [json(200, { state: "ready" })];
  answers["/v1/invitations"] = [json(200, { state: "ready", invitation: { code: CODE, link: LINK, expiresAt: "x" } })];
  sidecar();
  await open();
  await settle();
  expect(JSON.parse(stored.get("server-setting")!).url).toBe("https://rides.example.org");
  expect(stored.has("hosted-journal")).toBe(false);
});

test("when free servers are full the rider is told, and can try again", async () => {
  answers["/v1/accounts"] = [json(503, { error: "free_unavailable" })];
  sidecar();
  await open();
  await fireEvent.press(screen.getByLabelText("See the plans for a server"));
  await flush();
  await fireEvent.press(screen.getByLabelText("Get a free server"));
  await flush();
  expect(screen.getByText("Free servers are full for now. Try again later.")).toBeTruthy();
  expect(screen.getByLabelText("Try again")).toBeTruthy();
  expect(stored.has("server-setting")).toBe(false);
});

test("in French", async () => {
  setLanguage("fr");
  sidecar();
  await open();
  expect(screen.getByText("Voir les formules")).toBeTruthy();
});
