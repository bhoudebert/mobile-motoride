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

const HOSTED_KEY = "hosted-server";

/** Whether the server on the phone was made by the app: "new" until the rider has seen that it is ready, then "yes". */
export type HostedMark = "new" | "yes";
export const markHosted = (m: HostedMark): Promise<void> => SecureStore.setItemAsync(HOSTED_KEY, m).catch(() => {});
export const readHosted = async (): Promise<HostedMark | null> => {
  const v = await SecureStore.getItemAsync(HOSTED_KEY).catch(() => null);
  return v === "new" || v === "yes" ? v : null;
};
/** After the server is deleted: forget it all, the token too, so a later server starts from nothing. */
export async function forgetHosted(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(HOSTED_KEY),
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(JOURNAL_KEY),
  ]).catch(() => {});
}

/** A token of this phone's own that replaces the one kept (a recovery that finds this phone's token already used elsewhere). */
export async function replaceAccountToken(): Promise<string> {
  const made = newAccountToken((n) => Crypto.getRandomBytes(n));
  await SecureStore.setItemAsync(TOKEN_KEY, made);
  return made;
}
