/**
 * Camera and danger zone warnings (spec danger-zones, ADRs 0011 and 0021): on in development. What each country allows
 * is decided in core/cameraPolicy.ts; `EXPO_PUBLIC_DANGER_ZONES=0` only takes warnings away, never allows more.
 */
export const DANGER_ZONES = process.env.EXPO_PUBLIC_DANGER_ZONES !== "0";
