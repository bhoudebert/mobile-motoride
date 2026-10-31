import type { Roadbook } from "../../src/core/types.ts";
import pays from "./roadbooks/1-pays-des-collines-loop.json";
import eau from "./roadbooks/6-eau-d-heure-lakes-loop-with-motorway-hop.json";
import avesnois from "./roadbooks/7-avesnois-loop-from-coutiches.json";
import peaceful from "./roadbooks/r2-coutiches-hollain-ere-peaceful-loop.json";

/** Real roadbooks made by agentRide, kept for the tests only: the app ships none (ADR 0044). */
export const fixtureRoadbooks: Roadbook[] = [pays, eau, avesnois, peaceful] as unknown as Roadbook[];
