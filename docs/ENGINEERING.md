# Engineering

## Shape

```
agentRide ──GPX──▶ [bundle script] ──JSON──▶ app
                                              │
   src/core   pure TypeScript, tested by Node │  gpx · geo · track · corners · navigator
   src/ui     React Native screens, thin      │  roadbook list · ride screen (map + HUD)
   test/fixtures  real roadbooks, tests only  │
```

- **Expo** (managed workflow with a development build, ADR 0002) and
  **MapLibre Native** for the map (ADR 0003). Expo Go cannot run MapLibre.
- **Local-first**: no backend in v1 (ADR 0004). The app ships no roadbook (ADR 0044): a rider imports a file or fetches from their server.
- **Core is pure** so the safety logic (corner detection, warning timing) is
  tested without a phone (ADR 0005, 0006).

## Data flow of a ride

1. A roadbook (`Roadbook`: name, waypoints, track) is chosen.
2. `prepareRoadbook` computes cumulative distances and detects corners once.
3. `createNavigator` receives GPS fixes, snaps them to the track, and returns
   a `NavState`: progress, next waypoint, off-route flag, corner warning.
4. The ride screen draws the map and HUD from `NavState` and speaks warnings.

## Look

Colours and fonts come from agentMotoride's roadbook theme (`src/ui/theme.ts`, fonts in
`assets/fonts`, licences next to them). The icon and splash are drawn from `assets/src/icon.svg`.
Layers of the map are children of their `GeoJSONSource`: MapLibre v11 hands the source id to its children.

## Map and basemap

The roadbook is drawn on a plain paper background and needs no network. Under it the rider can show a basemap
(Light, Colour, Off) from OpenFreeMap: OpenStreetMap vector tiles with roads and names, no API key (ADR 0007).
Switching the basemap remounts the map, because a new style drops the layers the app added. A style that fails
to load falls back to Off. `EXPO_PUBLIC_MAP_STYLE_URL` replaces the Light style. The public OSM tile servers must
not be used by an app (OSM tile usage policy).
"Get a server" in the Server screen (spec `hosted-server`, ADR 0047) is on by default, at `https://sidecar-motoride.memorledge.app`:
`EXPO_PUBLIC_HOSTED_SERVER=0` switches it off and `EXPO_PUBLIC_SIDECAR_URL` points a build at another sidecar.

## Guidance

`instructionAt` (src/core/instruction.ts) turns the maneuvers found on the line (src/core/maneuvers.ts) into
"Straight 1.2 km" or "Left in 150 m, then right". The camera follows the rider along the line's bearing. The
Demo button feeds the same navigator with fixes from `simulatedFix`, so everything can be seen without GPS.

## Approach to the start

Away from the roadbook, Start asks the public Valhalla service for one route to the roadbook's first point
(`src/services/valhalla.ts`, ADR 0008) and rides approach + roadbook as one line (`withApproach`). The navigator
reports `phase` (`approach` or `ride`) and `toStartM`. Without a route it falls back to a straight line that cannot
be left. Only `src/services/` touches the network; `src/core/` stays pure.

## Ride recording

A GPS ride (not a demo, not a scripted ride) is recorded by `ui/recorder.ts` from the fixes `useRide` already gets: poor
and stationary ones are left out (`core/recording.ts`), a checkpoint is written about once a minute
(`ui/ridesStore.ts`), and the track is saved as a GPX 1.1 with a sidecar JSON for the list when the ride ends, when the
screen is left, or, for a closed app, at the next launch (marked recovered). The GPX metadata names the roadbook it
followed and, for an agentRide roadbook, agentRide's own number and name (`origin` in the roadbook file): a reader takes a
match only when the name agrees too (ADR 0027). With the gauges on, a point also keeps the GPS altitude and, when lean or braking
is on, the lean, G and turning rate (`useInstruments` shares its latest reading with the recorder through a ref); the GPX
writes `<ele>` and `motoride:` extensions, and the metadata the climb and the peak leans (`summarizeTrack`).
`RidesScreen` lists, shares (expo-sharing) and deletes.

