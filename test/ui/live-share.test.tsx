import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { webcrypto } from "node:crypto";
import { Alert, Linking, Share } from "react-native";
import App from "../../App.tsx";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { resetServerSetting } from "../../src/ui/serverSetting.ts";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { stored } from "./securestore.mock.ts";
import { flush } from "./flush.ts";
import { at, endRide, revealButtons, skippableRoadbook } from "./helpers.ts";
import type { PreparedRoadbook } from "../../src/core/types.ts";

const TOKEN = "mrt_" + "A".repeat(43);
const SERVER = { url: "https://rides.example.org", token: TOKEN };

interface Call {
  method: string;
  url: string;
  auth: string | undefined;
  body: any;
}
let calls: Call[] = [];
/** What the relay answers, by method; a test changes it. */
let answer: (call: Call) => { status: number; body?: unknown } | "down" = () => ({ status: 200 });
let clock = Date.UTC(2026, 9, 19, 9, 0, 0);
/** Holds the answer to a creation of a channel, so a position can arrive before the channel is ready. */
let gate: Promise<void> | null = null;
let initialUrl: string | null = null;
/** Every listener of the phone's links: the system tells them all. */
let listeners: Array<(e: { url: string }) => void> = [];
const onUrl = (e: { url: string }) => listeners.forEach((l) => l(e));

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
  resetServerSetting();
  stored.clear();
  calls = [];
  answer = () => ({ status: 200 });
  clock = Date.UTC(2026, 9, 19, 9, 0, 0);
  jest.setSystemTime(clock);
  gate = null;
  initialUrl = null;
  listeners = [];
  location.state.permission = "granted";
  location.state.watcher = null;
  (Share.share as unknown as jest.Mock) = jest.fn(() => Promise.resolve({ action: "sharedAction" }));
  jest.spyOn(Linking, "getInitialURL").mockImplementation(() => Promise.resolve(initialUrl));
  jest.spyOn(Linking, "addEventListener").mockImplementation(((_: string, h: (e: { url: string }) => void) => {
    listeners.push(h);
    return { remove: () => {} };
  }) as never);
  (globalThis.fetch as unknown as jest.Mock).mockImplementation(
    (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      if (!isShareServer(String(url))) return Promise.resolve({ ok: true });
      const call: Call = {
        method: init?.method ?? "GET",
        url: String(url),
        auth: init?.headers?.Authorization,
        body: init?.body ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      const r = answer(call);
      if (r === "down") return Promise.reject(new TypeError("Network request failed"));
      const reply = { ok: r.status < 300, status: r.status, json: async () => r.body ?? {} };
      return call.method === "PUT" && gate ? gate.then(() => reply) : Promise.resolve(reply);
    },
  );
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const withServer = () => stored.set("server-setting", JSON.stringify(SERVER));
const relay = (method: string) => calls.filter((c) => c.method === method);
/** The updates after the first, which is the place where the ride starts. */
const ridePosts = () => relay("POST").slice(1);
const channelOf = (url: string) => /\/share\/([A-Za-z0-9_-]{22})/.exec(url)![1]!;

/** The follower's side: the key from the link's fragment, the channel as associated data. */
async function read(link: string, update: { iv: string; ct: string }) {
  const [, channel, key] = /\/follow\/([A-Za-z0-9_-]{22})#([A-Za-z0-9_-]{43})$/.exec(link)!;
  const k = await webcrypto.subtle.importKey("raw", Buffer.from(key!, "base64url"), "AES-GCM", false, ["decrypt"]);
  const plain = await webcrypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(update.iv, "base64url"), additionalData: new TextEncoder().encode(channel) },
    k,
    Buffer.from(update.ct, "base64url"),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
const sharedLink = () =>
  ((Share.share as unknown as jest.Mock).mock.calls.at(-1)![0].message as string).replace("Follow my ride: ", "");

/** The sharing line lives with the buttons, folded away while riding: the grabber brings it. */
const unfold = async () => {
  await fireEvent.press(screen.getByLabelText("Show the ride buttons"));
  await flush();
};
const startGps = async (rb: PreparedRoadbook, share = true, folded = false) => {
  const here = at(rb, 100);
  location.state.position = { latitude: here[0], longitude: here[1] };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await flush();
  if (share) await fireEvent.press(screen.getByLabelText("Share this ride live"));
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  if (!folded) await unfold();
};
const push = (rb: PreparedRoadbook, m: number, kmh: number, ms: number) =>
  act(async () => {
    const p = at(rb, m);
    location.pushFix(p[0], p[1], kmh / 3.6, (clock += ms), 90);
  });

test("while riding the sharing line is folded away with the buttons, and the grabber brings it", async () => {
  withServer();
  await startGps(skippableRoadbook(), true, true);
  expect(screen.queryByText("Sharing live")).toBeNull();
  await unfold();
  expect(screen.getByText("Sharing live")).toBeTruthy();
});

test("without a server nothing of live sharing shows", async () => {
  await render(<RideScreen rb={skippableRoadbook()} onBack={() => {}} />);
  await flush();
  expect(screen.queryByLabelText("Share this ride live")).toBeNull();
});

test("with a server the ride can be shared before it starts, and the share sheet opens with the link", async () => {
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb);
  expect(relay("PUT")).toHaveLength(1);
  expect(relay("PUT")[0]!.url).toMatch(/^https:\/\/rides\.example\.org\/share\/[A-Za-z0-9_-]{22}$/);
  expect(relay("PUT")[0]!.auth).toBe(`Bearer ${TOKEN}`);
  expect(Share.share).toHaveBeenCalledTimes(1);
  const link = sharedLink();
  expect(link).toMatch(/^https:\/\/rides\.example\.org\/follow\/[A-Za-z0-9_-]{22}#[A-Za-z0-9_-]{43}$/);
  expect(channelOf(relay("PUT")[0]!.url)).toBe(/\/follow\/([A-Za-z0-9_-]{22})#/.exec(link)![1]);
  expect(screen.getByText("Sharing live")).toBeTruthy();
  // The key is in the fragment, not in anything sent to the server.
  const key = link.split("#")[1]!;
  expect(JSON.stringify(calls)).not.toContain(key);
});

test("the place where the ride starts is sent at once, as stopped, before any fix of the GPS", async () => {
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb);
  expect(relay("POST")).toHaveLength(1);
  const first = await read(sharedLink(), relay("POST")[0]!.body);
  expect(first.state).toBe("stopped");
  expect(first.name).toBe(rb.roadbook.name);
  expect(Math.abs(first.lat - at(rb, 100)[0])).toBeLessThan(1e-5);
});

test("a ride that is not shared sends nothing, and a demo is never shared", async () => {
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb, false);
  await push(rb, 200, 54, 2000);
  // Nothing of the ride goes to the server; the only call is the health check that tells whether it has traffic (spec traffic).
  expect(calls.filter((c) => !c.url.endsWith("/health"))).toHaveLength(0);
  expect(Share.share).not.toHaveBeenCalled();
});

