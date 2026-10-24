/** Fake expo-document-picker: the test says what the rider chooses. */
export const picked: { result: unknown } = { result: { canceled: true, assets: null } };
export const getDocumentAsync = jest.fn(async () => picked.result);
