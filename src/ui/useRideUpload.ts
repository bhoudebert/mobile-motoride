import { useCallback, useState } from "react";
import type { ServerSetting } from "../core/liveShare.ts";
import type { RideMeta } from "../core/recording.ts";
import { uploadRide, type UploadProblem } from "../services/rideUpload.ts";
import { markUploaded, readRideGpx } from "./ridesStore.ts";

export type UploadResult = { ok: true; meta: RideMeta | null } | { ok: false; reason: UploadProblem };

/**
 * Send a recorded ride to the rider's server and remember it did (spec ride-recording). The ride stays on the phone whatever
 * happens; only a ride the server answered for is marked as uploaded.
 */
export function useRideUpload(server: ServerSetting | null) {
  const [uploading, setUploading] = useState<string | null>(null);
  const upload = useCallback(
    async (id: string): Promise<UploadResult> => {
      if (!server) return { ok: false, reason: "unsupported" };
      setUploading(id);
      try {
        const gpx = await readRideGpx(id);
        if (!gpx) return { ok: false, reason: "failed" };
        const answer = await uploadRide(server, id, gpx);
        if (!answer.ok) return answer;
        return { ok: true, meta: await markUploaded(id, answer.id, Date.now()) };
      } finally {
        setUploading(null);
      }
    },
    [server],
  );
  return { uploading, upload };
}
