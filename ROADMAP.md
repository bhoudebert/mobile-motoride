# Roadmap

Done work is removed from this list; what was learnt is added.

## Next

- **Ship to the stores** ([`docs/SHIPPING.md`](docs/SHIPPING.md)): the Android files are built and signed on each release
  (ADR 0030; waiting for the upload key's secrets and a first run on a real phone). Still missing: the iOS app on a real iPhone
  (it builds unsigned in CI, ADR 0041; installing it needs an Apple ID, or the paid account for TestFlight), a privacy policy, the store declarations, and the upload to Play.

- **Run on a real phone.** Nothing here has been ridden yet; v1 was built and
  tested on a PC (core tests only).
- **Offline basemap, for long rides.** A map saved around a roadbook covers a day loop (ADR 0023); a ride too long for
  4,000 tiles, or a route to a place, still needs a regional PMTiles extract or a self-hosted tile server (ADR 0007).
- **Remember the basemap choice** between sessions (it resets to Light).
- **Map-matching quality.** Snap with heading and speed to survive parallel
  roads and hairpin stacks.
- **More languages.** English and French are in (ADR 0032); a third is one more table of messages. Roadbook texts stay in the
  language agentRide wrote them in; roadbooks in several languages are agentRide's job.
- **Rides on a server.** The review reads the GPX a ride is saved as, so a rider who owns or rents a server (ADR 0028) can have
  the same file kept there and the same figures computed on it; nothing in the review has to change for that.
- **Follower mode and alerts that notify.** Today a crash only marks a live ride for whoever has its page open (ADR 0039). Next: Android follower polling with
  local notifications (free, no push), a push gateway for iOS, or a server that texts or emails the contact.
- **Crash alerts that need no live share.** Detection raises an alert, and only a ride shared live tells anyone automatically; a server that holds the
  emergency contact (ADR 0028) could send the message itself, which the app cannot do (Play restricts silent SMS).
- **Gauges, next**: tune the lean from a first real ride (the saved GPX has the readings), then fuse the gyroscope's roll
  rate with the GPS estimate; show the best corner in "My rides"; check the sensors' signs on iOS (the gauges are Android
  only for now, ADR 0031).

- **Camera direction from `forward`/`backward`.** OpenStreetMap's relative values are not exported (they are relative
  to the way, not the route); resolve them against the way's direction so more cameras know which traffic they watch.

## Later

- **Traffic, what is left**: the colour on the route and the chip are built (ADR 0040, with the server in agentRide ADR 0030). Traffic is France only for now (open data, agentRide ADR 0042): Belgium has no working open real-time feed as of 2026-10-23 (the Flemish MIV and
  DATEX feeds do not answer; Wallonia and Brussels publish events only), other countries on request. Later: a
  word before a jam, incidents (closures, accidents) beside the flow, and a point every 5 km.
- **Junction guidance, the producer**: the app shows roundabout exits and lanes (ADR 0018); agentRide must write the
  `junctions` into the roadbook file from OpenStreetMap (roundabout exits, `lanes`, `turn:lanes`). Until then only the
  scripted rides show it.
- **Cameras: confirm Italy and the United Kingdom**, check the French zones against the protocol on real roadbooks and
  have a lawyer review the feature before a public release (ADR 0021). Roadbooks, GPX files and routes to a place that do
  not say their countries get no camera warning: agentRide writes them for new exports.
- **The share target (ACTION_SEND)** so a route app's Share button reaches the app, and our own Valhalla and Overpass
  when many riders complete GPX files (the public ones are slow on a busy day, ADR 0026).
- **The server, the rest of it** (ADR 0028): the setting and **live sharing** are built (ADR 0029); still to come are the
  roadbooks of the rider's library listed and downloaded in the app, a recorded ride sent back for review, an in-app scanner
  for the invitation's QR code (the phone's camera opens it today), alerts to followers (no news for 10 minutes, a long stop) and a self-hosted copy of the map library on the
  follower's page.
- **`rides push`** in agentRide: send a roadbook to a phone with the import link (adb or the local network).
- **Limits and roundabouts for a destination route.** A route to a place has turns and corner warnings but no speed
  limits or junction guidance (they come from agentRide's tracing): trace it in the app or in the backend (ADR 0022).
- **Recent places and a saved destination route**, and a search biased to where the rider is.
- **Accounts and sync** of roadbooks and ridden history (ADR 0004).
- **Crash detection** from accelerometer and gyro, with emergency contact.
- **Import** a GPX file from the phone; **share** a ride.
- **iOS.**
