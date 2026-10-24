import assert from "node:assert/strict";
import { test } from "node:test";
import { joinServer } from "../src/services/enrol.ts";

const invitation = { url: "https://rides.example.org", code: "mri_" + "C".repeat(32) };
const reply = (status: number, body: unknown = {}) =>
  (async () => ({ ok: status < 300, status, json: async () => body })) as unknown as typeof fetch;

test("a code is sent to /enrol, with the PIN only when there is one, and the token comes back", async () => {
  const seen: Array<{ url: string; body: unknown }> = [];
  const f = (async (url: string, init: { body: string }) => {
    seen.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({ token: "mrt_x" }) };
  }) as unknown as typeof fetch;
  assert.deepEqual(await joinServer(invitation, "", f), { ok: true, token: "mrt_x" });
  assert.deepEqual(seen[0], { url: "https://rides.example.org/enrol", body: { code: invitation.code } });
  await joinServer(invitation, "123456", f);
  assert.deepEqual(seen[1]!.body, { code: invitation.code, pin: "123456" });
});

test("what the server says is told apart: a PIN wanted or wrong, burnt, no longer valid, busy, down, odd", async () => {
  assert.deepEqual(await joinServer(invitation, "", reply(403, { error: "pin", triesLeft: 3 })), {
    ok: false,
    reason: "pin",
    triesLeft: 3,
  });
  assert.deepEqual(await joinServer(invitation, "1", reply(403, { error: "pin" })), {
    ok: false,
    reason: "pin",
    triesLeft: 0,
  });
  assert.deepEqual(await joinServer(invitation, "1", reply(403, { error: "locked" })), { ok: false, reason: "locked" });
  assert.deepEqual(await joinServer(invitation, "", reply(403, {})), { ok: false, reason: "failed" });
  assert.deepEqual(await joinServer(invitation, "", reply(404)), { ok: false, reason: "invalid" });
  assert.deepEqual(await joinServer(invitation, "", reply(429)), { ok: false, reason: "busy" });
  assert.deepEqual(await joinServer(invitation, "", reply(500)), { ok: false, reason: "failed" });
  assert.deepEqual(await joinServer(invitation, "", reply(200, { nope: 1 })), { ok: false, reason: "failed" });
  const down = (async () => {
    throw new TypeError("Network request failed");
  }) as unknown as typeof fetch;
  assert.deepEqual(await joinServer(invitation, "", down), { ok: false, reason: "unreachable" });
});
