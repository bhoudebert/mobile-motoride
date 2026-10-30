# The roadbook file (`motoride-roadbook`, version 1)

What agentRide hands to MotoRide. One JSON file per roadbook, extension `.motoride.json`. A GPX stays
available for other apps; the app reads a GPX too, but without limits or cameras.

```json
{
  "format": "motoride-roadbook",
  "version": 1,
  "name": "Pays des Collines loop",
  "description": "122.3 km, about 2h05 riding.",
  "generatedAt": "2026-10-18T10:00:00.000Z",
  "line": "<encoded polyline, precision 6>",
  "stops": [{ "lat": 50.4552, "lon": 3.20384, "name": "Start", "kind": "waypoint" }],
  "limits": [{ "from": 0, "to": 183, "kmh": 50, "posted": true, "road": "D 954" }],
  "cameras": [{ "lat": 50.52, "lon": 3.31, "kmh": 70, "bearing": 90, "direction": null }],
  "countries": [
    { "from": 0, "to": 140, "code": "FR" },
    { "from": 140, "to": 183, "code": "BE" }
  ],
  "junctions": [
    { "kind": "roundabout", "at": 412, "to": 431, "exits": [-80, 15, 100], "take": 1 },
    { "kind": "lanes", "at": 900, "count": 4, "use": [0, 1], "turns": ["left", "through", "through", "right"] }
  ]
}
```

## Fields

- `format`, `version`: `"motoride-roadbook"` and `1`. A reader refuses another format and any version above the
  ones it knows; it ignores fields it does not know (so a version 1 file can gain optional fields).
- `line`: the route, all legs joined in riding order, as an encoded polyline of precision 6 (the Valhalla and
  agentRide encoding). At least two points.
- `stops`: named places in riding order. `kind` is `waypoint` (the loop's own points: start, via points, finish; the
  default) or `stop` (planned fuel, café or pause stops lying on the route). The app lets the rider skip waypoints,
  never stops. Optional.
- `limits`: the speed limit along the line. Each entry covers the stretch of the line from point `from` to point
  `to`, both **indexes into the decoded `line`** (`0 <= from < to <= last index`), so it needs no length measure.
  Consecutive stretches share their boundary point: the next `from` is the previous `to`. `kmh` is the limit that applies,
  `posted` tells a tagged limit (true) from an assumed one, the country or built-up default (false), `road` is the
  road ref or name, optional. Entries are in order and should not overlap; a gap means unknown. Optional.
- `cameras`: fixed speed cameras near the line. `kmh` is the camera's limit or null. `bearing` is the direction the
  camera faces, degrees clockwise from north (0 to 359), when OpenStreetMap gives it as degrees or a compass point;
  the camera then watches traffic travelling the opposite way. `direction` is `both` or null: OpenStreetMap's
  `forward` and `backward` are relative to the way, not to the line, so they are not exported. Optional. The app shows them as danger zones, never as camera
  positions (`openspec/specs/danger-zones`).

- `junctions`: guidance for the rider at roundabouts and on wide roads (`openspec/specs/junction-guidance`). Optional;
  entries are in order along the line, each with a `kind`:
  - `roundabout`: `at` is the index of the line point where the rider enters the ring, `to` the index of the point
    where they leave it (`at < to`). `exits` lists the exit roads as bearings in degrees relative to the way the rider
    enters (0 straight ahead, 90 to the right, -90 or 270 to the left), **in any order**: the app numbers them. `take`
    is the index (from 0) in `exits` of the exit the roadbook takes. `traffic` is `right` (the default: traffic keeps
    right and circles counterclockwise, so the first exit is the first on the right) or `left` (the first exit is the
    first on the left). Between 2 and 8 exits.
  - `lanes`: only for a road with **more than one lane on the rider's side** where the choice of lane matters; a road with a
    single lane in the rider's direction never gets one. `at` is the index of the line point where the lanes part. `count` is the number of lanes on the
    rider's side (2 to 8), `use` the lanes, counted from 0 at the left, that lead on along the roadbook (at least one,
    fewer than `count` or the guide says nothing). `turns` optionally gives the arrow of each lane, `count` entries
    among `left`, `slight_left`, `through`, `slight_right`, `right`, `uturn`.
    A junction that breaks these rules is dropped; the rest of the file is read.
- `countries`: the country of each stretch of the line, as indexes into `line` like `limits`, with an ISO 3166-1 alpha-2
  `code`. The app decides from it what it may say about a camera (`openspec/specs/danger-zones`, ADR 0021): its place and
  distance, only a danger zone, or nothing. **A roadbook without it gets no camera warning at all.** Optional.
- `generatedAt`: when the file was made, ISO 8601. A reader that holds an older and a newer copy of one roadbook keeps
  the newer. Optional.
- `origin`: where the roadbook came from, when a program that numbers its roadbooks made it:
  `{ "app": "agentRide", "roadbook": 7, "ride": 12, "name": "Pays des Collines loop" }`. `roadbook` and `ride` are that
  program's own whole numbers, `name` its name for the roadbook. The app copies them into the GPX of a ride it records,
  so a reader can tell which roadbook the ride followed; **a number alone is not an identity** (they repeat from one
  library to another), a reader matches on the number and the name together. Optional. MobileMotoRide uses the same
  match to replace a kept roadbook with its refreshed file (spec roadbook-library).

## Rules for the producer

- `limits` indexes refer to the `line` as written. A producer that routes and traces separately must write the
  line it traced, so the indexes hold.
- Distances are never stored: the reader measures the line itself.
- Coordinates are WGS84 degrees. Strings are UTF-8.
- Data comes from OpenStreetMap: keep its attribution with the file's use.
