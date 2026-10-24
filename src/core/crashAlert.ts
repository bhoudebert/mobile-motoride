// ---- What the app does after a crash is detected (spec crash-detection, ADR 0039)

/** Seconds the rider has to say they are all right, and for the test of the alert. */
export const COUNTDOWN_S = 30;
export const TEST_COUNTDOWN_S = 10;
/** The number to call: it works in the European Union and on any GSM network. */
export const EMERGENCY_NUMBER = "112";

export interface Contact {
  name: string;
  number: string;
}

/** A phone number as typed: digits, spaces, dots, dashes, brackets, an optional leading +. */
export const isPhoneNumber = (text: string): boolean =>
  /^\+?[0-9 ().-]{6,20}$/.test(text.trim()) && text.replace(/\D/g, "").length >= 6;

/** The number without the spaces and dots a dialler does not need. */
export const normalizeNumber = (text: string): string => text.trim().replace(/(?!^\+)[^0-9]/g, "");

/** The contact stored, or null for anything that is not one. */
export function parseContact(raw: string | null): Contact | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<Contact>;
    return typeof c.number === "string" && isPhoneNumber(c.number)
      ? { name: String(c.name ?? "").slice(0, 60), number: normalizeNumber(c.number) }
      : null;
  } catch {
    return null;
  }
}

/** A map link to a position, for a message. */
export const mapLink = (lat: number, lon: number): string =>
  `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=17/${lat.toFixed(5)}/${lon.toFixed(5)}`;

/** The link that opens the messages app with a text ready for a number: the rider only has to send it. */
export const smsUrl = (number: string, body: string): string =>
  `sms:${normalizeNumber(number)}?body=${encodeURIComponent(body)}`;

export const telUrl = (number: string): string => `tel:${normalizeNumber(number)}`;

/** Seconds left of a countdown that began at `startedAt`, never under 0. */
export const secondsLeft = (startedAt: number, now: number, total: number): number =>
  Math.max(0, Math.ceil(total - (now - startedAt) / 1000));
