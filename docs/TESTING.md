# Testing

The rule: nothing ships that has not passed the four layers of
[ADR 0009](adr/0009-testing-strategy-for-the-app.md). A change that touches what a rider sees or does comes with a
test that fails without it.

| Layer          | Command                | Covers                                                                                                                 |
| -------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Core           | `npm test`             | geometry, corners, maneuvers, instructions, navigator, approach, fixture roadbooks (real ones kept in `test/fixtures`) |
| UI             | `npm run test:ui`      | every screen, state and control on fakes; accessibility; error handling                                                |
| Bundle         | `npm run bundle:check` | the JavaScript bundle builds                                                                                           |
| Gate           | `npm run quality`      | typecheck, lint, format, the three above, with coverage thresholds                                                     |
| Device (phone) | `npm run smoke:device` | the installed app on a real, unlocked phone: flow, crashes, layout                                                     |

## What the phone test drives

The demo (paused to be read), every roadbook, and **scripted GPS rides** (ADR 0014): the script sends
`mobilemotoride://replay/<scenario>` and the app, in a development build, takes its fixes from a script instead of the
GPS, so the real GPS path runs on the real screen without the phone moving: `approach` (routed to the start by the real
Valhalla), `offroute` (the way back, then the route back), `wrongway`, `skip` (the question, the skip, the new route,
Undo), `join` (the join card), `startfrom` (a ride to a point without asking), `zone` (a danger zone), `roundabout` and `lanes` (junction guidance on made-up junctions, since no real roadbook has any yet), `ride` (the speed limit; also used for pause, the end
question, Back and the phone's Back key). It also opens the gauges card, switches lean on and calibrates the phone (it must lie still on the desk) and reads the lean. It also goes to the home screen and back, and turns Wi-Fi and
mobile data off for a step to see the basemap fall back and the approach become a straight line; it turns them back on,
whatever happens. What it cannot test: the phone's real GPS, the permission dialog, real speed and heading noise, the
vibration, the voice. Those are the ride.

## Where things are

- `test/*.test.ts`: core, run by Node. `test/device-ui.test.ts` tests the layout checker of the device script.
- `test/ui/*.test.tsx`: UI, run by Jest. Fakes for native modules: `test/ui/maplibre.mock.tsx`,
  `test/ui/location.mock.ts`, and `test/ui/setup.ts` (speech, fonts, splash, Valhalla).
- `scripts/device-smoke.ts` and `scripts/device/ui.ts`: the phone script and its pure layout checks.

## Adding a test

- **A new screen, control or state**: a test in `test/ui/` that renders the real component, drives it as the rider
  would (`fireEvent.press`, `act`, fake timers for the demo, `location.pushFix` for GPS) and asserts what the rider
  sees. Add its colours to the contrast table in `test/ui/accessibility.test.tsx`.
- **A new text the rider reads or hears**: a key in `src/core/i18n/en/` and in `fr/` (the build fails without the French one),
  never a literal in a screen. Tests run in English; `setLanguage("fr")` (and back to `"en"` after) shows the French. The device
  test reads the screen by its English texts, so it sets the app to English first.
- **A new colour pair**: add it to the contrast table in `test/ui/accessibility.test.tsx`; it is checked in both looks.
- **A service that asks the network** (Overpass, Valhalla): a test in `test/` with a fake `fetch`, covering the answer, the failure and
  the partial answer; the screens read the stored result, so UI tests set `globalThis.fetch` and never touch the network.
- **Slow runners**: every UI test has 60 s (`testTimeout` in package.json), not Jest's 5: the CI runner is ten times slower than a
  laptop, and a test that renders a ride and pushes positions is long there. A test is right or wrong, not quick or slow.
- **A bug found anywhere** (device, ride, review): first a failing test, then the fix.
- **New map layers or a new native module**: extend the fakes, and add a step to the device script.

## Before a release or a native change

1. `npm run quality` passes.
2. Unlock the phone, keep it awake, start Metro (`npm start`), install the build (`npm run android`).
   The `share` section replaces the phone's server setting and removes its own at the end: run `npm run dev:server` again after it.
3. `npm run smoke:device` passes, one run at a time (a second run, or a stale `uiautomator` on the phone, makes every
   dump fail with "could not get idle state"; the script refuses to start next to another run). It pauses the demo to read the screen: `uiautomator` needs a second without
   change, which a ticking demo never gives); read the screenshots it saves in `.smoke/` (they are not committed).
   While working on one area, run only its sections: `npm run smoke:device -- --only voice,key` (sections: voice, demo, background,
   roadbooks, gps, destination, import, rides, control, key, join, zone, offline; the app opening and the list are always checked). A full run takes about 6 minutes; the full run is the one before a release.
   The run downloads the test roadbooks to the phone from its own server, and deletes at the end the ones it downloaded (a
   roadbook that was already on the phone stays). `npm run dev:server` pushes the same roadbooks to your dev server.
   The `share` section needs agentRide next to this repository (`../agentRide`): it starts its server on this computer, the
   phone reaches it through adb, and what the phone sends is decrypted here the way a follower's browser does.
4. **Cameras: check the table of countries** (`src/core/cameraPolicy.ts`, `docs/danger-zones-by-country.md`, ADR 0021)
   against the countries the build is offered in, confirm Italy and the United Kingdom, and have a lawyer look before a
   public release. The rider's switch (`EXPO_PUBLIC_DANGER_ZONES=0`) only takes warnings away. Never share a build before
   this.
5. Ride a known roadbook, with a passenger or on a quiet road: Start from home (approach), a hairpin warning
   spoken, Off route, the basemap with and without network. Check the speed limit sign against the real signs, and that it turns red when you are over. Say in the pull request what was and was not done.

What the tests cannot tell: real GPS quality, real tiles over a real network, speech on the phone, battery use,
sunlight. Those are the ride.