test("a ride already under way can be shared, and again after stopping, each time with a new link", async () => {
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb, false);
  await push(rb, 200, 54, 2000);
  expect(screen.getByText("Not shared")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Share this ride live"));
  await flush();
  expect(relay("PUT")).toHaveLength(1);
  const first = sharedLink();
  expect(screen.getByText("Sharing live")).toBeTruthy();
  expect(screen.queryByText("Not shared")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Stop sharing"));
  await flush();
  expect(screen.getByText("Not shared")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Share this ride live"));
  await flush();
  expect(relay("PUT")).toHaveLength(2);
  expect(sharedLink()).not.toBe(first);
  expect(screen.getByText("Sharing live")).toBeTruthy();
});

test("each position is encrypted on the phone, every 30 s while riding, at once when stopped, and the server sees none", async () => {
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb);
  const link = sharedLink();
  await push(rb, 200, 54, 3000);
  expect(ridePosts()).toHaveLength(1);
  const first = ridePosts()[0]!;
  expect(first.url).toBe(relay("PUT")[0]!.url);
  expect(Object.keys(first.body).sort()).toEqual(["ct", "iv"]);
  const p1 = await read(link, first.body);
  expect(p1).toMatchObject({ v: 1, state: "riding", name: rb.roadbook.name, spd: 54, n: 2 });
  expect(Math.abs(p1.lat - at(rb, 200)[0])).toBeLessThan(1e-5);
  expect(JSON.stringify(first.body)).not.toContain(String(p1.lat));

  await push(rb, 300, 54, 10_000);
  expect(ridePosts()).toHaveLength(1);
  await push(rb, 400, 54, 21_000);
  expect(ridePosts()).toHaveLength(2);
  expect((await read(link, ridePosts()[1]!.body)).n).toBe(3);
  expect(ridePosts()[1]!.body.iv).not.toBe(first.body.iv);

  await push(rb, 400, 0, 5000);
  expect(ridePosts()).toHaveLength(3);
  expect((await read(link, ridePosts()[2]!.body)).state).toBe("stopped");
  await push(rb, 400, 0, 60_000);
  expect(ridePosts()).toHaveLength(3);
  await push(rb, 400, 0, 61_000);
  expect(ridePosts()).toHaveLength(4);
});

test("a position that came before the channel was ready is sent as soon as it is", async () => {
  withServer();
  let open: () => void = () => {};
  gate = new Promise<void>((resolve) => (open = resolve));
  const rb = skippableRoadbook();
  await startGps(rb);
  expect(relay("PUT")).toHaveLength(1);
  await push(rb, 200, 54, 3000);
  expect(relay("POST")).toHaveLength(0);
  await act(async () => open());
  await flush();
  expect(relay("POST")).toHaveLength(1);
  expect((await read(sharedLink(), relay("POST")[0]!.body)).state).toBe("riding");
});

test("a phone that stands still delivers no fixes: the last position goes again on the beat, as stopped, with its own age", async () => {
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb);
  const link = sharedLink();
  await push(rb, 200, 54, 3000);
  expect(ridePosts()).toHaveLength(1);
  const taken = clock;
  await act(async () => {
    jest.advanceTimersByTime(60_000);
  });
  await flush();
  expect(ridePosts()).toHaveLength(2);
  const again = await read(link, ridePosts()[1]!.body);
  expect(again.state).toBe("stopped");
  expect(again.t).toBe(taken);
  expect(again.s - again.t).toBeGreaterThanOrEqual(20_000);
  expect(again.n).toBe(3);
  // Then every two minutes while it stays still (the second was sent at 40 s), and not on every beat.
  await act(async () => {
    jest.advanceTimersByTime(70_000);
  });
  expect(ridePosts()).toHaveLength(2);
  await act(async () => {
    jest.advanceTimersByTime(40_000);
  });
  await flush();
  expect(ridePosts()).toHaveLength(3);
  // Ending the ride ends the beat.
  await endRide();
  await flush();
  const posts = ridePosts().length;
  await act(async () => {
    jest.advanceTimersByTime(300_000);
  });
  expect(ridePosts()).toHaveLength(posts);
});

