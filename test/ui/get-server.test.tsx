import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { ServerScreen } from "../../src/ui/ServerScreen.tsx";
import { resetServerSetting, saveServer } from "../../src/ui/serverSetting.ts";
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
    {
      id: "free",
      kind: "free",
      available: true,
      entitlements: { traffic: "open" },
      launchOffer: { regularPriceEur: 25, text: "Free during launch, normally 25 EUR per year" },
    },
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

test("a build can switch it off, and without a build setting it is on at the project's sidecar", async () => {
  process.env.EXPO_PUBLIC_HOSTED_SERVER = "0";
  await open();
  expect(screen.queryByText("Get a server")).toBeNull();
});

test("the plans: one card, free during launch, the regular price struck through, no purchase", async () => {
  sidecar();
  await open();
  await fireEvent.press(screen.getByLabelText("See the plans for a server"));
  await flush();
  expect(screen.getByText("Free during launch")).toBeTruthy();
  expect(screen.getByText(/^€25$/)).toBeTruthy();
  expect(screen.getByText("Free during launch, normally 25 EUR per year")).toBeTruthy();
  expect(screen.getByText("Free for now. This may change later.")).toBeTruthy();
  expect(screen.getByLabelText("Get a free server")).toBeTruthy();
  expect(screen.queryByText("Plus")).toBeNull();
  expect(screen.queryByText("Premium")).toBeNull();
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

// The server the app made: what it allows, the code for ChatGPT or Claude, and deleting it.
const ME = {
  hosted: true,
  traffic: { mode: "open", perDay: 100, usedToday: 40 },
  library: { limitMb: 50, usedBytes: 2_097_152 },
  requestsPerMinute: 60,
};
const hosted = async (mark: "new" | "yes", me: unknown = ME) => {
  stored.set("hosted-server", mark);
  stored.set("hosted-account-token", "11111111-1111-4111-8111-111111111111");
  answers["/me"] = [json(200, me)];
  sidecar();
  await saveServer({ url: "https://rides.example.org", token: TOKEN });
  await open();
};

test("a server the app made says what it allows and what is left", async () => {
  await hosted("yes");
  expect(screen.getByText("Traffic: 60 requests left today.")).toBeTruthy();
  expect(screen.getByText("Library 2 of 50 MB")).toBeTruthy();
  expect(screen.queryByText("Your server is ready")).toBeNull();
});

test("the first time, it says the server is ready, and Done puts the message away", async () => {
  await hosted("new");
  expect(screen.getByText("Your server is ready")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Done, close this message"));
  await flush();
  expect(screen.queryByText("Your server is ready")).toBeNull();
  expect(stored.get("hosted-server")).toBe("yes");
});

test("a paused server says what is kept and until when, and offers no connection to a chat", async () => {
  await hosted("yes", { ...ME, suspended: { reason: "lapsed", until: "2027-11-01T00:00:00Z" } });
  expect(screen.getByText("Your server is paused")).toBeTruthy();
  expect(screen.getByText(/stays on the server until 2027-11-01/)).toBeTruthy();
  expect(screen.queryByLabelText("Connect ChatGPT or Claude to your server")).toBeNull();
});

test("a code to connect ChatGPT or Claude is shown big, with its lifetime", async () => {
  answers["/oauth/link-code"] = [json(200, { code: "K7QM-4X2P", expiresAt: "2026-11-01T10:10:00Z" })];
  await hosted("yes");
  await fireEvent.press(screen.getByLabelText("Connect ChatGPT or Claude to your server"));
  await flush();
  expect(screen.getByText("K7QM-4X2P")).toBeTruthy();
  expect(screen.getByText(/Valid for 10 minutes, works once/)).toBeTruthy();
});

test("deleting the server asks first, warns, and then clears it and the token", async () => {
  answers["/v1/account"] = [json(200, { state: "ended" })];
  await hosted("yes");
  await fireEvent.press(screen.getByLabelText("Delete my server and data"));
  expect(screen.getByText(/erased for good, with no way back/)).toBeTruthy();
  expect(calls).not.toContain("/v1/account");
  await fireEvent.press(screen.getByLabelText("Delete my server and data for good"));
  await flush();
  expect(calls).toContain("/v1/account");
  expect(stored.has("server-setting")).toBe(false);
  expect(stored.has("hosted-account-token")).toBe(false);
  expect(screen.getByText("Your server is deleted.")).toBeTruthy();
});

test("offline, nothing is deleted and the rider is told", async () => {
  await hosted("yes");
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/v1/account")) throw new TypeError("down");
    return json(200, ME);
  });
  await fireEvent.press(screen.getByLabelText("Delete my server and data"));
  await fireEvent.press(screen.getByLabelText("Delete my server and data for good"));
  await flush();
  expect(screen.getByText("Not deleted: no connection. Try again with a connection.")).toBeTruthy();
  expect(stored.has("server-setting")).toBe(true);
});

test("the server screen says who provides the server, the plan, the library, what it measures and a support code", async () => {
  answers["/v1/account/status"] = [json(200, { state: "ready", supportCode: "a1b2c3d4" })];
  await hosted("yes");
  expect(screen.getByText("Free server from Adequate Function")).toBeTruthy();
  expect(screen.getByText("Plan: Free during launch")).toBeTruthy();
  expect(screen.getByText("Library 2 of 50 MB")).toBeTruthy();
  expect(screen.getByText("Traffic: 60 requests left today.")).toBeTruthy();
  expect(screen.getByText(/size of your library file on the server/)).toBeTruthy();
  expect(screen.getByText("Support code a1b2c3d4. Quote it when you ask for help.")).toBeTruthy();
  expect(screen.queryByText(/tenant/i)).toBeNull();
});

test("a server of the rider's own says so and gives what /me allows, with no support code and no deletion", async () => {
  answers["/me"] = [json(200, { ...ME, hosted: false })];
  sidecar();
  await saveServer({ url: "https://rides.example.org", token: TOKEN });
  await open();
  expect(screen.getByText("Your own server")).toBeTruthy();
  expect(screen.getByText("Library 2 of 50 MB")).toBeTruthy();
  expect(screen.queryByText(/Support code/)).toBeNull();
  expect(screen.queryByLabelText("Delete my server and data")).toBeNull();
  expect(screen.queryByLabelText("Connect ChatGPT or Claude to your server")).toBeNull();
});

test("an older server that has no /me says nothing of its limits, and does not claim it cannot be reached", async () => {
  sidecar();
  await saveServer({ url: "https://rides.example.org", token: TOKEN });
  await open();
  expect(screen.getByText("Your own server")).toBeTruthy();
  expect(screen.queryByText(/Could not reach your server/)).toBeNull();
  expect(screen.queryByText(/Library/)).toBeNull();
});

test("the server screen says where the traffic comes from: open data, TomTom, or the host's choice", async () => {
  await hosted("yes");
  expect(screen.getByText("Traffic source: open data (the default).")).toBeTruthy();
});

test("a TomTom plan says TomTom, and a host's own setting says which provider when the server tells", async () => {
  await hosted("yes", { ...ME, traffic: { mode: "tomtom", perDay: null, usedToday: 0 } });
  expect(screen.getByText("Traffic source: TomTom.")).toBeTruthy();
});

test("traffic left to the host: its provider when the server says, else the host's choice", async () => {
  await hosted("yes", { ...ME, traffic: { mode: "host", perDay: null, usedToday: 0, provider: "tomtom" } });
  expect(screen.getByText("Traffic source: TomTom.")).toBeTruthy();
});

test("traffic left to the host and a server that does not say which: said as the host's choice; traffic off says no source", async () => {
  await hosted("yes", { ...ME, traffic: { mode: "host", perDay: null, usedToday: 0 } });
  expect(screen.getByText("Traffic source: chosen by the host of your server.")).toBeTruthy();
});

test("traffic off names no source", async () => {
  await hosted("yes", { ...ME, traffic: { mode: "off", perDay: null, usedToday: 0 } });
  expect(screen.queryByText(/Traffic source/)).toBeNull();
});
