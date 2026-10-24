import { fireEvent, screen } from "@testing-library/react-native";
import { prepareRoadbook } from "../../src/core/roadbook.ts";
import { bundledRoadbooks } from "../../src/data/bundled/index.ts";
import { pointAt } from "../../src/core/track.ts";
import type { LatLon, PreparedRoadbook } from "../../src/core/types.ts";

export const prepared = (): PreparedRoadbook[] => bundledRoadbooks.map(prepareRoadbook);
export const first = (): PreparedRoadbook => prepared()[0]!;
export const at = (rb: PreparedRoadbook, m: number): LatLon => pointAt(rb.roadbook.line, rb.cumulativeM, m);

import { parseRoadbookFile } from "../../src/core/roadbookFile.ts";
import { drawLine } from "../helpers/path.ts";
import { roadbookFile } from "../helpers/polyline.ts";

/** 4 km east with limits 50 / 80 (assumed) / 90 and one camera at 2 km, as a roadbook file would give it. */
export function limitedRoadbook(
  options: { cameras?: boolean; bearing?: number | null; gap?: boolean; country?: string } = {},
): PreparedRoadbook {
  const { cameras: withCameras = true, bearing = null, gap = false, country = "BE" } = options;
  const line = drawLine([{ straight: 4000 }]);
  const cameras = withCameras ? [{ lat: line[400]![0], lon: line[400]![1], kmh: 70, bearing, direction: null }] : [];
  return prepareRoadbook(
    parseRoadbookFile(
      roadbookFile(line, {
        limits: gap
          ? [
              { from: 0, to: 200, kmh: 80, posted: true },
              { from: 500, to: 800, kmh: 50, posted: true },
            ]
          : [
              { from: 0, to: 200, kmh: 50, posted: true, road: "D 954" },
              { from: 200, to: 400, kmh: 80, posted: false },
              { from: 400, to: 800, kmh: 90, posted: true },
            ],
        cameras,
        countries: [{ from: 0, to: line.length - 1, code: country }],
      }),
    ),
  );
}

/** A roadbook as a GPX gives it: a line and stops, no limits and no cameras. */
export function gpxRoadbook(): PreparedRoadbook {
  const { roadbook } = first();
  return prepareRoadbook({
    id: roadbook.id,
    name: roadbook.name,
    description: "",
    stops: roadbook.stops,
    line: roadbook.line,
  });
}

/** 4 km east. Route points Start, 1. Mont (800 m), 2. Cassel (2 km), 3. Bailleul (3 km), Finish; a café on the way. */
export function skippableRoadbook(): PreparedRoadbook {
  const line = drawLine([{ straight: 4000 }]);
  const stop = (index: number, name: string, kind?: string) => ({
    lat: line[index]![0],
    lon: line[index]![1],
    name,
    ...(kind ? { kind } : {}),
  });
  return prepareRoadbook(
    parseRoadbookFile(
      roadbookFile(line, {
        stops: [
          stop(0, "Start", "waypoint"),
          stop(160, "1. Mont", "waypoint"),
          stop(300, "pause: Café", "stop"),
          stop(400, "2. Cassel", "waypoint"),
          stop(600, "3. Bailleul", "waypoint"),
          stop(800, "Finish", "waypoint"),
        ],
      }),
    ),
  );
}

/** A line and nothing else: no stops, no limits, no cameras. */
export function bareRoadbook(): PreparedRoadbook {
  return prepareRoadbook(parseRoadbookFile(roadbookFile(drawLine([{ straight: 4000 }]))));
}

/** End the ride as a rider does: End, then "End ride" when a GPS ride asks. */
export async function endRide() {
  await revealButtons();
  await fireEvent.press(screen.getByText("End"));
  const sure = screen.queryByText("End ride");
  if (sure) await fireEvent.press(sure);
}

/** While riding the buttons are folded away; bring them back as a rider does, with a tap on the strip. */
export async function revealButtons() {
  const strip = screen.queryByLabelText("Show the ride buttons");
  if (strip) await fireEvent.press(strip);
}

/** 4 km east with a roundabout (its second exit of three) at 1200 m and a four-lane road, the left two to take, at 2800 m. */
export function junctionRoadbook(): PreparedRoadbook {
  const line = drawLine([{ straight: 4000 }]);
  return prepareRoadbook(
    parseRoadbookFile(
      roadbookFile(line, {
        junctions: [
          { kind: "roundabout", at: 240, to: 252, exits: [-85, 20, 105], take: 1 },
          { kind: "lanes", at: 560, count: 4, use: [0, 1], turns: ["left", "through", "through", "right"] },
        ],
      }),
    ),
  );
}

/** 3 km east, a left turn (radius 30 m), then 3 km north: one turn to announce and a corner to warn of. */
export function turnRoadbook(): PreparedRoadbook {
  return prepareRoadbook(
    parseRoadbookFile(
      roadbookFile(drawLine([{ straight: 3000 }, { arc: 30, deg: 90, dir: "left" }, { straight: 3000 }])),
    ),
  );
}