test("a pause says stopped, and ending the ride says ended and ends the channel", async () => {
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb);
  const link = sharedLink();
  await push(rb, 200, 54, 3000);
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  await flush();
  const afterPause = ridePosts().at(-1)!;
  expect((await read(link, afterPause.body)).state).toBe("stopped");
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Resume the ride"));
  await flush();
  await endRide();
  await flush();
  const last = ridePosts().at(-1)!;
  expect((await read(link, last.body)).state).toBe("ended");
  expect(relay("DELETE")).toHaveLength(1);
  expect(relay("DELETE")[0]!.url).toMatch(/\?mode=end$/);
  expect(screen.queryByText("Sharing live")).toBeNull();
});

test("leaving the ride screen ends the channel too", async () => {
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb);
  await push(rb, 200, 54, 3000);
  await screen.unmount();
  await flush();
  expect(relay("DELETE")).toHaveLength(1);
});

test("the rider can send the link again, and stop sharing: the ride goes from the server at once and nothing more is sent", async () => {
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb);
  const link = sharedLink();
  await fireEvent.press(screen.getByLabelText("Send the link again"));
  expect(Share.share).toHaveBeenCalledTimes(2);
  expect(sharedLink()).toBe(link);
  await push(rb, 200, 54, 3000);
  const posts = ridePosts().length;
  await fireEvent.press(screen.getByLabelText("Stop sharing"));
  await flush();
  expect(relay("DELETE")).toHaveLength(1);
  expect(relay("DELETE")[0]!.url).toMatch(/\?mode=stop$/);
  expect(screen.queryByText("Sharing live")).toBeNull();
  await push(rb, 400, 54, 40_000);
  expect(ridePosts()).toHaveLength(posts);
  // The ride itself goes on, and sharing is no longer wanted: ending it sends nothing.
  await endRide();
  await flush();
  expect(relay("DELETE")).toHaveLength(1);
});

