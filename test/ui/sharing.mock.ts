/** Fake expo-sharing: the test reads what was shared. */
export const state = { available: true, fail: false };
export const isAvailableAsync = jest.fn(async () => state.available);
export const shareAsync = jest.fn(async (_uri: string, _options?: unknown) => {
  if (state.fail) throw new Error("cancelled");
});
