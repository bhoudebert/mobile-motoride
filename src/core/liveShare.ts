import { gcm } from "@noble/ciphers/aes.js";
import type { Fix } from "./types.ts";

/** Live sharing of a ride, the phone's side (spec live-share, ADR 0029; the relay is agentRide's, ADR 0028). */

export type RandomBytes = (n: number) => Uint8Array;

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function toB64url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63]!;
    if (i + 2 < bytes.length) out += B64[n & 63]!;
  }
  return out;
}

export function fromB64url(text: string): Uint8Array {
  const bytes: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const c of text) {
    const v = B64.indexOf(c);
    if (v < 0) throw new Error("not base64url");
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 255);
    }
  }
  return Uint8Array.from(bytes);
}

/** A channel: 128 random bits, 22 characters (the relay checks the same shape). */
export const newChannel = (random: RandomBytes): string => toB64url(random(16));
/** A key: 256 random bits, 43 characters; it belongs in the link's fragment and nowhere else. */
export const newKey = (random: RandomBytes): string => toB64url(random(32));

/** The link a follower opens: the key is in the fragment, which a browser never sends to a server. */
export const followLink = (server: string, channel: string, key: string): string =>
  `${server}/follow/${channel}#${key}`;

/** One update in the clear, before it is encrypted. */
export interface LivePoint {
  v: 1;
  n: number;
  t: number;
  lat: number;
  lon: number;
  spd: number | null;
  hdg: number | null;
  acc: number | null;
  /** "alert": the phone thinks the rider crashed and has not been told otherwise (spec crash-detection). */
  state: "riding" | "stopped" | "ended" | "alert";
  name: string;
  /** When it was sent, by the phone's clock: with `t` it tells how old the position was, whatever clock a follower has. */
  s: number;
}

/** Encrypt an update the way the follower's page reads it: AES-256-GCM, a fresh nonce, the channel as associated data. */
export function encryptPoint(
  key: string,
  channel: string,
  point: LivePoint,
  random: RandomBytes,
): { iv: string; ct: string } {
  const iv = random(12);
  const aes = gcm(fromB64url(key), iv, new TextEncoder().encode(channel));
  const ct = aes.encrypt(new TextEncoder().encode(JSON.stringify(point)));
  return { iv: toB64url(iv), ct: toB64url(ct) };
}

/** Moving at this speed or more counts as riding. */
export const MOVING_MPS = 1;
export const MOVING_EVERY_MS = 30_000;
export const STOPPED_EVERY_MS = 120_000;
/** Never faster than the relay takes updates (one every 2 seconds). */
export const MIN_GAP_MS = 2_500;

export const stateOf = (fix: Fix): "riding" | "stopped" => ((fix.speedMps ?? 0) >= MOVING_MPS ? "riding" : "stopped");

/** Whether it is time to send the position: at once the first time, when riding turns to stopped or back, else on the beat. */
export function due(
  last: { at: number; state: "riding" | "stopped" | "ended" | "alert" } | null,
  fix: Fix,
  now: number,
): boolean {
  if (!last) return true;
  const gap = now - last.at;
  if (gap < MIN_GAP_MS) return false;
  if (stateOf(fix) !== last.state) return true;
  return gap >= (last.state === "riding" ? MOVING_EVERY_MS : STOPPED_EVERY_MS);
}

export function pointOf(
  fix: Fix,
  state: LivePoint["state"],
  name: string,
  n: number,
  sentAt: number = fix.time,
): LivePoint {
  const round = (x: number | null | undefined, digits = 0) =>
    x === null || x === undefined || !Number.isFinite(x) || x < 0 ? null : Number(x.toFixed(digits));
  return {
    v: 1,
    n,
    t: fix.time,
    lat: Number(fix.lat.toFixed(6)),
    lon: Number(fix.lon.toFixed(6)),
    spd: fix.speedMps === null ? null : round(fix.speedMps * 3.6),
    hdg: round(fix.headingDeg),
    acc: round(fix.accuracyM),
    state,
    name,
    s: sentAt,
  };
}

const TOKEN = /^mrt_[A-Za-z0-9_-]{20,100}$/;

/** `http` is for this phone and local networks only: a token must not cross the internet in the clear. */
function isLocalHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".local")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** A server address as `https://host[:port]`, no path, or null when it is not one the app will send a token to. */
export function normalizeServer(address: string): string | null {
  const m = /^(https?):\/\/([A-Za-z0-9.-]+)(?::(\d{1,5}))?\/*$/i.exec(address.trim());
  if (!m) return null;
  const scheme = m[1]!.toLowerCase();
  const host = m[2]!.toLowerCase();
  if (scheme === "http" && !isLocalHost(host)) return null;
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) return null;
  return `${scheme}://${host}${m[3] ? `:${m[3]}` : ""}`;
}

export const isTokenShaped = (token: string): boolean => TOKEN.test(token);

export interface ServerSetting {
  url: string;
  token: string;
}

export const isServerLink = (link: string): boolean => /^mobilemotoride:\/\/server\b/i.test(link);

/** The setting a `mobilemotoride://server?url=…&token=…` link carries; null when either part is not acceptable. */
export function parseServerLink(link: string): ServerSetting | null {
  const m = /^mobilemotoride:\/\/server\?(.*)$/i.exec(link);
  if (!m) return null;
  const params = new URLSearchParams(m[1]);
  const url = normalizeServer(params.get("url") ?? "");
  const token = (params.get("token") ?? "").trim();
  return url && isTokenShaped(token) ? { url, token } : null;
}

/** An invitation: the server it is for and the one-time code (agentRide's ADR 0029). */
export interface Invitation {
  url: string;
  code: string;
}
const INVITE_CODE = /^mri_[A-Za-z0-9_-]{32}$/;
export const isInviteCode = (code: string): boolean => INVITE_CODE.test(code);

/** The invitation a `mobilemotoride://server?url=…&code=…` link carries; null when either part is not acceptable. */
export function parseInviteLink(link: string): Invitation | null {
  const m = /^mobilemotoride:\/\/server\?(.*)$/i.exec(link);
  if (!m) return null;
  const params = new URLSearchParams(m[1]);
  const url = normalizeServer(params.get("url") ?? "");
  const code = (params.get("code") ?? "").trim();
  return url && isInviteCode(code) ? { url, code } : null;
}

/** A token for the screen: its start and its end, never the whole of it. */
export const maskToken = (token: string): string =>
  token.length > 12 ? `${token.slice(0, 6)}…${token.slice(-4)}` : "…";
