export type LatLon = [lat: number, lon: number];

export interface Stop {
  lat: number;
  lon: number;
  name: string;
  /** A route point of the loop (the default; it can be skipped) or a planned service stop on the route (it cannot). */
  kind?: "waypoint" | "stop";
}

/** Speed limit of a stretch, by index into the line: points `from` (inclusive) to `to` (exclusive). */
export interface LimitStretch {
  from: number;
  to: number;
  kmh: number;
  /** A tagged limit (true) or an assumed default (false). */
  posted: boolean;
  road?: string;
}

/** The country of a stretch of the line, by index into the line (spec danger-zones, ADR 0021): points `from` to `to`. */
export interface CountryStretch {
  from: number;
  to: number;
  /** ISO 3166-1 alpha-2, upper case. */
  code: string;
}

/** The program that made a roadbook, with its own number for it and its name: neither alone identifies it (ADR 0027). */
export interface RoadbookOrigin {
  app: string;
  roadbook?: number;
  ride?: number;
  name?: string;
}

export interface Camera {
  lat: number;
  lon: number;
  kmh: number | null;
  /** The direction the camera faces, degrees from north, when the roadbook file gives it. */
  bearing?: number | null;
  direction: "both" | null;
}

export type LaneTurn = "left" | "slight_left" | "through" | "slight_right" | "right" | "uturn";

/** Guidance at a roundabout or on a wide road, by index into the line (spec junction-guidance). */
export type Junction =
  | {
      kind: "roundabout";
      /** Line point where the rider enters the ring, and where they leave it. */
      at: number;
      to: number;
      /** The exits as bearings relative to the way the rider enters (0 ahead, 90 right), in the order they are met. */
      exits: number[];
      /** The exit to take, counted from 1. */
      exit: number;
    }
  | {
      kind: "lanes";
      /** Line point where the lanes part. */
      at: number;
      count: number;
      /** The lanes that lead on, counted from 0 at the left. */
      use: number[];
      turns?: LaneTurn[];
    };

/** A roadbook as read from a file: the line to ride, its numbered stops and, from a roadbook file, limits and cameras. */
export interface Roadbook {
  id: string;
  name: string;
  description: string;
  stops: Stop[];
  line: LatLon[];
  limits?: LimitStretch[];
  cameras?: Camera[];
  junctions?: Junction[];
  countries?: CountryStretch[];
  /** Where the roadbook came from, when a program that numbers its roadbooks made it (agentRide). */
  origin?: RoadbookOrigin;
  /** When the file was made (ISO 8601), so a refreshed roadbook is told from an older one. */
  generatedAt?: string;
}

/** The limit of a stretch as a distance range along the line. */
export interface LimitSegment {
  startM: number;
  endM: number;
  kmh: number;
  posted: boolean;
  road?: string;
}

/** The country of a stretch of the line as a distance range. */
export interface CountrySegment {
  startM: number;
  endM: number;
  code: string;
}

/** A danger zone: where a camera sits on the line. */
export interface Zone {
  atM: number;
  /** The country the camera is in; null when the roadbook does not say (then nothing is warned, ADR 0021). */
  country: string | null;
  /** The limit of the camera, when it has one. */
  kmh: number | null;
  /** The stretch a danger zone covers, in countries that allow only zones: the camera is inside, not at its middle. */
  startM: number;
  endM: number;
  /** Directions of travel the zone's cameras watch, degrees; null when any direction counts. */
  watched: number[] | null;
}

export type Severity = "hairpin" | "sharp" | "bend";

export interface Corner {
  startM: number;
  endM: number;
  minRadiusM: number;
  direction: "left" | "right";
  angleDeg: number;
  severity: Severity;
  advisoryKmh: number;
}

export interface Maneuver {
  /** Middle of the turn, along the line. */
  atM: number;
  direction: "left" | "right";
  angleDeg: number;
  uturn: boolean;
}

/** A junction placed along the line, in metres from the start. */
export type PreparedJunction = Junction & {
  atM: number;
  /** Where the rider is through it: the exit of a roundabout, the parting of lanes. */
  endM: number;
};

export interface PreparedStop extends Stop {
  /** Distance along the line where the stop lies. */
  atM: number;
}

export interface PreparedRoadbook {
  roadbook: Roadbook;
  /** Cumulative distance of each line point, from the start, in metres. */
  cumulativeM: number[];
  totalM: number;
  loop: boolean;
  stops: PreparedStop[];
  corners: Corner[];
  maneuvers: Maneuver[];
  /** Length of the approach to the start that precedes the roadbook on the line; 0 without one. */
  approachM: number;
  /** The approach is a straight line (no route could be found). */
  approachDirect: boolean;
  /** What the approach leads to: the roadbook's start, or the route again after leaving it. */
  approachTarget: "start" | "route";
  /** Name of the point the approach leads to when the rider chose it, for the HUD ("To 3. Cassel"). */
  approachName?: string;
  /** Distance on the original roadbook where the line after the approach begins; 0 for a whole roadbook. */
  joinM: number;
  limitSegments: LimitSegment[];
  countrySegments: CountrySegment[];
  zones: Zone[];
  junctions: PreparedJunction[];
}

/** One GPS reading. */
export interface Fix {
  lat: number;
  lon: number;
  speedMps: number | null;
  /** GPS heading, degrees from north; null or negative when unknown. */
  headingDeg?: number | null;
  /** Metres above sea level when the GPS gives it (spec instruments). */
  altitudeM?: number | null;
  accuracyM: number | null;
  time: number;
}
