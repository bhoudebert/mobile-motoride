import assert from "node:assert/strict";
import { test } from "node:test";
import { isAccountToken, newAccountToken, parsePlans, parseStatus } from "../src/core/hosted.ts";
import { accountStatus, createFreeAccount, deleteAccount, listPlans, reinvite } from "../src/services/sidecar.ts";

const reply = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k] ?? null },
    json: async () => body,
  }) as unknown as Response;
const fake = (r: Response, seen: { url?: string; init?: RequestInit } = {}) =>
  (async (url: string, init: RequestInit) => {
    seen.url = url;
    seen.init = init;
    return r;
  }) as unknown as typeof fetch;

test("an account token is a version 4 uuid, and two are not alike", () => {
  const random = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));
  const a = newAccountToken(random);
  assert.equal(isAccountToken(a), true);
  assert.notEqual(a, newAccountToken(random));
  assert.equal(isAccountToken("mrt_nope"), false);
});

test("a status is read with its invitation link, its suspension and its rejection", () => {
  assert.deepEqual(
    parseStatus({ state: "ready", invitation: { code: "c", link: "mobilemotoride://x", expiresAt: "t" } }),
    {
      state: "ready",
      invitationLink: "mobilemotoride://x",
      suspended: null,
      rejected: null,
    },
  );
  assert.deepEqual(parseStatus({ state: "suspended", suspended: { reason: "lapsed", until: null } })?.suspended, {
    reason: "lapsed",
    until: null,
  });
  assert.equal(parseStatus({ state: "banana" }), null);
  assert.equal(parseStatus(null), null);
});

test("plans are read as they come, Premium not available, junk left out", () => {
  const plans = parsePlans({
    plans: [
      { id: "free", kind: "free", available: true, entitlements: { traffic: "open", libraryMb: 50 } },
      { id: "premium", kind: "premium", available: false, entitlements: {} },
      { id: "x", kind: "gold" },
      "no",
    ],
  });
  assert.deepEqual(
    plans.map((p) => [p.id, p.available]),
    [
      ["free", true],
      ["premium", false],
    ],
  );
  assert.equal(plans[0]!.entitlements.libraryMb, 50);
});

test("the free account is asked with the token in the body, the status with it in the header only", async () => {
  const seen: { url?: string; init?: RequestInit } = {};
  const got = await createFreeAccount("https://s.example", "tok", {
    fetchImpl: fake(reply(200, { state: "pending" }), seen),
  });
  assert.equal(got.ok && got.value.state, "pending");
  assert.equal(seen.url, "https://s.example/v1/accounts");
  assert.deepEqual(JSON.parse(String(seen.init!.body)), { accountToken: "tok" });
  await accountStatus("https://s.example", "tok", { fetchImpl: fake(reply(200, { state: "ready" }), seen) });
  assert.equal(seen.url, "https://s.example/v1/account/status");
  assert.equal((seen.init!.headers as Record<string, string>).Authorization, "AccountToken tok");
  assert.equal(seen.init!.body, undefined);
});

test("each failure has its reason", async () => {
  const f = (r: Response) => ({ fetchImpl: fake(r) });
  assert.deepEqual(await reinvite("https://s", "t", false, f(reply(429, {}, { "Retry-After": "12" }))), {
    ok: false,
    reason: "busy",
    retryAfterS: 12,
  });
  assert.equal((await createFreeAccount("https://s", "t", f(reply(503, { error: "free_unavailable" })))).ok, false);
  assert.equal((await createFreeAccount("https://s", "t", f(reply(503)))).ok === false && "unavailable", "unavailable");
  const r = await reinvite("https://s", "t", false, f(reply(409)));
  assert.equal(!r.ok && r.reason, "suspended");
  assert.equal((await listPlans("https://s", f(reply(200, { plans: [] })))).ok, false);
  const down = (async () => {
    throw new Error("x");
  }) as unknown as typeof fetch;
  const u = await accountStatus("https://s", "t", { fetchImpl: down });
  assert.equal(!u.ok && u.reason, "unreachable");
  const bad = await accountStatus("https://s", "t", { fetchImpl: fake(reply(200, { state: "nope" })) });
  assert.equal(!bad.ok && bad.reason, "failed");
  assert.equal((await deleteAccount("https://s", "t", f(reply(200, { state: "ended" })))).ok, true);
});

import { parseLinkCode, parseMe, trafficLeft } from "../src/core/hosted.ts";
import { getMe, linkCode } from "../src/services/hostedServer.ts";

test("what the rider may use is read, with the traffic left and a pause", () => {
  const me = parseMe({
    hosted: true,
    traffic: { mode: "open", perDay: 100, usedToday: 40 },
    library: { limitMb: 50, usedBytes: 2_097_152 },
    requestsPerMinute: 60,
  })!;
  assert.equal(trafficLeft(me), 60);
  assert.equal(me.library.usedBytes, 2_097_152);
  const paused = parseMe({
    traffic: { mode: "off", perDay: null, usedToday: 0 },
    library: { limitMb: null, usedBytes: 0 },
    suspended: { reason: "lapsed", until: null },
  })!;
  assert.equal(paused.suspended?.reason, "lapsed");
  assert.equal(trafficLeft(paused), null);
  assert.equal(parseMe({ traffic: {} }), null);
  assert.equal(trafficLeft({ ...me, traffic: { mode: "open", perDay: 10, usedToday: 50 } }), 0);
});

test("a link code is XXXX-XXXX with its expiry", () => {
  assert.deepEqual(parseLinkCode({ code: "K7QM-4X2P", expiresAt: "t" }), { code: "K7QM-4X2P", expiresAt: "t" });
  assert.equal(parseLinkCode({ code: "k7qm", expiresAt: "t" }), null);
});

test("the server is asked with the phone's token; a 401 is told from a pause and from a failure", async () => {
  const seen: { url?: string; init?: RequestInit } = {};
  const server = { url: "https://rides.example.org", token: "mrt_x" };
  const body = { traffic: { mode: "open", perDay: null, usedToday: 0 }, library: { limitMb: null, usedBytes: 0 } };
  assert.equal((await getMe(server, fake(reply(200, body), seen))).ok, true);
  assert.equal(seen.url, "https://rides.example.org/me");
  assert.equal((seen.init!.headers as Record<string, string>).Authorization, "Bearer mrt_x");
  const refused = await getMe(server, fake(reply(401)));
  assert.equal(!refused.ok && refused.reason, "refused");
  const code = await linkCode(server, fake(reply(200, { code: "K7QM-4X2P", expiresAt: "t" }), seen));
  assert.equal(code.ok && code.value.code, "K7QM-4X2P");
  assert.equal(seen.init!.method, "POST");
  const busy = await linkCode(server, fake(reply(429)));
  assert.equal(!busy.ok && busy.reason, "busy");
});