test("when the server cannot be reached the ride goes on, the line says so, and it resumes", async () => {
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb);
  answer = () => "down";
  await push(rb, 200, 54, 3000);
  await flush();
  expect(screen.getByText("Sharing is interrupted: trying again")).toBeTruthy();
  answer = () => ({ status: 200 });
  await push(rb, 300, 54, 31_000);
  await flush();
  expect(screen.getByText("Sharing live")).toBeTruthy();
});

test("a server that is down at the start is tried again; the link is offered only once it answers", async () => {
  withServer();
  const rb = skippableRoadbook();
  answer = () => "down";
  await startGps(rb);
  expect(screen.getByText("Sharing is interrupted: trying again")).toBeTruthy();
  expect(screen.queryByLabelText("Send the link again")).toBeNull();
  expect(Share.share).not.toHaveBeenCalled();
  answer = () => ({ status: 200 });
  await act(async () => {
    jest.advanceTimersByTime(10_000);
  });
  await flush();
  await unfold(); // the buttons fold away by themselves after a while
  expect(screen.getByText("Sharing live")).toBeTruthy();
  expect(Share.share).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Send the link again")).toBeTruthy();
});

test("the switch can be dragged as well as tapped", async () => {
  withServer();
  const rb = skippableRoadbook();
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await flush();
  const row = () => screen.getByLabelText("Share this ride live");
  expect(row().props.accessibilityState.checked).toBe(false);
  await fireEvent(screen.getByTestId("share-switch", { hidden: true }), "valueChange", true);
  expect(row().props.accessibilityState.checked).toBe(true);
  await fireEvent(screen.getByTestId("share-switch", { hidden: true }), "valueChange", false);
  expect(row().props.accessibilityState.checked).toBe(false);
});

test("a server that forgot the channel is given it again, and the update is sent once more", async () => {
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb);
  let first = true;
  answer = (c) => {
    if (c.method === "POST" && first) {
      first = false;
      return { status: 404 };
    }
    return { status: 200 };
  };
  await push(rb, 200, 54, 3000);
  await flush();
  expect(relay("PUT")).toHaveLength(2);
  expect(ridePosts()).toHaveLength(2);
  expect(screen.getByText("Sharing live")).toBeTruthy();
});

