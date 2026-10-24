import {
  MOVING_EVERY_MS,
  due,
  encryptPoint,
  followLink,
  newChannel,
  newKey,
  pointOf,
  stateOf,
  type RandomBytes,
  type ServerSetting,
} from "../core/liveShare.ts";
import type { Fix } from "../core/types.ts";
import { closeChannel, createChannel, publish, type RelayResult } from "../services/relay.ts";

/** How often the beat is checked, and how old a position is before it is said to be a stopped rider's. */
const HEARTBEAT_MS = 10_000;
const STALE_FIX_MS = 20_000;

export type ShareStatus = "starting" | "live" | "interrupted" | "refused" | "stopped";

/**
 * One shared ride, from the phone (spec live-share, ADR 0029): makes the channel and the key, and sends each position
 * encrypted. A failure to reach the server never throws and never touches the ride: it says `interrupted` and the next
 * update tries again; a server that forgot the channel is given it again.
 */
export class LiveSharer {
  private readonly setting: ServerSetting;
  private readonly name: string;
  private readonly random: RandomBytes;
  private readonly onStatus: (status: ShareStatus) => void;
  private readonly onReady: () => void;
  private ready = false;
  private readonly channel: string;
  private readonly key: string;
  private last: { at: number; state: "riding" | "stopped" | "ended" | "alert" } | null = null;
  /** The phone thinks the rider crashed: every update says so, every 30 s, until the rider says they are all right. */
  private alerting = false;
  private lastFix: Fix | null = null;
  private n = 0;
  private busy = false;
  private done = false;
  private status: ShareStatus = "starting";
  private beat: ReturnType<typeof setInterval> | null = null;

  constructor(options: {
    setting: ServerSetting;
    name: string;
    random: RandomBytes;
    onStatus: (status: ShareStatus) => void;
    /** The channel exists on the server: the link can be sent (at once, or when the server comes back). */
    onReady?: () => void;
  }) {
    this.setting = options.setting;
    this.name = options.name;
    this.random = options.random;
    this.onStatus = options.onStatus;
    this.onReady = options.onReady ?? (() => {});
    this.channel = newChannel(options.random);
    this.key = newKey(options.random);
  }

  /** The link followers open; the key is in its fragment. */
  get link(): string {
    return followLink(this.setting.url, this.channel, this.key);
  }

  private set(status: ShareStatus) {
    if (this.status === status) return;
    this.status = status;
    this.onStatus(status);
  }

  private fromResult(result: RelayResult) {
    this.set(result === "ok" ? "live" : result === "refused" ? "refused" : "interrupted");
  }

  /**
   * Create the channel on the server; false when it could not be. A server that cannot be reached is tried again on the
   * beat until it answers, and only then is the link ready. The position known so far goes at once.
   */
  async start(): Promise<boolean> {
    // A phone that stands still delivers few fixes: the last position goes again on the beat, so followers
    // hear from a rider who has stopped.
    this.beat = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    return this.open();
  }

  private async open(): Promise<boolean> {
    const result = await createChannel(this.setting, this.channel);
    if (this.done) return false;
    this.fromResult(result);
    if (result !== "ok") return false;
    this.ready = true;
    if (this.lastFix) void this.send(this.lastFix, this.stateFor(this.lastFix), this.lastFix.time);
    this.onReady();
    return true;
  }

  private heartbeat(): void {
    if (this.done || this.status === "refused") return;
    if (!this.ready) {
      if (!this.busy) {
        this.busy = true;
        void this.open().finally(() => (this.busy = false));
      }
      return;
    }
    if (!this.lastFix) return;
    const now = Date.now();
    const stale = now - this.lastFix.time > STALE_FIX_MS;
    // A position that is not new is said as stopped, with the time it was taken: that is what is known.
    const fix = stale ? { ...this.lastFix, speedMps: 0 } : this.lastFix;
    if (this.isDue(fix, now)) void this.send(this.lastFix, this.alerting ? "alert" : stateOf(fix), now);
  }

  /** A position of the ride: sent when it is time. */
  add(fix: Fix, now = fix.time): void {
    this.lastFix = fix;
    if (this.done || this.status === "refused" || !this.ready) return;
    if (!this.isDue(fix, now)) return;
    void this.send(fix, this.stateFor(fix), now);
  }

  private stateFor = (fix: Fix): "riding" | "stopped" | "alert" => (this.alerting ? "alert" : stateOf(fix));

  private isDue(fix: Fix, now: number): boolean {
    if (!this.alerting) return due(this.last, fix, now);
    return !this.last || now - this.last.at >= MOVING_EVERY_MS;
  }

  /**
   * The phone thinks the rider crashed (spec crash-detection): the position goes now with the state "alert", and again every 30
   * seconds until `clearAlert`. False when nothing can be sent (no channel yet, or no position known).
   */
  alert(): boolean {
    if (this.done || !this.ready || !this.lastFix || this.status === "refused") return false;
    this.alerting = true;
    void this.sendNow(this.lastFix, "alert");
    return true;
  }

  /** The rider is all right: the next update says so, at once. */
  clearAlert(): void {
    if (!this.alerting) return;
    this.alerting = false;
    if (this.done || !this.ready || !this.lastFix) return;
    void this.sendNow(this.lastFix, stateOf(this.lastFix));
  }

  /** An update that cannot be skipped because another is in flight: it waits its turn. */
  private async sendNow(fix: Fix, state: "riding" | "stopped" | "ended" | "alert"): Promise<void> {
    for (let i = 0; i < 20 && this.busy; i++) await new Promise((r) => setTimeout(r, 250));
    await this.send(fix, state, Date.now());
  }

  private clearBeat(): void {
    if (this.beat) clearInterval(this.beat);
    this.beat = null;
  }

  /** The ride is paused: a stopped update with the last position. */
  pause(): void {
    if (this.done || !this.lastFix) return;
    void this.send(this.lastFix, "stopped", this.lastFix.time);
  }

  private async send(fix: Fix, state: "riding" | "stopped" | "ended" | "alert", now: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.last = { at: now, state };
    try {
      const update = encryptPoint(
        this.key,
        this.channel,
        pointOf(fix, state, this.name, ++this.n, Date.now()),
        this.random,
      );
      let result = await publish(this.setting, this.channel, update);
      if (result === "gone") {
        // The server was restarted: make the channel again and send this update once more.
        if ((await createChannel(this.setting, this.channel)) === "ok")
          result = await publish(this.setting, this.channel, update);
      }
      this.fromResult(result === "busy" ? "ok" : result);
    } finally {
      this.busy = false;
    }
  }

  /** The ride ends: an ended update, and the server keeps the ride a little while for followers. */
  async finish(): Promise<void> {
    if (this.done) return;
    this.done = true;
    this.clearBeat();
    if (this.ready && this.lastFix && this.status !== "refused") {
      const update = encryptPoint(
        this.key,
        this.channel,
        pointOf(this.lastFix, "ended", this.name, ++this.n, Date.now()),
        this.random,
      );
      await publish(this.setting, this.channel, update);
    }
    if (this.ready) await closeChannel(this.setting, this.channel, "end");
    this.set("stopped");
  }

  /** The rider stops sharing: the ride goes from the server at once, and nothing more is sent. */
  async stop(): Promise<void> {
    if (this.done) return;
    this.done = true;
    this.clearBeat();
    if (this.ready) await closeChannel(this.setting, this.channel, "stop");
    this.set("stopped");
  }
}
