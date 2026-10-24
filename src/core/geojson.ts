import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { policyOf, stricter } from "./cameraPolicy.ts";
import { pointAt } from "./track.ts";
import type { LatLon, PreparedRoadbook } from "./types.ts";

export function lineFeature(rb: PreparedRoadbook): Feature<LineString> {
  return {
    type: "Feature",
    properties: { name: rb.roadbook.name },
    geometry: { type: "LineString", coordinates: rb.roadbook.line.map(([lat, lon]) => [lon, lat]) },
  };
}

export function stopsCollection(rb: PreparedRoadbook): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: rb.stops.map((s, index) => ({
      type: "Feature",
      properties: { name: s.name, index, kind: s.kind ?? "waypoint" },
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
    })),
  };
}

/** Hairpins and sharp corners, placed where each starts, for the map. */
export function cornersCollection(rb: PreparedRoadbook): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: rb.corners
      .filter((c) => c.severity !== "bend")
      .map((c) => {
        const [lat, lon] = pointAt(rb.roadbook.line, rb.cumulativeM, c.startM);
        return {
          type: "Feature",
          properties: { severity: c.severity, direction: c.direction, advisoryKmh: c.advisoryKmh },
          geometry: { type: "Point", coordinates: [lon, lat] },
        };
      }),
  };
}

/**
 * The cameras to show on the map: only where both the camera's country and the rider's own allow their exact place
 * (spec danger-zones). Without the rider's country, none.
 */
export function camerasCollection(rb: PreparedRoadbook, riderCountry: string | null): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: rb.zones
      .filter((z) => riderCountry !== null && stricter(policyOf(z.country), policyOf(riderCountry)) === "exact")
      .map((z) => {
        const [lat, lon] = pointAt(rb.roadbook.line, rb.cumulativeM, z.atM);
        return {
          type: "Feature",
          properties: { kmh: z.kmh },
          geometry: { type: "Point", coordinates: [lon, lat] },
        };
      }),
  };
}

/** The rider as a point carrying the bearing the marker is turned by. */
export function riderFeature(position: LatLon, bearingDeg: number): Feature<Point> {
  return {
    type: "Feature",
    properties: { bearing: bearingDeg },
    geometry: { type: "Point", coordinates: [position[1], position[0]] },
  };
}

/** The approach to the start, when there is one, apart from the roadbook line. */
export function approachFeature(rb: PreparedRoadbook): Feature<LineString> | null {
  if (rb.approachM <= 0) return null;
  const end = rb.cumulativeM.findIndex((d) => d >= rb.approachM - 1);
  const points = rb.roadbook.line.slice(0, end + 1);
  if (points.length < 2) return null;
  return {
    type: "Feature",
    properties: { direct: rb.approachDirect },
    geometry: { type: "LineString", coordinates: points.map(([lat, lon]) => [lon, lat]) },
  };
}