test("a token the server refuses is said, and nothing more is sent", async () => {
  withServer();
  answer = () => ({ status: 401 });
  const rb = skippableRoadbook();
  await startGps(rb);
  expect(screen.getByText("Sharing: the server refused the token")).toBeTruthy();
  expect(Share.share).not.toHaveBeenCalled();
  await push(rb, 200, 54, 3000);
  expect(relay("POST")).toHaveLength(0);
});

test("the Server screen saves an address and a token in the secure store, tests them and removes them", async () => {
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("Server"));
  await flush();
  await fireEvent.press(screen.getByLabelText("Save the server"));
  expect(screen.getByText(/address must be https/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Server address"), "http://rides.example.org");
  await fireEvent.changeText(screen.getByLabelText("Server token"), TOKEN);
  await fireEvent.press(screen.getByLabelText("Save the server"));
  expect(screen.getByText(/address must be https/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Server address"), "https://rides.example.org/");
  await fireEvent.changeText(screen.getByLabelText("Server token"), "nope");
  await fireEvent.press(screen.getByLabelText("Save the server"));
  expect(screen.getByText(/That is not a token/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Server token"), TOKEN);
  await fireEvent.press(screen.getByLabelText("Save the server"));
  await flush();
  expect(JSON.parse(stored.get("server-setting")!)).toEqual(SERVER);
  expect(screen.getByText("https://rides.example.org")).toBeTruthy();
  expect(screen.getByText("Token mrt_AA…AAAA")).toBeTruthy();
  expect(screen.queryByText(TOKEN)).toBeNull();

  await fireEvent.press(screen.getByLabelText("Test the server"));
  await flush();
  expect(screen.getByText("It works: the server accepted the token.")).toBeTruthy();
  // It is told just above the block with the Test button, not at the top of the screen.
  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf("It works: the server accepted the token.")).toBeLessThan(tree.indexOf("Your server"));
  expect(tree.indexOf("It works: the server accepted the token.")).toBeGreaterThan(
    tree.indexOf("What this server brings"),
  );
  expect(relay("PUT")).toHaveLength(1);
  expect(relay("DELETE")[0]!.url).toMatch(/\?mode=stop$/);
  answer = () => ({ status: 401 });
  await fireEvent.press(screen.getByLabelText("Test the server"));
  await flush();
  expect(screen.getByText("The server refused the token. Ask for a new one.")).toBeTruthy();
  answer = () => "down";
  await fireEvent.press(screen.getByLabelText("Test the server"));
  await flush();
  expect(screen.getByText(/could not be reached/)).toBeTruthy();

  await fireEvent.press(screen.getByLabelText("Remove the server"));
  await flush();
  expect(stored.has("server-setting")).toBe(false);
  expect(screen.queryByLabelText("Test the server")).toBeNull();
});

test("a server link asks first, names the address, and sets it only after a yes", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  initialUrl = `mobilemotoride://server?url=${encodeURIComponent("https://rides.example.org")}&token=${TOKEN}`;
  await render(<App />);
  await flush();
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert.mock.calls[0]![0]).toBe("Use this server?");
  expect(alert.mock.calls[0]![1]).toContain("https://rides.example.org");
  expect(stored.has("server-setting")).toBe(false);
  const buttons = alert.mock.calls[0]![2]!;
  await act(async () => {
    buttons.find((b) => b.text === "Use it")!.onPress!();
  });
  await flush();
  expect(JSON.parse(stored.get("server-setting")!)).toEqual(SERVER);
  expect(screen.getByText("Server set: https://rides.example.org")).toBeTruthy();
});

test("a link that is not acceptable, or answered no, sets nothing", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await render(<App />);
  await flush();
  await act(async () =>
    onUrl({ url: `mobilemotoride://server?url=${encodeURIComponent("http://evil.example.com")}&token=${TOKEN}` }),
  );
  await flush();
  expect(alert).not.toHaveBeenCalled();
  expect(screen.getByText("That is not a valid server link.")).toBeTruthy();
  await act(async () =>
    onUrl({ url: `mobilemotoride://server?url=${encodeURIComponent("https://rides.example.org")}&token=${TOKEN}` }),
  );
  const no = alert.mock.calls[0]![2]!.find((b) => b.text === "No")!;
  expect(no.onPress).toBeUndefined();
  expect(stored.has("server-setting")).toBe(false);
});

const CODE = "mri_" + "D".repeat(32);
const inviteLink = `mobilemotoride://server?url=${encodeURIComponent("https://rides.example.org")}&code=${CODE}`;
const enrols = () => relay("POST").filter((c) => c.url.endsWith("/enrol"));

test("an invitation opens the Server screen on it and sets nothing until the rider joins", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  initialUrl = inviteLink;
  answer = () => ({ status: 200, body: { token: TOKEN } });
  await render(<App />);
  await flush();
  expect(alert).not.toHaveBeenCalled();
  expect(screen.getByTestId("invitation")).toBeTruthy();
  expect(screen.getByText("https://rides.example.org")).toBeTruthy();
  expect(stored.has("server-setting")).toBe(false);
  expect(enrols()).toHaveLength(0);
  await fireEvent.press(screen.getByLabelText("Join the server"));
  await flush();
  expect(enrols()).toHaveLength(1);
  expect(enrols()[0]!.url).toBe("https://rides.example.org/enrol");
  expect(enrols()[0]!.body).toEqual({ code: CODE });
  expect(enrols()[0]!.auth).toBeUndefined();
  expect(JSON.parse(stored.get("server-setting")!)).toEqual(SERVER);
  expect(screen.queryByTestId("invitation")).toBeNull();
  expect(screen.getByText("Joined. The server is set: use Test to check it.")).toBeTruthy();
  expect(JSON.stringify([...stored.values()])).not.toContain(CODE);
});

