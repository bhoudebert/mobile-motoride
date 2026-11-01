/**
 * Camera and danger zone warnings (spec danger-zones, ADRs 0011 and 0021): on in development. What each country allows
 * is decided in core/cameraPolicy.ts; `EXPO_PUBLIC_DANGER_ZONES=0` only takes warnings away, never allows more.
 */
export const DANGER_ZONES = process.env.EXPO_PUBLIC_DANGER_ZONES !== "0";

/**
 * Getting a hosted server from the app (spec hosted-server, ADR 0047): on, at the address of the sidecar of the project,
 * unless a build sets `EXPO_PUBLIC_HOSTED_SERVER=0`; `EXPO_PUBLIC_SIDECAR_URL` points a build at another sidecar.
 * Read at the time of use, so a test can change it.
 */
export const DEFAULT_SIDECAR_URL = "https://sidecar-motoride.memorledge.app";
export const hostedServer = (): { sidecarUrl: string } | null => {
  if (process.env.EXPO_PUBLIC_HOSTED_SERVER === "0") return null;
  const url = process.env.EXPO_PUBLIC_SIDECAR_URL || DEFAULT_SIDECAR_URL;
  return { sidecarUrl: url.replace(/\/+$/, "") };
};
