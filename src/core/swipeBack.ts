/** How far a finger must travel across the screen to count as a swipe back, in points. */
export const SWIPE_BACK_MIN = 72;
/** Where on the left edge the finger must start, in points. */
export const SWIPE_BACK_EDGE = 40;

/**
 * Whether a touch that started at (x0, y0) and ended at (x1, y1) is a swipe back: it starts at the left edge, goes
 * right mostly sideways, far enough. A scroll, a tap and a swipe that starts in the middle are not (spec home-screen).
 */
export function isSwipeBack(x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = Math.abs(y1 - y0);
  return x0 <= SWIPE_BACK_EDGE && dx >= SWIPE_BACK_MIN && dy <= dx / 2;
}
