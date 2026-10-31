/** A window wider than it is tall is landscape. */
export const isLandscape = (width: number, height: number): boolean => width > height;

/** The panel's column in landscape: a third of the width, kept between 260 and 340: the map keeps the rest, clear. */
export const hudWidth = (windowWidth: number): number => Math.round(Math.min(340, Math.max(260, windowWidth * 0.34)));
