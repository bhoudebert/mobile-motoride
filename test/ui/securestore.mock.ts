/** Fake expo-secure-store: kept in memory, the test reads what the app stored. */
export const stored = new Map<string, string>();
export const getItemAsync = jest.fn(async (key: string) => stored.get(key) ?? null);
export const setItemAsync = jest.fn(async (key: string, value: string) => void stored.set(key, value));
export const deleteItemAsync = jest.fn(async (key: string) => void stored.delete(key));
