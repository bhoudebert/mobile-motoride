import type { RandomBytes } from "./liveShare.ts";

/** What the sidecar says about the rider's hosted server, and the steps of getting one (spec hosted-server). */

export type PlanKind = "free" | "paid" | "premium";

export interface Plan {
  id: string;
  kind: PlanKind;
  /** The rider can choose it now; a plan that is not (Premium) is shown as coming later. */
  available: boolean;
  /** The store products of a paid plan. */
  products: { apple?: string; google?: string };
  entitlements: { traffic?: string; trafficPerDay?: number; libraryMb?: number; requestsPerMinute?: number };
  /** A launch offer the sidecar describes (free plan only): the regular yearly price in euros, and its own wording. */
  launchOffer: { regularPriceEur: number; text: string } | null;
}

export type AccountState = "none" | "pending" | "ready" | "suspended" | "ended";

export interface HostedStatus {
  state: AccountState;
  /** The link of the invitation to join the server, when the sidecar gave one. */
  invitationLink: string | null;
  suspended: { reason: string; until: string | null } | null;
  rejected: string | null;
  /** A short code to quote when asking for help; null until the sidecar gives one. */
  supportCode: string | null;
}

const STATES: readonly string[] = ["none", "pending", "ready", "suspended", "ended"];
const KINDS: readonly string[] = ["free", "paid", "premium"];
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** The answer of any sidecar call that gives an account status; null when it is not one. */
export function parseStatus(body: unknown): HostedStatus | null {
  if (!isObject(body) || typeof body.state !== "string" || !STATES.includes(body.state)) return null;
  const inv = body.invitation;
  const sus = body.suspended;
  return {
    state: body.state as AccountState,
    invitationLink: isObject(inv) && typeof inv.link === "string" ? inv.link : null,
    suspended:
      isObject(sus) && typeof sus.reason === "string"
        ? { reason: sus.reason, until: typeof sus.until === "string" ? sus.until : null }
        : null,
    rejected: typeof body.rejected === "string" ? body.rejected : null,
    supportCode: typeof body.supportCode === "string" && body.supportCode ? body.supportCode : null,
  };
}

/** The plans the sidecar lists, in its order; entries that are not plans are left out. */
export function parsePlans(body: unknown): Plan[] {
  if (!isObject(body) || !Array.isArray(body.plans)) return [];
  const plans: Plan[] = [];
  for (const p of body.plans) {
    if (!isObject(p) || typeof p.id !== "string" || typeof p.kind !== "string" || !KINDS.includes(p.kind)) continue;
    const products = isObject(p.products) ? p.products : {};
    const e = isObject(p.entitlements) ? p.entitlements : {};
    const offer = isObject(p.launchOffer) ? p.launchOffer : null;
    plans.push({
      id: p.id,
      kind: p.kind as PlanKind,
      available: p.available === true,
      launchOffer:
        offer && typeof offer.regularPriceEur === "number" && typeof offer.text === "string"
          ? { regularPriceEur: offer.regularPriceEur, text: offer.text }
          : null,
      products: {
        ...(typeof products.apple === "string" ? { apple: products.apple } : {}),
        ...(typeof products.google === "string" ? { google: products.google } : {}),
      },
      entitlements: {
        ...(typeof e.traffic === "string" ? { traffic: e.traffic } : {}),
        ...(typeof e.trafficPerDay === "number" ? { trafficPerDay: e.trafficPerDay } : {}),
        ...(typeof e.libraryMb === "number" ? { libraryMb: e.libraryMb } : {}),
        ...(typeof e.requestsPerMinute === "number" ? { requestsPerMinute: e.requestsPerMinute } : {}),
      },
    });
  }
  return plans;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isAccountToken = (s: string): boolean => UUID_V4.test(s);

/** A random version 4 UUID: the account token the store carries with a purchase (ADR 0047). */
export function newAccountToken(random: RandomBytes): string {
  const b = random(16).slice();
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The steps shown while a server is set up, in order. */
export const SETUP_STEPS = ["creating", "connecting"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** After the first ask, the status is polled this often, for this long, before the screen says it takes longer. */
export const STATUS_EVERY_MS = 2_000;
export const SETUP_SLOW_MS = 20_000;

/** What the rider's server says they may use and have used (agentRide's `GET /me`). */
export interface Me {
  hosted: boolean;
  /** An opaque reference to the rider, the same on every phone of theirs; null from a server that does not give one. */
  riderRef: string | null;
  /** Paused: the subscription lapsed or billing is being retried; the library is kept until `until` when it is known. */
  suspended: { reason: string; until: string | null } | null;
  traffic: { mode: string; perDay: number | null; usedToday: number; provider: "open" | "tomtom" | null };
  library: { limitMb: number | null; usedBytes: number };
}

export function parseMe(body: unknown): Me | null {
  if (!isObject(body) || !isObject(body.traffic) || !isObject(body.library)) return null;
  const sus = body.suspended;
  const traffic = body.traffic;
  const library = body.library;
  if (typeof traffic.mode !== "string") return null;
  return {
    hosted: body.hosted === true,
    riderRef: typeof body.riderRef === "string" && body.riderRef ? body.riderRef : null,
    suspended:
      isObject(sus) && typeof sus.reason === "string"
        ? { reason: sus.reason, until: typeof sus.until === "string" ? sus.until : null }
        : null,
    traffic: {
      mode: traffic.mode,
      perDay: typeof traffic.perDay === "number" ? traffic.perDay : null,
      usedToday: typeof traffic.usedToday === "number" ? traffic.usedToday : 0,
      provider: traffic.provider === "open" || traffic.provider === "tomtom" ? traffic.provider : null,
    },
    library: {
      limitMb: typeof library.limitMb === "number" ? library.limitMb : null,
      usedBytes: typeof library.usedBytes === "number" ? library.usedBytes : 0,
    },
  };
}

/** Traffic requests left today; null when there is no daily limit or traffic is off. */
export const trafficLeft = (me: Me): number | null =>
  me.traffic.mode === "off" || me.traffic.perDay === null
    ? null
    : Math.max(0, me.traffic.perDay - me.traffic.usedToday);

/** The one-time code that connects ChatGPT or Claude to the rider's server (agentRide `POST /oauth/link-code`). */
export function parseLinkCode(body: unknown): { code: string; expiresAt: string } | null {
  if (!isObject(body) || typeof body.code !== "string" || typeof body.expiresAt !== "string") return null;
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(body.code) ? { code: body.code, expiresAt: body.expiresAt } : null;
}

/**
 * Where the traffic comes from: the plan's own (`open` or `tomtom`), else the provider the server says it uses when the plan
 * leaves it to the host (`host`), else unknown (null) for a server that does not say.
 */
export const trafficSource = (me: Me): "open" | "tomtom" | null =>
  me.traffic.mode === "open" || me.traffic.mode === "tomtom" ? me.traffic.mode : me.traffic.provider;
