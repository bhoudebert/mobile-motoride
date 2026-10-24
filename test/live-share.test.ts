import assert from "node:assert/strict";
import { randomBytes, webcrypto } from "node:crypto";
import { test } from "node:test";
import {
  due,
  encryptPoint,
  followLink,
  fromB64url,
  isServerLink,
  isTokenShaped,
  maskToken,
  newChannel,
  newKey,
  normalizeServer,
  parseInviteLink,
  parseServerLink,
  pointOf,
  stateOf,
  toB64url,
  type LivePoint,
} from "../src/core/liveShare.ts";
import type { Fix } from "../src/core/types.ts";

const random = (n: number) => new Uint8Array(randomBytes(n));
const fix = (over: Partial<Fix> = {}): Fix => ({
  lat: 50.4512345678,
  lon: 3.2077,
  speedMps: 15,
  headingDeg: 91.4,
  accuracyM: 4.6,
  time: 1_000_000,
  ...over,
});

test("base64url is the one the relay and the page speak, and reads back", () => {
  for (const n of [0, 1, 2, 3, 12, 16, 31, 32, 100]) {
    const bytes = random(n);
    assert.equal(toB64url(bytes), Buffer.from(bytes).toString("base64url"), `${n} bytes`);
    assert.deepEqual(fromB64url(toB64url(bytes)), bytes);
  }
  assert.throws(() => fromB64url("a+b"), /not base64url/);
});

test("a channel is 22 characters and a key 43, both random", () => {
  assert.match(newChannel(random), /^[A-Za-z0-9_-]{22}$/);
  assert.match(newKey(random), /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(newKey(random), newKey(random));
  assert.equal(followLink("https://rides.example.org", "chan", "key"), "https://rides.example.org/follow/chan#key");
});

const point = (over: Partial<LivePoint> = {}): LivePoint => ({
  v: 1,
  n: 3,
  t: 99,
  s: 120,
  lat: 50.45,
  lon: 3.2,
  spd: 54,
  hdg: 91,
  acc: 5,
  state: "riding",
  name: "To Mons",
  ...over,
});

test("what the phone encrypts is what a browser's WebCrypto decrypts, with the channel as associated data", async () => {
  const channel = newChannel(random);
  const key = newKey(random);
  const { iv, ct } = encryptPoint(key, channel, point(), random);
  const k = await webcrypto.subtle.importKey("raw", Buffer.from(key, "base64url"), "AES-GCM", false, ["decrypt"]);
  const plain = await webcrypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(iv, "base64url"), additionalData: new TextEncoder().encode(channel) },
    k,
    Buffer.from(ct, "base64url"),
  );
  assert.deepEqual(JSON.parse(new TextDecoder().decode(plain)), point());
  // Another channel, or a flipped bit, does not decrypt: the page would show nothing, never a wrong place.
  await assert.rejects(
    webcrypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(iv, "base64url"), additionalData: new TextEncoder().encode("other") },
      k,
      Buffer.from(ct, "base64url"),
    ),
  );
});

test("each update has its own nonce, and the ciphertext holds nothing readable", () => {
  const channel = newChannel(random);
  const key = newKey(random);
  const a = encryptPoint(key, channel, point(), random);
  const b = encryptPoint(key, channel, point(), random);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ct, b.ct);
  assert.match(a.iv, /^[A-Za-z0-9_-]{16}$/);
  const clear = Buffer.from(a.ct, "base64url").toString("latin1");
  assert.ok(!clear.includes("50.45") && !clear.includes("To Mons"));
  assert.ok(a.ct.length < 2731, "well under the relay's limit");
});

test("the position sent is rounded, in km/h, and leaves out what is not known", () => {
  const p = pointOf(fix(), "riding", "To Mons", 7);
  assert.deepEqual(p, {
    v: 1,
    n: 7,
    t: 1_000_000,
    s: 1_000_000,
    lat: 50.451235,
    lon: 3.2077,
    spd: 54,
    hdg: 91,
    acc: 5,
    state: "riding",
    name: "To Mons",
  });
  assert.equal(pointOf(fix(), "stopped", "x", 1, 1_050_000).s, 1_050_000, "when it was sent, by the phone's clock");
  const unknown = pointOf(fix({ speedMps: null, headingDeg: -1, accuracyM: null }), "stopped", "x", 1);
  assert.equal(unknown.spd, null);
  assert.equal(unknown.hdg, null);
  assert.equal(unknown.acc, null);
});

