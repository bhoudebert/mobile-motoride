import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { isAccountToken, newAccountToken } from "../core/hosted.ts";

const TOKEN_KEY = "hosted-account-token";
const JOURNAL_KEY = "hosted-journal";

/** What the app is in the middle of, kept so that closing the app never loses a step (ADR 0047). */
export interface Journal {
  plan: "free";
}

/** The random token that stands for the rider with the sidecar and the store: made once, kept in the secure store. */
export async function accountToken(): Promise<string> {
  const kept = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (kept && isAccountToken(kept)) return kept;
  const made = newAccountToken((n) => Crypto.getRandomBytes(n));
  await SecureStore.setItemAsync(TOKEN_KEY, made);
  return made;
}

export async function readJournal(): Promise<Journal | null> {
  try {
    const raw = JSON.parse((await SecureStore.getItemAsync(JOURNAL_KEY)) ?? "null") as Partial<Journal> | null;
    return raw?.plan === "free" ? { plan: "free" } : null;
  } catch {
    return null;
  }
}

export const writeJournal = (j: Journal): Promise<void> =>
  SecureStore.setItemAsync(JOURNAL_KEY, JSON.stringify(j)).catch(() => {});

export const clearJournal = (): Promise<void> => SecureStore.deleteItemAsync(JOURNAL_KEY).catch(() => {});