test("an invitation with a PIN asks for it, says how many tries are left, and joins with the right one", async () => {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  initialUrl = inviteLink;
  answer = (c) => {
    const pin = c.body?.pin;
    if (pin === "123456") return { status: 200, body: { token: TOKEN } };
    return { status: 403, body: { error: "pin", triesLeft: pin === undefined ? 3 : 2 } };
  };
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Join the server"));
  await flush();
  expect(screen.getByText(/needs its PIN/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Invitation PIN"), "000000");
  await fireEvent.press(screen.getByLabelText("Join the server"));
  await flush();
  expect(screen.getByText("Not the right PIN. 2 tries left.")).toBeTruthy();
  expect(screen.getByTestId("invitation")).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Invitation PIN"), "12a3456");
  await fireEvent.press(screen.getByLabelText("Join the server"));
  await flush();
  expect(enrols().at(-1)!.body).toEqual({ code: CODE, pin: "123456" });
  expect(JSON.parse(stored.get("server-setting")!)).toEqual(SERVER);
});

test("an invitation that is burnt, no longer valid or out of reach says so and stays until put away", async () => {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  initialUrl = inviteLink;
  await render(<App />);
  await flush();
  const join = async () => {
    await fireEvent.press(screen.getByLabelText("Join the server"));
    await flush();
  };
  answer = () => ({ status: 403, body: { error: "locked" } });
  await join();
  expect(screen.getByText(/burnt/)).toBeTruthy();
  answer = () => ({ status: 404 });
  await join();
  expect(screen.getByText(/no longer valid/)).toBeTruthy();
  answer = () => "down";
  await join();
  expect(screen.getByText(/could not be reached/)).toBeTruthy();
  expect(stored.has("server-setting")).toBe(false);
  expect(screen.getByTestId("invitation")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Put the invitation away"));
  expect(screen.queryByTestId("invitation")).toBeNull();
});

test("an invitation with a bad address or code is refused, and a link while the app runs opens the screen too", async () => {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await render(<App />);
  await flush();
  await act(async () =>
    onUrl({ url: `mobilemotoride://server?url=${encodeURIComponent("http://evil.example.com")}&code=${CODE}` }),
  );
  await flush();
  expect(screen.getByText("That is not a valid invitation.")).toBeTruthy();
  expect(screen.queryByTestId("invitation")).toBeNull();
  await act(async () => onUrl({ url: inviteLink }));
  await flush();
  expect(screen.getByTestId("invitation")).toBeTruthy();
});

// Spec crash-detection: a possible crash is marked on a live ride, with the position, until the rider says they are fine (whoever has the page open sees it).
import { Accelerometer, resetSensors } from "./sensors.mock.ts";

/** Is this a request to the test share server? Compares the origin, not a prefix of the text. */
const isShareServer = (url: string): boolean => {
  try {
    return new URL(url).origin === "https://rides.example.org";
  } catch {
    return false;
  }
};

const UP = { x: 0, y: 1, z: 0 };
const LYING_DOWN = { x: 1, y: 0.05, z: 0 };
/** A second of riding: a position at `m`, and the accelerometer 20 times (the first two a shock when `shock` is set). */
const secondOfRide = async (rb: PreparedRoadbook, m: number, kmh: number, accel = UP, shock = 0) => {
  await push(rb, m, kmh, 1000);
  for (let k = 0; k < 20; k++) {
    await act(async () => {
      Accelerometer.emit(shock && k < 2 ? { x: shock * 0.6, y: shock * 0.8, z: 0 } : accel);
      jest.advanceTimersByTime(50);
    });
  }
};
const crashed = async (rb: PreparedRoadbook) => {
  for (let i = 0; i < 10; i++) await secondOfRide(rb, 200 + i * 20, 72);
  await secondOfRide(rb, 420, 72, LYING_DOWN, 8);
  for (let i = 0; i < 16; i++) await secondOfRide(rb, 430, 0, LYING_DOWN);
};

test("a crash is told to the followers with the state alert and the position, at once and every 30 s, and 'I'm OK' says all is well", async () => {
  resetSensors();
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb);
  const link = sharedLink();
  await crashed(rb);
  await act(async () => {
    jest.advanceTimersByTime(31_000); // the countdown runs out
  });
  await flush();
  expect(
    screen.getByText(
      "Your live ride now shows a possible crash and your position to anyone who has its page open. Nobody was called or texted.",
    ),
  ).toBeTruthy();
  const states = await Promise.all(relay("POST").map(async (c) => (await read(link, c.body)).state));
  const firstAlert = states.indexOf("alert");
  expect(firstAlert).toBeGreaterThan(0);
  const alerts = relay("POST").slice(firstAlert);
  const last = await read(link, alerts.at(-1)!.body);
  expect(last.state).toBe("alert");
  expect(Math.abs(last.lat - at(rb, 430)[0])).toBeLessThan(1e-4);

  // Another every 30 s while the alert stands.
  const count = relay("POST").length;
  await act(async () => {
    jest.advanceTimersByTime(35_000);
  });
  await flush();
  expect(relay("POST").length).toBeGreaterThan(count);
  expect((await read(link, relay("POST").at(-1)!.body)).state).toBe("alert");

  // I'm OK: the next update says the rider is back to normal, at once.
  await fireEvent.press(screen.getByTestId("crash-ok"));
  await flush();
  const after = await read(link, relay("POST").at(-1)!.body);
  expect(after.state).not.toBe("alert");
});

test("a crash on a ride that is not shared tells no one: the screen says so", async () => {
  resetSensors();
  withServer();
  const rb = skippableRoadbook();
  await startGps(rb, false);
  await crashed(rb);
  await act(async () => {
    jest.advanceTimersByTime(31_000);
  });
  await flush();
  expect(screen.getByText("No one was told automatically. Send the message or call.")).toBeTruthy();
  expect(relay("POST")).toHaveLength(0);
});
