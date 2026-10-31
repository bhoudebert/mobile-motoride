/** A window wider than it is tall is landscape. */
export const isLandscape = (width: number, height: number): boolean => width > height;

/** The panel's column in landscape: two fifths of the width, kept between 300 and 400 so it reads and leaves the map room. */
export const hudWidth = (windowWidth: number): number => Math.round(Math.min(400, Math.max(300, windowWidth * 0.4)));