test("an update is due at once, when moving turns to stopped, and on the beat: 30 s riding, 2 min stopped", () => {
  const moving = fix({ speedMps: 15 });
  const still = fix({ speedMps: 0 });
  assert.equal(stateOf(moving), "riding");
  assert.equal(stateOf(still), "stopped");
  assert.equal(due(null, moving, 0), true);
  assert.equal(due({ at: 0, state: "riding" }, moving, 10_000), false);
  assert.equal(due({ at: 0, state: "riding" }, moving, 30_000), true);
  assert.equal(due({ at: 0, state: "riding" }, still, 10_000), true, "stopping is said at once");
  assert.equal(due({ at: 0, state: "stopped" }, still, 60_000), false);
  assert.equal(due({ at: 0, state: "stopped" }, still, 120_000), true);
  assert.equal(due({ at: 0, state: "stopped" }, moving, 10_000), true, "moving off is said at once");
  assert.equal(due({ at: 0, state: "riding" }, still, 1000), false, "never faster than the relay takes them");
});

test("a server address is https, or http only for this phone and local networks, with no path", () => {
  assert.equal(normalizeServer("https://Rides.Example.org/"), "https://rides.example.org");
  assert.equal(normalizeServer("https://rides.example.org:8443"), "https://rides.example.org:8443");
  for (const ok of [
    "http://localhost:8788",
    "http://127.0.0.1:8788",
    "http://192.168.1.20:8788",
    "http://10.0.0.5",
    "http://172.20.1.1",
    "http://mini.local:8788",
  ])
    assert.ok(normalizeServer(ok), ok);
  for (const bad of [
    "http://rides.example.org",
    "http://8.8.8.8",
    "http://172.32.0.1",
    "ftp://x.org",
    "https://",
    "rides.example.org",
    "https://a b.org",
    "https://rides.example.org/mcp",
    "javascript:alert(1)",
    "https://..x.org",
    "",
  ])
    assert.equal(normalizeServer(bad), null, bad);
});

test("a server link carries an address and a token, and nothing else is accepted", () => {
  const token = "mrt_" + "A".repeat(43);
  assert.deepEqual(
    parseServerLink(`mobilemotoride://server?url=${encodeURIComponent("https://rides.example.org/")}&token=${token}`),
    {
      url: "https://rides.example.org",
      token,
    },
  );
  assert.equal(isServerLink("mobilemotoride://server?x=1"), true);
  assert.equal(isServerLink("mobilemotoride://import?url=x"), false);
  for (const bad of [
    `mobilemotoride://server?url=${encodeURIComponent("http://rides.example.org")}&token=${token}`,
    `mobilemotoride://server?url=${encodeURIComponent("https://rides.example.org")}&token=short`,
    `mobilemotoride://server?url=${encodeURIComponent("https://rides.example.org")}`,
    "mobilemotoride://server",
    "mobilemotoride://replay/ride",
  ])
    assert.equal(parseServerLink(bad), null, bad);
  assert.equal(isTokenShaped(token), true);
  assert.equal(isTokenShaped("abc"), false);
  assert.equal(maskToken(token), "mrt_AA…AAAA");
  assert.ok(!maskToken(token).includes("A".repeat(10)));
  assert.equal(maskToken("short"), "…");
});

test("an invitation link carries an address and a one-time code, and nothing else is accepted", () => {
  const code = "mri_" + "B".repeat(32);
  const link = (url: string, c: string) => `mobilemotoride://server?url=${encodeURIComponent(url)}&code=${c}`;
  assert.deepEqual(parseInviteLink(link("https://rides.example.org/", code)), {
    url: "https://rides.example.org",
    code,
  });
  for (const bad of [
    link("http://rides.example.org", code),
    link("https://rides.example.org", "mri_short"),
    link("https://rides.example.org", "mrt_" + "B".repeat(32)),
    `mobilemotoride://server?url=${encodeURIComponent("https://rides.example.org")}`,
    "mobilemotoride://import?url=x",
  ])
    assert.equal(parseInviteLink(bad), null, bad);
});
