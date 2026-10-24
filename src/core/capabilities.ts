/** What a rider's server says it offers, from its health answer (spec server-features). */
export interface Capabilities {
  traffic: boolean;
  /** The countries traffic works in (ISO codes); empty when the server did not say, or its source is not by country. */
  countries: string[];
}

/** The capabilities in a health answer; anything that is not a clear yes is a no. */
export function parseCapabilities(json: unknown): Capabilities {
  const body = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  const list = Array.isArray(body["trafficCountries"]) ? body["trafficCountries"] : [];
  return {
    traffic: body["traffic"] === true,
    countries: list.filter((c): c is string => typeof c === "string" && /^[A-Z]{2}$/.test(c)),
  };
}
