/** A finger drag on the HUD, in dp: up pulls the ride buttons out, down folds them away. */
export type Swipe = "up" | "down" | null;

export const SWIPE_MIN_DP = 36;

/** Mostly vertical and long enough; a tap, a sideways drag or a wobble is nothing. */
export function swipeOf(dx: number, dy: number): Swipe {
  if (Math.abs(dy) < SWIPE_MIN_DP || Math.abs(dy) < 1.5 * Math.abs(dx)) return null;
  return dy < 0 ? "up" : "down";
}