## Live sharing

With a server set (menu, Server; `ui/serverSetting.ts` keeps it in expo-secure-store, a link `mobilemotoride://server?...`
fills it after a yes), a GPS ride can be shared (ADR 0029, spec `live-share`). `core/liveShare.ts` (pure) makes the channel
and the key, builds the follow link, encrypts each update with AES-256-GCM (`@noble/ciphers`, the channel as associated data,
the format the follower's page in agentRide reads), and decides when to send (30 s riding, 2 min stopped, at once on a change).
`ui/liveSharer.ts` creates the channel on the relay (`services/relay.ts`), sends the position the ride starts from at once,
then each fix `useRide` feeds it and, because a phone that stands still delivers almost no fixes, a heartbeat that sends the
last position again as stopped with its own age; a server that forgot the channel is given it again and a failure never
touches the ride; a server that cannot be reached when the ride starts is tried again on the same beat, and the share
sheet opens when the channel is made. `useLiveShare` ties one sharer to a GPS ride (not a demo, not a scripted one) and opens
the share sheet; a ride under way that is not shared offers "Share", with a new channel and link.

The server is joined with an **invitation** (agentRide's ADR 0029): a link `mobilemotoride://server?url=...&code=...`, the
QR code of `admin invite`, opened by the phone's camera. `useServerLink` keeps it in `ui/invitation.ts` (memory only) and
opens the Server screen on it; Join sends the code (and a PIN) to the server's `/enrol` (`services/enrol.ts`) and keeps the
token it returns as the setting. Nothing is set before Join, and the code is never stored.

## A server, later

The app has no backend (ADR 0004). An optional server setting is planned (ADR 0028): agentRide's multi-user server, which
already serves the MCP tools to several riders over HTTP with a token, would also feed the app its roadbooks, take a
recorded ride back and relay a live ride, all behind one address and token, none of it needed to ride.

## Roadbook library

Roadbooks the rider brings in (ADR 0025, spec `roadbook-library`) are kept one JSON file each in the app's document
folder (`ui/libraryStore.ts`, expo-file-system), as the same `Roadbook` the app reads. `core/library.ts` (pure)
recognises a roadbook file or a GPX by its content, gives a stable id from the name and the line (so importing twice
replaces), checks the address of an import link (http or https only) and reads kept files back tolerantly. `useImport`
ends the four ways in (picker, a file the phone opens the app with, an `import?url=` link, and nothing else) in one
function and shows its result in `ImportNoticeBar`. Not done: the Android share target (ACTION_SEND needs a native
module the React Native `Linking` does not give), and plain http on a local network in a release build (cleartext is
blocked; a development build allows it).

## Completing a GPX

At import a roadbook with no limits and no countries is completed (ADR 0026): `services/enrich.ts` thins the line, has
Valhalla match it in pieces and Overpass list the cameras (mirrors and waits for a busy server), and `core/enrich.ts`
turns the answers into limits, countries, roundabouts (the rules of agentRide's roadbook file) and cameras, put on the
imported line by distance and nearest point, and read back through the roadbook file's own checks. A failure keeps the
GPX as it was and flags it; the list offers to try again. The Valhalla and Overpass answers are faked in the UI tests.

## Home screen

`App.tsx` holds the screen (home, roadbooks, search, ride) and remembers where a ride was opened from, so Back returns
there (ADR 0024, spec `home-screen`). `HomeScreen` is a MapLibre map centred by `useHere` (last known position first,
then a fresh one), a bottom panel with the search, the Roadbooks control and the recent rides (pulled up by a swipe, as
the ride buttons are), and `HomeMenu`. Recent rides are `core/recents.ts` (pure: dedupe, cap, safe parsing) kept by
`ui/recents.ts` in AsyncStorage; a recent place routes again through `useGoTo`, the hook the search screen uses too.
While the menu is open the map's controls and panel are not drawn: Android kept them in the accessibility tree under a
view hidden with `no-hide-descendants`, so they overlapped the menu for a screen reader.

## Offline map

Before a ride the rider can save the basemap around the roadbook (ADR 0023, spec `offline-basemap`): `ui/offlineMap.ts`
creates a MapLibre offline pack named by `packKey(roadbook, basemap)`, for the roadbook's bounding box plus 3 km,
from zoom 8 to the highest level that fits 4,000 tiles (`core/offline.ts`, pure). The reachability check that drops an
unreachable basemap asks the phone for a finished pack first, so a saved map is never dropped. The packs live in
MapLibre's own database.

## Destination routing

`DestinationScreen` (ADR 0022, spec `destination-routing`): `services/places.ts` searches Nominatim on submit,
`routeToStart` (Valhalla, ADR 0008) routes from the phone's position, and `core/destination.ts` turns the place and the
line into a `Roadbook` that `prepareRoadbook` handles like any other: turns and corners from the geometry, no limits,
cameras or junctions. The roadbook is not saved.

## Background navigation

A real GPS ride also starts `expo-location`'s location updates as an Android foreground service (`ui/background.ts`, ADR
0020, spec `background-navigation`) with a task that does nothing: the service only keeps the app alive and shows its
notification, the positions still come through `watchPositionAsync`. It starts and stops with that subscription, so with
pause, end and leaving the screen; a demo and a scripted GPS never start it. It needs `expo-task-manager` and the
foreground service permissions (the `expo-location` plugin option `isAndroidForegroundServiceEnabled`), plus
`RECEIVE_BOOT_COMPLETED`, without which Expo's task manager crashes the app when it saves a job. After a change of
these, run `npx expo prebuild --platform android` before building, or the manifest stays as it was.

## Voice

Three modes (ADR 0019, spec `voice-guidance`): Full, Alerts (corner warnings and danger zones only) and Off, chosen with
the Voice button of the map controls and kept with AsyncStorage (`ui/voice.ts`; the one native module added, so a
rebuilt dev client). The navigator raises every message as an event, whatever the mode: `warning` (corner), `zoneWarning`,
`statusWarning` (off route, back, wrong way, arrived), `junctionWarning`, `turnWarning` (once at about 500 m and once
close, six seconds ahead and 60 to 200 m), at most one per position update, in that order of priority, one held back
being retried on the next update. `useRide` speaks an event only if `speaks(mode, kind)` (`core/voice.ts`) says so, so a
mode never changes what the navigator knows and a muted message is not said later.

## Junction guidance

The roadbook file may carry `junctions` (ADR 0018, spec `junction-guidance`): roundabouts with the bearing of each exit and
the exit to take, and lane guides with the lanes to use. `core/junctions.ts` places them on the line and picks the one
to guide to (a roundabout from 300 m, lanes from 600 m); the navigator turns it into the instruction ("2nd exit" over
"Roundabout", "Keep left" over "Lanes 1 and 2") and a spoken line, once per pass, never when lost, in the approach
or going the wrong way. `ui/JunctionCard.tsx` draws the ring and spokes or the lane bars with plain views, standing on the
top edge of the bottom panel; it is hidden from screen readers since the instruction says the same in words. A
production file needs agentRide to write the junctions (not done yet); `withDemoJunctions` makes up two for the
scripted `roundabout` and `lanes` rides in a development build.

## Speed limits and danger zones

The roadbook file (`docs/roadbook-format.md`, ADR 0010) carries a limit per stretch and the cameras. `limitAt`
(src/core/limits.ts) gives the limit at the rider and the next change; the HUD sign (`SpeedLimitSign`) is always
on screen and turns red, with one vibration, when the GPS speed is more than 2 km/h over. Cameras become danger
zones by the law of the country (ADR 0021, `core/cameraPolicy.ts`): the policy of the camera's country and of the rider's,
the stricter, decides between the exact place and distance ("Speed camera, 500 metres", a marker), a danger zone of
300 m, 2 km or 4 km with the camera hidden inside it (France), and nothing (Germany, Switzerland, an unknown country or
a roadbook without `countries`). The off switch (`src/ui/settings.ts`) only takes warnings away.
Roadbooks from a GPX have no limits: the sign reads "?".

## Direction awareness

All computed on the phone from the roadbook line and the GPS heading (ADR 0012); no model and no server at ride time.
`src/core/heading.ts` has the angle maths. The navigator compares the heading with the line's bearing: three fixes
more than 120 degrees off, at 10 km/h or more, is "U-turn, wrong way". Cameras with a bearing warn only a rider
approaching them head-on; the limit is held across gaps in the data. Off route, `Rejoin` gives the point of the line
150 m ahead, the distance and the side, offline; the hook then asks the public Valhalla service once (30 s and 50 m
between requests) for a road route back and rides it as one line with the rest of the roadbook (`withApproach` with
a join point). Without a route, the direction guidance stays.

## Live corrections: skipping a point

While stopped (below 10 km/h), the rider can skip the next route point of the loop; planned service stops are left
alone (`kind` on the stops, `src/core/skip.ts`). Two taps, a confirmation that cancels itself after 10 seconds. The
app asks Valhalla for a route from where the rider is to the point after it and rides that and the rest of the
roadbook as one line (`withApproach` with a join point and a name), exactly as for rejoining after leaving the route
(ADR 0012, ADR 0013). A late answer to an older request is dropped by an epoch counter. Undo returns to the previous
ride for 15 seconds without the network. Stops named by raw coordinates are shown as "Point 1".

## Scripted GPS (development builds)

`src/core/replay.ts` scripts short position streams from a roadbook; in a development build the ride screen listens for
`mobilemotoride://replay/<scenario>` and `useRide` takes its fixes from the script (no permission, no GPS). A release
build never installs the listener (`__DEV__`). Each scenario holds its last position, so the screen settles and
`uiautomator` can read it.

## Ride control

A ride can be paused (the GPS is let go, the ride is kept: ADR 0015), resumed, and ended with a question once it has begun
(End, Back and the phone's own Back button ask during a GPS ride; before it has begun, and in a demo, they act at once).

Pressing Start away from the roadbook (more than 150 m from the line) asks where to join (ADR 0016): the hook goes to a
`choosing` stage and offers `joinOptions` (src/core/skip.ts), with the nearest next route point as the one-tap answer, the
start, or any route point from a list. Going to a point routes from where the rider is and drops what lies before it, with
the same join as a skip (`withApproach`, ADR 0013); within 150 m of the point the ride starts there at once. On the
line there is no card.

While riding the HUD folds Back, Pause and End behind a grabber and a swipe (ADR 0017, `core/swipe.ts`): `RideScreen` keeps `controls` and shows the row when
the ride is not on or the grabber was tapped or the panel swiped up, with an 8 s timer that Pause and Resume restart.

## The map

Marks: the roadbook line with arrows, route points (big dark dots with a pale ring), service stops (hollow dots), corner
marks (drawn from zoom 11 only, so the overview reads route first), the rider, and the dashed way to the next point. The
Key button (a picture, like the other map buttons) opens a card that explains them in plain words. A question on screen hides the map controls so that nothing
overlaps it.

## Release build

`app.config.ts` reads the version from `package.json` and derives the Android `versionCode` (`src/core/release.ts`).
`plugins/with-release-signing.cjs` makes the generated Gradle sign the release build with our key (environment variables or
`android/keystore.properties`). `npm run build:android` produces the `.aab` and `.apk`; on a release, `.github/workflows/android.yml`
does it with the key from repository secrets and attaches both to the GitHub release (ADR 0030, how to set up: `docs/SHIPPING.md`).

## Languages

English and French come from one message table per language in `src/core/i18n/` (ADR 0032): `en/` defines the keys, one file per
area (`common`, `nav`, `ride`, `home`, `server`, `gauges`, `rec`), and `fr/` is typed to hold exactly the same keys, so a missing
translation does not compile (`test/i18n.test.ts` also checks the placeholders and the counted forms). `t(key, params)` reads the
language in use, a variable of the core set by `setLanguage`; sentences built in the core (turns, warnings, lanes) call it, so no
signature carries the language. A message that counts has `_one` and `_other` forms chosen by a written-out rule (`Intl.PluralRules` is missing from Hermes on Android); numbers and dates
go through `formatNumber` and `formatDateTime`. The rider's choice (System, English, Français) is `useLanguageSetting` in
`src/ui/languageSetting.ts`, kept in AsyncStorage; System reads the phone with `Intl`, so there is no native module. `App.tsx` calls
`useLanguage()`, so the tree is drawn again on a change. Never call `t()` at module level: the language can change. The speech
uses `LOCALE[language]` for its voice.

## Fuel stops

The fuel stations along a roadbook (ADR 0035). `src/services/overpass.ts` is the Overpass client shared with the cameras; `fetchPois`
(`src/services/pois.ts`) asks along the line, a point every kilometre, and returns a list or null (all or nothing). `src/core/pois.ts`
turns the answer into places (`poisFromElements`), places them along the route (`alongRoute`) and holds the rules: `nextFuel`,
`fuelSummary`, `fuelAnnouncement`, and the tank range. `useFuel` reads the places kept on the phone (`fuelStore.ts`, 30 days) before the
network and gives the ride screen its chip, its card and its map layer; the word before a long stretch goes through the voice mode
(`speaks(mode, "fuel")`).

## Crash detection

`src/core/crash.ts` (ADR 0039) is a pure state machine fed the accelerometer, the GPS speed and the time: a shock, then ten seconds of stillness, with the phone no
longer upright (the upright is learned from the ride). `useCrash` feeds it during a GPS ride and starts the alert (`useAlertFlow`: a 30 s countdown with
vibration and the voice); `CrashAlert` covers the screen, and when no one answers `LiveSharer.alert()` sends the position with the state `alert` every 30 s until the rider is fine.
Without a live share the alert offers a message for the contact (`crashAlert.ts` builds the link) and a call to 112. The Safety page (`SafetyScreen`) holds the switch, the contact and the test.

## The voice and the music

Everything the app says goes through `src/ui/speech.ts` (ADR 0038): it asks Android to lower other audio with `modules/audio-focus` (our own Kotlin
module, autolinked from `modules/`), speaks with the voice of the language, and gives the focus back when the last message ends (a watchdog does it after
30 s whatever happens). The module is optional at run time, so tests and a build without it speak as before. Adding or changing a native module needs a new
dev client (`npm run android`) and the full `npm run smoke:device`.

## Traffic

Traffic ahead (ADR 0040, spec traffic). The app holds no key: `src/services/capabilities.ts` reads the rider's server's `/health` (`traffic`, `trafficCountries`; `ServerFeatures.tsx` shows them on the Server screen, spec server-features); `src/services/traffic.ts` posts
the points to its `/traffic` with the token. `src/core/traffic.ts` is pure: it picks the points (here, every 10 km up to 60 km), reads the answer
(`parseTraffic`), finds the first jam (`outlookOfTraffic`), turns jam points into stretches (`trafficStretches`, half the spacing each side) and
lines for the map (`trafficCollection`). `useTraffic` shows nothing until the server is known to have traffic, asks every 5 minutes and every 10 km,
and nothing while off or before the stored choice is read; the chip and the card are `TrafficUi.tsx`; the lines are one more source on the map.

## Weather

The weather ahead (ADR 0037). `src/services/weather.ts` asks MET Norway for a place (rounded to a hundredth of a degree, kept until the answer's
`Expires`); `src/core/weather.ts` reads it, picks the hour the rider will be at each point (`samplePoints`, `forecastAt`), says what it
means (`conditionOf`) and decides what is worth a word (`outlookOf`, `weatherAnnouncement`). `useWeather` refreshes every ten minutes and every 10 km and
asks nothing until the stored on/off is read; the row is on the panel and the card behind it (`WeatherUi.tsx`); the voice says a warning in Full and Alerts.

## Looking for a place

`Find` on the ride screen (ADR 0036). `usePlaces` asks `fetchPois` (the client of the fuel stops) for one of `PLACE_KINDS` along
the next 60 km of the roadbook (`lineWindow` in `src/core/pois.ts` cuts the line), keeps nothing, and drops an answer that comes after
the rider asked for something else. `PlacesCard` lists the places nearest first; choosing one marks it on the map, centres the map and
keeps a chip, and the roadbook stays the route (the rider rejoins it as after any off-route ride).

## Ride review

`RideReviewScreen` (opened from My rides) reads the ride's GPX back with `parseRideGpx` and shows it (ADR 0034). Everything it
shows is a pure function of the points in `src/core/review.ts`: `reviewRide` (distance, time moving, speeds, climb, peaks of lean
and G), `traceCollection` (the track as runs of one speed class, for the map), `profile` (the profiles over the distance) and
`timeline` and `replayAt` (the replay, where a stop longer than 30 s counts as 30 s). The same functions can run on a server that
keeps rides (ADR 0028); the GPX stays the one file a ride is.

## Appearance

A light and a dark look (ADR 0033). `src/ui/theme.ts` holds a palette per look whose keys are roles, and `colors` reads the one in
use; style sheets are `themed(() => StyleSheet.create({...}))`, built once per look. The rider's choice (System, Light, Dark) is
`useThemeSetting` in `src/ui/themeSetting.ts` over the pure rules of `src/core/theme.ts`, kept in AsyncStorage; System follows
`Appearance`, also while the app runs. `App.tsx` calls `useScheme()` so the tree is drawn again on a change, and the basemap follows
the look (`mapStyle.ts`). Never keep a colour in a module-level constant, and use `onSignal` and `onRust` for text on a yellow or
rust background.

## Instruments

Gauges at the left of the ride screen, each with a switch (spec instruments, ADR 0031). `core/instruments.ts` is pure: compass
points, `Elevation` (smoothed altitude, a climb that counts a rise only above 3 m, the slope over the last 150 m), the
calibration of the phone on its mount, and `Motion` (lean, lateral G, braking G, peaks). `ui/useInstruments.ts` feeds it
from the GPS fix (`useRide` hands out the last `fix`, with its altitude) and, only while lean or braking is on and the phone is
calibrated, from `expo-sensors` (accelerometer and gyroscope at about 20 Hz, shown four times a second). The lean is
`asin(speed × turning rate about the bike's upright axis ÷ g)`: the accelerometer is useless in a steady corner, where it
reads gravity along the bike's own axis. A median over the last seven samples drops a knock on the phone. The switches and the
calibration are kept in AsyncStorage (`ui/instrumentSettings.ts`). The card (`ui/InstrumentsUi.tsx`) is a `Sheet`.

## Not built yet

See `ROADMAP.md`: traffic, danger zones, crash detection, accounts, sync,
offline tiles, iOS.

## Orientation

The app is portrait everywhere except the ride screen (ADR 0045): `app.json` allows every orientation, `src/ui/orientation.ts` locks portrait at start and when the ride screen closes, and the ride screen unlocks while it is open. Held sideways, the panel becomes a column on the left and the rest of the screen is a "stage" for the map and everything that stands on it (`src/core/layout.ts` sizes the column).
