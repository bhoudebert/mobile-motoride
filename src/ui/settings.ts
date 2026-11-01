/**
 * Camera and danger zone warnings (spec danger-zones, ADRs 0011 and 0021): on in development. What each country allows
 * is decided in core/cameraPolicy.ts; `EXPO_PUBLIC_DANGER_ZONES=0` only takes warnings away, never allows more.
 */
export const DANGER_ZONES = process.env.EXPO_PUBLIC_DANGER_ZONES !== "0";

/**
 * Getting a hosted server from the app (spec hosted-server, ADR 0047): off unless a build says so, with the address
 * of the sidecar. Read at the time of use, so a test can change it.
 */
export const hostedServer = (): { sidecarUrl: string } | null => {
  const url = process.env.EXPO_PUBLIC_SIDECAR_URL;
  return process.env.EXPO_PUBLIC_HOSTED_SERVER === "1" && url ? { sidecarUrl: url.replace(/\/+$/, "") } : null;
};
