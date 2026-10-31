# MotoRide

[![CI](https://github.com/bhoudebert/mobile-motoride/actions/workflows/ci.yml/badge.svg)](https://github.com/bhoudebert/mobile-motoride/actions/workflows/ci.yml)
[![CodeQL](https://github.com/bhoudebert/mobile-motoride/actions/workflows/codeql.yml/badge.svg)](https://github.com/bhoudebert/mobile-motoride/actions/workflows/codeql.yml)
[![Android build](https://github.com/bhoudebert/mobile-motoride/actions/workflows/android.yml/badge.svg)](https://github.com/bhoudebert/mobile-motoride/actions/workflows/android.yml)
[![iOS build](https://github.com/bhoudebert/mobile-motoride/actions/workflows/ios.yml/badge.svg)](https://github.com/bhoudebert/mobile-motoride/actions/workflows/ios.yml)
[![Release](https://img.shields.io/github/v/release/bhoudebert/mobile-motoride?display_name=tag&sort=semver)](https://github.com/bhoudebert/mobile-motoride/releases)
[![Platform Android and iOS](https://img.shields.io/badge/platform-Android%20%7C%20iOS-3ddc84)](docs/SHIPPING.md)
[![Expo SDK 58](https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white)](package.json)
[![React Native 0.88](https://img.shields.io/badge/React%20Native-0.88-61dafb?logo=react&logoColor=white)](package.json)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](tsconfig.json)
[![Node 24](https://img.shields.io/badge/node-%E2%89%A524-339933?logo=node.js&logoColor=white)](.nvmrc)
[![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Conventional Commits](https://img.shields.io/badge/commits-conventional-fe5196?logo=conventionalcommits&logoColor=white)](CONTRIBUTING.md)

A motorcycle GPS for Android (iOS in progress). It rides a **GPX roadbook** planned with
[agentRide](https://github.com/bhoudebert/agent-motoride) and warns you of dangerous corners before you reach
them. Accounts are on the [roadmap](ROADMAP.md).

> Status: early. Version 1 follows a roadbook imported or fetched from a server and warns of hairpins and
> sharp corners. It has not been ridden yet.

## How it works

- **Roadbook**: a GPX from agentRide (a line and numbered stops).
- **Corners** are found on that line from its geometry (radius, angle) and
  announced on screen and by voice with an advisory speed. See
  [`openspec/specs/corner-warnings`](openspec/specs/corner-warnings/spec.md).
- **Share a ride live**: with a server set (agentRide's multi-user server), a GPS ride can be shared before it starts or while it runs (join the server by scanning an invitation's QR code): the
  phone opens the share sheet with a link, sends its position encrypted about every 30 seconds, and followers watch it on a
  map in a browser, with no app. The server cannot read the positions. See
  [`openspec/specs/live-share`](openspec/specs/live-share/spec.md).
- **Rides are recorded**: every ride on the GPS is saved as a GPX on the phone, finished or not, with the altitude and,
  when the gauges' lean is on, the lean and G of each point; "My rides" shows the climb and peak leans and shares the file. See [`openspec/specs/ride-recording`](openspec/specs/ride-recording/spec.md).
- **Import**: bring in a GPX from any route app or a roadbook file from agentRide, from a file, by "open with" or by a
  link; they stay on the phone, and a GPX is completed with speed limits, roundabouts and cameras. See [`openspec/specs/roadbook-library`](openspec/specs/roadbook-library/spec.md).
- **Home screen**: the app opens on the map where you are, with a "Where to?" search, your roadbooks, your recent
  rides and a menu. See [`openspec/specs/home-screen`](openspec/specs/home-screen/spec.md).
- **Go to a place**: search a place, get a motorcycle route from where you are, and ride it with the same
  guidance (no speed limits yet). See [`openspec/specs/destination-routing`](openspec/specs/destination-routing/spec.md).
- **Offline map**: save the basemap around a roadbook before the ride and it stays with no network. See
  [`openspec/specs/offline-basemap`](openspec/specs/offline-basemap/spec.md).
- **Background navigation**: a ride on the real GPS keeps guiding and speaking with the screen off or another app in
  front, as an Android foreground service with a notification. See
  [`openspec/specs/background-navigation`](openspec/specs/background-navigation/spec.md).
- **Gauges**: a small column on the ride screen with the compass, altitude and climb, slope, and, from the phone's own
  sensors, lean angle with your peaks, lateral G and braking G. Each reading has a switch; lean and braking need a one-tap
  calibration with the phone on its mount. See [`openspec/specs/instruments`](openspec/specs/instruments/spec.md).
- **Crash and fall detection**: a shock then ten seconds without moving asks if you are all right, then marks
  your live ride and prepares a message for your contact. See [`openspec/specs/crash-detection`](openspec/specs/crash-detection/spec.md).
- **Weather ahead**: dry or rain in the next 60 km at the time you get there, and a word before it. See
  [`openspec/specs/weather`](openspec/specs/weather/spec.md).
- **Traffic ahead** (with your agentRide server; open data, France for now, more countries on request): amber and red on the route where the next 60 km are slow. The Server screen says what your server brings and links to how to host one.
  It informs, the roadbook never changes. See [`openspec/specs/traffic`](openspec/specs/traffic/spec.md).
- **Find along the route**: a bakery, a café, a viewpoint, toilets... in the next 60 km, shown on the map without leaving the
  roadbook. See [`openspec/specs/places-search`](openspec/specs/places-search/spec.md).
- **Fuel stops** on the map, the distance to the next one, and a word before a stretch longer than the tank. See
  [`openspec/specs/fuel-stops`](openspec/specs/fuel-stops/spec.md).
- **Ride review**: open a recorded ride to see its track coloured by speed, its figures (speeds, climb, peak lean, hardest braking),
  its profiles and a replay. See [`openspec/specs/ride-review`](openspec/specs/ride-review/spec.md).
- **Light and dark look**, the phone's by default and fixed in the menu if you prefer. See
  [`openspec/specs/appearance`](openspec/specs/appearance/spec.md).
- **English and French**, the phone's language by default and switchable in the menu, on screen and by voice. See
  [`openspec/specs/languages`](openspec/specs/languages/spec.md).
- **Voice** says the turns, roundabout exits, lanes and warnings; Full, Alerts only or Off, chosen on the ride
  screen. See [`openspec/specs/voice-guidance`](openspec/specs/voice-guidance/spec.md).
- **Open stack**: React Native (Expo), MapLibre, no tiles needed.
  No backend yet ([ADR 0004](docs/adr/0004-local-first-no-backend-in-v1.md)).

## Develop

```bash
nvm use && npm install
npm run quality            # typecheck, lint, format, tests
npm run android            # dev build on a connected phone (needs the Android SDK)
```

The route to Google Play and the App Store, what is built for it (a signed Android bundle and APK on each release) and what is still missing, is in [`docs/SHIPPING.md`](docs/SHIPPING.md).

Read [`AGENTS.md`](AGENTS.md) and [`docs/EVOLVING.md`](docs/EVOLVING.md) before
changing anything: spec first, ADR for big choices, Conventional Commits, pull
requests.

## Run on a phone

Expo Go cannot run MapLibre, so the app runs as a development build:

1. Enter the Nix dev shell (`nix develop`, or `direnv allow`): Node 24, JDK 17 and the Android SDK that React Native needs, pinned in `flake.nix`. Enable USB debugging on the phone (`adb devices` lists it).
2. The map needs no tiles: the roadbook line is the map. Optional: `export EXPO_PUBLIC_MAP_STYLE_URL=<a MapLibre style URL>` for a basemap.
3. `npm run android` builds and installs the app (first time, or after a native change).
4. Day to day: `npm start`, then press `a`. It serves the JS over `localhost` through the USB port forward, so it needs no Wi-Fi or firewall rule. A white screen after the splash means the phone could not reach Metro: use `npm start`, not a LAN address.

## Try live sharing with a local server

The phone reaches a server on your machine through the USB port forward, so nothing has to be deployed to try it:

```bash
npm run dev:server   # starts ../agentRide's server, makes a rider, pushes the test roadbooks, forwards the port, sets the server in the app
```

The app asks to use the server (`Use it`); then Menu, Server, Test. The server loads `../agentRide/.env` as agentRide's own `npm run serve` does (Claude key, traffic, Mapillary), but keeps its
data apart in `~/ride-dev-data`. Mind `RIDE_REMOTE_URL` there: a roadbook pushed from this server goes to that real one.
A new server also gets the test roadbooks
(`test/fixtures/roadbooks`) pushed to it, so the Roadbooks screen lists them to download (it needs an agentRide that takes
`PUT /roadbooks`; without it the list stays empty). A rider of a hosted server joins by scanning the
QR code of `npm run admin -- invite <email> --pin` (agentRide) with the phone's camera: the app asks for the PIN and
keeps a token of its own. The token is kept in `~/ride-dev-data/token.txt`
(in case you must type it into the app by hand: address `http://localhost:18973`). Open the follow link on your PC as it
is (`http://localhost:18973/follow/...`, keep the part after `#`). Ctrl-C stops the server and the forward; the forward
also ends when the phone is unplugged. `npm run smoke:device` replaces the app's server with its own and removes it at
the end: run `npm run dev:server` again after it. This only works tethered; to share a real ride, deploy the server
(see agentRide's self-hosting guide).

Never ridden yet: v1 is verified by unit tests, by riding roadbooks served by a test server
in simulation, and by a successful Metro bundle. Test it on a quiet road with
someone else watching the screen, or in a car as a passenger first.

## Safety

Advisory speeds and warnings are guidance. The rider is responsible for riding
safely and legally. Do not operate the phone while riding.

## Licence

MIT, see [LICENSE](LICENSE).
