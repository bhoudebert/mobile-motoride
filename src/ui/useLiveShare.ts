import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { Share } from "react-native";
import { t } from "../core/i18n/index.ts";
import type { ServerSetting } from "../core/liveShare.ts";
import { LiveSharer, type ShareStatus } from "./liveSharer.ts";

const random = (n: number): Uint8Array => Crypto.getRandomBytes(n);

/**
 * Live sharing of the ride on screen (spec live-share): while a GPS ride runs and the rider asked to share it, a
 * `LiveSharer` makes the channel, opens the share sheet with the link, and is fed the fixes by the ride. It ends with
 * the ride; a pause says "stopped"; the rider can send the link again or stop.
 */
export function useLiveShare(options: {
  server: ServerSetting | null;
  wanted: boolean;
  /** A ride on the phone's own GPS is running (not a demo, not a scripted one). */
  active: boolean;
  paused: boolean;
  name: string;
  /** The rider chose to stop: sharing is no longer wanted. */
  onStopped: () => void;
}) {
  const { server, wanted, active, paused, name, onStopped } = options;
  const sharer = useRef<LiveSharer | null>(null);
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const stopped = useRef(onStopped);
  stopped.current = onStopped;

  const open = useCallback((url: string) => {
    void Share.share({ message: t("server.share.message", { url }) }).catch(() => {});
  }, []);

  const on = active && wanted && server !== null;
  useEffect(() => {
    if (!on || !server) return;
    let live = true;
    const s: LiveSharer = new LiveSharer({
      setting: server,
      name,
      random,
      onStatus: setStatus,
      onReady: () => {
        if (!live) return;
        setLink(s.link);
        open(s.link);
      },
    });
    sharer.current = s;
    setStatus("starting");
    void s.start();
    return () => {
      live = false;
      sharer.current = null;
      setLink(null);
      setStatus(null);
      void s.finish();
    };
    // One sharer per ride: a change of server or name mid-ride does not start another.
  }, [on]);

  useEffect(() => {
    if (paused) sharer.current?.pause();
  }, [paused]);

  return {
    sharer,
    status,
    /** The link exists once the server has made the channel. */
    canLink: link !== null,
    /** Send the link again, through the share sheet. */
    sendLink: () => link && open(link),
    /** The phone thinks the rider crashed: followers are told (spec crash-detection); false when no ride is shared. */
    alert: (): boolean => sharer.current?.alert() ?? false,
    /** The rider is all right. */
    clearAlert: () => sharer.current?.clearAlert(),
    /** Stop sharing: the ride goes from the server at once, the ride itself goes on. */
    stop: () => {
      const s = sharer.current;
      sharer.current = null;
      setLink(null);
      setStatus(null);
      void s?.stop();
      stopped.current();
    },
  };
}
