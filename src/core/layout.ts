/** A window wider than it is tall is landscape. */
export const isLandscape = (width: number, height: number): boolean => width > height;

/** The panel's column in landscape: 37 % of the width, kept between 290 and 380 so it reads and leaves the map room. */
export const hudWidth = (windowWidth: number): number => Math.round(Math.min(380, Math.max(290, windowWidth * 0.37)));
