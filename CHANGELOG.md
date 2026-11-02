# Changelog

## [1.6.0](https://github.com/bhoudebert/mobile-motoride/compare/v1.5.0...v1.6.0) (2026-11-02)


### Features

* **limits:** show the limit of the road under a rider off the roadbook ([#61](https://github.com/bhoudebert/mobile-motoride/issues/61)) ([e107dff](https://github.com/bhoudebert/mobile-motoride/commit/e107dff591262ac82a9f9181cd825261181aa840))
* **ride:** skip a point by itself when the rider is nearer a later one ([#60](https://github.com/bhoudebert/mobile-motoride/issues/60)) ([684fe76](https://github.com/bhoudebert/mobile-motoride/commit/684fe7621bb1552306eead7a00130963510661f6))
* **rides:** save a roadbook as a file with the share sheet ([#77](https://github.com/bhoudebert/mobile-motoride/issues/77)) ([d45ab2a](https://github.com/bhoudebert/mobile-motoride/commit/d45ab2ac73e7245b8d8814c76195e04ab536f062))
* **rides:** save a roadbook file straight to a folder of the phone ([#78](https://github.com/bhoudebert/mobile-motoride/issues/78)) ([bd6b73a](https://github.com/bhoudebert/mobile-motoride/commit/bd6b73a2ee5b4f6a11d9522044fa71abb27da965))
* **rides:** send one roadbook from its own row ([#76](https://github.com/bhoudebert/mobile-motoride/issues/76)) ([80b3a6b](https://github.com/bhoudebert/mobile-motoride/commit/80b3a6b766d410cf8fb1e9f35636de4335a1b9d6))
* **rides:** send the roadbooks that are only on the phone to the server ([#75](https://github.com/bhoudebert/mobile-motoride/issues/75)) ([b88b7bd](https://github.com/bhoudebert/mobile-motoride/commit/b88b7bd6d120c92f96564f4785e589fa9a5f4d4c))
* **server:** add a backup email and recover a server by email ([#81](https://github.com/bhoudebert/mobile-motoride/issues/81)) ([61ed5d9](https://github.com/bhoudebert/mobile-motoride/commit/61ed5d9bd789e205fca76bf0670770c733bec65c))
* **server:** get a free hosted server from the app, behind a build switch ([#62](https://github.com/bhoudebert/mobile-motoride/issues/62)) ([376c0f8](https://github.com/bhoudebert/mobile-motoride/commit/376c0f8794c390f910c1334f13c4f40e6968c54f))


### Bug Fixes

* **ride:** ride the roadbook again when the rider meets its road before the rejoin point ([#58](https://github.com/bhoudebert/mobile-motoride/issues/58)) ([f9e4f34](https://github.com/bhoudebert/mobile-motoride/commit/f9e4f34598885a1c6a85ffefb70f208b8d7f2f79))
* **server:** drop the coming-soon line where Get a server is offered ([#69](https://github.com/bhoudebert/mobile-motoride/issues/69)) ([8b8ae37](https://github.com/bhoudebert/mobile-motoride/commit/8b8ae370f767675167dc4d5357e6cf264380035a))
* **server:** one card for a phone roadbook and the same name on the server ([#79](https://github.com/bhoudebert/mobile-motoride/issues/79)) ([7ac9aca](https://github.com/bhoudebert/mobile-motoride/commit/7ac9aca24db018699e7b8c05ccc220a87c062c83))
* **server:** tell the result above the block it concerns ([#72](https://github.com/bhoudebert/mobile-motoride/issues/72)) ([c25cfff](https://github.com/bhoudebert/mobile-motoride/commit/c25cfff0cc371c5a544f914fac50df2801c93216))
* **server:** turn copies of a server that is gone into roadbooks and rides of the phone ([#71](https://github.com/bhoudebert/mobile-motoride/issues/71)) ([c5f08cc](https://github.com/bhoudebert/mobile-motoride/commit/c5f08cc24e891dc62c86ce6f4d95a0e2ed3a0f24))

## [1.5.0](https://github.com/bhoudebert/mobile-motoride/compare/v1.4.0...v1.5.0) (2026-10-31)


### Features

* **rides:** list the rides of the server with the phone's ([#55](https://github.com/bhoudebert/mobile-motoride/issues/55)) ([f45a20b](https://github.com/bhoudebert/mobile-motoride/commit/f45a20b6cd9d0f4479801e1e62fdf9fa260b43af))
* **rides:** the actions of a ride are icons ([#53](https://github.com/bhoudebert/mobile-motoride/issues/53)) ([d8d9aac](https://github.com/bhoudebert/mobile-motoride/commit/d8d9aacf044e7d0cdcd3fbe574eb8edf5fe0c199))

## [1.4.0](https://github.com/bhoudebert/mobile-motoride/compare/v1.3.0...v1.4.0) (2026-10-31)


### Features

* **rides:** send a recorded ride to the rider's server ([#50](https://github.com/bhoudebert/mobile-motoride/issues/50)) ([64692b0](https://github.com/bhoudebert/mobile-motoride/commit/64692b028ec4f19847142580fed7b484d94bfbfd))

## [1.3.0](https://github.com/bhoudebert/mobile-motoride/compare/v1.2.0...v1.3.0) (2026-10-31)


### Features

* **library:** do not wait for a file the server has not made ([#48](https://github.com/bhoudebert/mobile-motoride/issues/48)) ([250c8ff](https://github.com/bhoudebert/mobile-motoride/commit/250c8ff2b17e9f412813cbc2ff338f20a99efb08))
* **library:** show the state of a server roadbook and update it with a tap ([#44](https://github.com/bhoudebert/mobile-motoride/issues/44)) ([dcf8009](https://github.com/bhoudebert/mobile-motoride/commit/dcf800918f82f593be64f557f117a2045d8cd3fe))
* **ride:** mark the start and the finish of a roadbook on the map ([#47](https://github.com/bhoudebert/mobile-motoride/issues/47)) ([56cffbe](https://github.com/bhoudebert/mobile-motoride/commit/56cffbe3901cbbdfe3836d2712ec7d0aa40a4711))


### Bug Fixes

* **library:** follow a roadbook the server renumbers ([#46](https://github.com/bhoudebert/mobile-motoride/issues/46)) ([de119b2](https://github.com/bhoudebert/mobile-motoride/commit/de119b29e859294e72d29b513ed0c5f3942cf89e))
* **rides:** never lose a ride to a failed save, list a track without its summary ([#49](https://github.com/bhoudebert/mobile-motoride/issues/49)) ([b1316c0](https://github.com/bhoudebert/mobile-motoride/commit/b1316c01baf7ecb78934fa81bc8c8723151e3d42))

## [1.2.0](https://github.com/bhoudebert/mobile-motoride/compare/v1.1.0...v1.2.0) (2026-10-31)


### Features

* **dev:** load agentRide's .env in the dev server ([#35](https://github.com/bhoudebert/mobile-motoride/issues/35)) ([6d20e33](https://github.com/bhoudebert/mobile-motoride/commit/6d20e33f2a062f802c607e3b2a756a5cee515388))
* **library:** list the roadbooks of the rider's server with download and refresh ([#27](https://github.com/bhoudebert/mobile-motoride/issues/27)) ([be42c0b](https://github.com/bhoudebert/mobile-motoride/commit/be42c0b79b3833596a4e40d6550d656e34df82ac))
* **library:** replace a kept roadbook with its refreshed file ([#26](https://github.com/bhoudebert/mobile-motoride/issues/26)) ([3984597](https://github.com/bhoudebert/mobile-motoride/commit/3984597151cca9aef838dbc4c1a166d9c40abd51))
* **library:** ship no roadbook with the app ([#28](https://github.com/bhoudebert/mobile-motoride/issues/28)) ([2a533bd](https://github.com/bhoudebert/mobile-motoride/commit/2a533bd571fb15f679a807d23188bbcc3c3d001b))
* **ride:** a bright stretch with white chevrons ahead, the ridden part pale ([#38](https://github.com/bhoudebert/mobile-motoride/issues/38)) ([1ce82be](https://github.com/bhoudebert/mobile-motoride/commit/1ce82be93386fe4d19c91a37a52163e76a80fd24))
* **ride:** a compass chip beside the traffic chip, and a motorcycle on it ([#36](https://github.com/bhoudebert/mobile-motoride/issues/36)) ([7813326](https://github.com/bhoudebert/mobile-motoride/commit/7813326a59b987032fdb87609f445f4bdc9528af))
* **ride:** let the phone turn on the ride screen, with the panel in a column ([#37](https://github.com/bhoudebert/mobile-motoride/issues/37)) ([0614a8d](https://github.com/bhoudebert/mobile-motoride/commit/0614a8dc8e6fdd10c62d7a275c7fa15995633b4d))
* **ride:** skip the next point from a square beside the warning ([#23](https://github.com/bhoudebert/mobile-motoride/issues/23)) ([d84b89a](https://github.com/bhoudebert/mobile-motoride/commit/d84b89a252a02ac394664f9251483b01d89f5323))
* **traffic:** say when the server has no traffic data for the road ([#24](https://github.com/bhoudebert/mobile-motoride/issues/24)) ([1cd8d0c](https://github.com/bhoudebert/mobile-motoride/commit/1cd8d0c2d6fa080046d59b7afc76ad97e4095dba))
* **ui:** pull a list down to refresh it ([#34](https://github.com/bhoudebert/mobile-motoride/issues/34)) ([d471d85](https://github.com/bhoudebert/mobile-motoride/commit/d471d85c19e543fd38a44f49318bcd8d0bd559e9))


### Bug Fixes

* **ride:** sideways, the map bleeds to the right edge ([#39](https://github.com/bhoudebert/mobile-motoride/issues/39)) ([ba16027](https://github.com/bhoudebert/mobile-motoride/commit/ba160279312227a8400b36bb748424636b4b262b))
* **ride:** skip square at the top left, map buttons never reach it ([#41](https://github.com/bhoudebert/mobile-motoride/issues/41)) ([0545854](https://github.com/bhoudebert/mobile-motoride/commit/0545854ab32397dff38fe61c3f924a2320f4e3c2))
* **ride:** the skip square steps aside for a card ([#42](https://github.com/bhoudebert/mobile-motoride/issues/42)) ([31164cc](https://github.com/bhoudebert/mobile-motoride/commit/31164cc6240c7d862fb8161876412bab085227d9))
* **ui:** keep the top controls below the iPhone camera ([#21](https://github.com/bhoudebert/mobile-motoride/issues/21)) ([6b315ab](https://github.com/bhoudebert/mobile-motoride/commit/6b315ab65111d8abb7ccc6b7348b86774c220890))
* **voice:** lower the music on iOS and give it back ([#22](https://github.com/bhoudebert/mobile-motoride/issues/22)) ([06055bb](https://github.com/bhoudebert/mobile-motoride/commit/06055bb6d549d2133bd6739fa4a65f56db2bc36a))

## [1.1.0](https://github.com/bhoudebert/mobile-motoride/compare/v1.0.0...v1.1.0) (2026-10-23)


### Features

* **appearance:** a light and a dark look, the phone's by default and fixed in the menu if preferred ([#34](https://github.com/bhoudebert/mobile-motoride/issues/34)) ([95bbd6f](https://github.com/bhoudebert/mobile-motoride/commit/95bbd6fd1d8c128597e6e446f55eb882d1c1eab4))
* **crash:** detect a crash or a fall, ask if the rider is all right, then alert the followers ([#40](https://github.com/bhoudebert/mobile-motoride/issues/40)) ([ac5b7d5](https://github.com/bhoudebert/mobile-motoride/commit/ac5b7d5d7dcdcafa821266e7a657fb5f4f9a9c8d))
* **fuel:** fuel stops on the map, the next one on the ride screen, and a word before a long stretch ([#36](https://github.com/bhoudebert/mobile-motoride/issues/36)) ([06950dc](https://github.com/bhoudebert/mobile-motoride/commit/06950dcc2fc27afa54fbfc85bb7f3015667f15a8))
* **home:** back arrows, routes drawn on roadbook tiles, wide Roadbooks button, lower gauges ([#44](https://github.com/bhoudebert/mobile-motoride/issues/44)) ([9244e10](https://github.com/bhoudebert/mobile-motoride/commit/9244e1016e705ca2895f047f3ff3601737fbb38b))
* **instruments:** compass, altitude, slope, lean and G gauges on the ride screen ([#27](https://github.com/bhoudebert/mobile-motoride/issues/27)) ([36b3cc3](https://github.com/bhoudebert/mobile-motoride/commit/36b3cc360332f3bc28feb3bf0b90c59f7768e557))
* **languages:** English and French, the phone's language by default and switchable in the menu ([#33](https://github.com/bhoudebert/mobile-motoride/issues/33)) ([d0470c7](https://github.com/bhoudebert/mobile-motoride/commit/d0470c711286fe2f5fec0c585a2c89bd3566fc2f))
* **places:** find a bakery, a cafe, a viewpoint and more in the next 60 km without leaving the ride ([#37](https://github.com/bhoudebert/mobile-motoride/issues/37)) ([66e57b4](https://github.com/bhoudebert/mobile-motoride/commit/66e57b471aae32a38e77c469170f020cef3a0102))
* **review:** review a recorded ride: its track by speed, its figures, its profiles and a replay ([#35](https://github.com/bhoudebert/mobile-motoride/issues/35)) ([47bf618](https://github.com/bhoudebert/mobile-motoride/commit/47bf6189536a9b8391649fba75c8c2a7d7ce65ff))
* **ride:** icons for the map buttons and Find, and the sharing line folds with the buttons ([#43](https://github.com/bhoudebert/mobile-motoride/issues/43)) ([3f6d730](https://github.com/bhoudebert/mobile-motoride/commit/3f6d73021793cb9b576482b8e36dd7d832311d92))
* **ride:** move the fuel stop into the panel and colour the traffic icon ([#47](https://github.com/bhoudebert/mobile-motoride/issues/47)) ([9e4f261](https://github.com/bhoudebert/mobile-motoride/commit/9e4f261b550321074675f2c33b244d4bc788c944))
* **ride:** show the time left and the arrival under the distance left ([#48](https://github.com/bhoudebert/mobile-motoride/issues/48)) ([21bdc0f](https://github.com/bhoudebert/mobile-motoride/commit/21bdc0f12978b52daf3d01ce342bf01f91822855))
* **rides:** keep the altitude and the lean and G readings in a recorded ride ([#29](https://github.com/bhoudebert/mobile-motoride/issues/29)) ([5d492e6](https://github.com/bhoudebert/mobile-motoride/commit/5d492e638e7ab008595af195b21cf759f967c4f7))
* **server:** say what the server brings, where traffic works, and how to host one ([#49](https://github.com/bhoudebert/mobile-motoride/issues/49)) ([024f29e](https://github.com/bhoudebert/mobile-motoride/commit/024f29e27cd87b8a9b03c361460145330360221a))
* **traffic:** show slow traffic on the next 60 km, from the rider's own server ([#46](https://github.com/bhoudebert/mobile-motoride/issues/46)) ([0737454](https://github.com/bhoudebert/mobile-motoride/commit/073745412024f98841a7a24f6a17d3d5ff9172c9))
* **voice:** lower the music while the voice speaks, and give it back when the message ends ([#39](https://github.com/bhoudebert/mobile-motoride/issues/39)) ([1b34fe5](https://github.com/bhoudebert/mobile-motoride/commit/1b34fe53185000d88dc6d62864baa7df172cc5b1))
* **weather:** the weather on the next 60 km at the time you get there, and a word before rain ([#38](https://github.com/bhoudebert/mobile-motoride/issues/38)) ([89ac7e7](https://github.com/bhoudebert/mobile-motoride/commit/89ac7e787b80b01d2bdc72e93b783b88ab3c9a46))


### Bug Fixes

* **crash:** say plainly that a crash marks a live ride and notifies no one ([#41](https://github.com/bhoudebert/mobile-motoride/issues/41)) ([230642e](https://github.com/bhoudebert/mobile-motoride/commit/230642e964f54462e0cd50751b279fefa11b3b40))
* **instruments:** take the road's slope off the braking G ([#30](https://github.com/bhoudebert/mobile-motoride/issues/30)) ([16f7d1f](https://github.com/bhoudebert/mobile-motoride/commit/16f7d1fbf8fee8d0bfea900c50f6fde5f818cb6e))
* **places:** keep the kinds on top of the Find card and give the map back the weather line ([#42](https://github.com/bhoudebert/mobile-motoride/issues/42)) ([fdb5bfa](https://github.com/bhoudebert/mobile-motoride/commit/fdb5bfa89357b8a78a071b949997bbecb737d657))
* **ride:** put the map attribution just above the chips so the gauges no longer hide it ([#45](https://github.com/bhoudebert/mobile-motoride/issues/45)) ([549a610](https://github.com/bhoudebert/mobile-motoride/commit/549a6104f6d82e71f46cb5ca6f59c18af776f4d1))

## 1.0.0 (2026-10-20)


### Features

* **approach:** ride the way to the start, then the roadbook, as one line ([c75e42b](https://github.com/bhoudebert/mobile-motoride/commit/c75e42b688dc9340f263f5d98f1791b9f117a878))
* **assets:** add the roadbook fonts and a road icon and splash ([80783a8](https://github.com/bhoudebert/mobile-motoride/commit/80783a89f5fcb0adc321b3efac0a0fe49112d994))
* **cameras:** follow the law of each country, exact place, danger zone or nothing ([#14](https://github.com/bhoudebert/mobile-motoride/issues/14)) ([d14aa00](https://github.com/bhoudebert/mobile-motoride/commit/d14aa007c9f9d904a78932de9bae22900cbe2f65))
* **corners:** detect hairpins and sharp corners from the line geometry ([4f897e3](https://github.com/bhoudebert/mobile-motoride/commit/4f897e3ed22231ffdc5c49701ee6f1b6cd5368bd))
* **demo:** pause and resume the demo, so its screen can be read ([8b27ad2](https://github.com/bhoudebert/mobile-motoride/commit/8b27ad27aeee1b216cf1d145ee7505e60453ae3a))
* **destination:** search a place and ride a motorcycle route to it from here ([#11](https://github.com/bhoudebert/mobile-motoride/issues/11)) ([f10a5e1](https://github.com/bhoudebert/mobile-motoride/commit/f10a5e16bb1c8feb3516954411d5ff139f377f07))
* **direction:** camera facing, limit carry-forward, wrong way and rejoin guidance in the core ([bf5b9a3](https://github.com/bhoudebert/mobile-motoride/commit/bf5b9a31753493bd89d76699a419c8f3ea7fe69a))
* **gpx:** read an agentRide GPX into a roadbook ([fed1edc](https://github.com/bhoudebert/mobile-motoride/commit/fed1edc72b8e99b79e9a6b082a4dc2665fb9afad))
* **guidance:** turn instructions, bearing along the line and a demo ride from the core ([8627c55](https://github.com/bhoudebert/mobile-motoride/commit/8627c556aee1e82c9a3a288cc225eb466da4e931))
* **home:** open on the map with a Where to? search, the roadbooks and the recent rides ([#13](https://github.com/bhoudebert/mobile-motoride/issues/13)) ([2dc6902](https://github.com/bhoudebert/mobile-motoride/commit/2dc6902f7061c93ab56936f6db148929540d84f6))
* **join:** the nearest next route point for a rider away from the roadbook, and a join scenario ([1ff5bb4](https://github.com/bhoudebert/mobile-motoride/commit/1ff5bb42aa75a6b56a419230bf25d4222e3c04e8))
* **library:** complete an imported GPX with speed limits, countries, roundabouts and cameras ([#16](https://github.com/bhoudebert/mobile-motoride/issues/16)) ([7c61c37](https://github.com/bhoudebert/mobile-motoride/commit/7c61c378769b960de9a6b3e153dec8aa4fa8569e))
* **library:** import a GPX or a roadbook file and keep it on the phone ([#15](https://github.com/bhoudebert/mobile-motoride/issues/15)) ([64521e4](https://github.com/bhoudebert/mobile-motoride/commit/64521e41e6f8eb63953c0eb1684281a534c94e8b))
* **limits:** the limit at the rider, over-limit and danger zone warnings in the navigator ([18f8b85](https://github.com/bhoudebert/mobile-motoride/commit/18f8b85a3e5d574ad4ec678af4e1b991626e0e15))
* **map-data:** format distances and turn a roadbook into GeoJSON ([98303a3](https://github.com/bhoudebert/mobile-motoride/commit/98303a3b544a9fd7e23aef16141283bc45a40918))
* **map:** optional OpenFreeMap basemap with roads and names, off when it cannot load ([b39d8ce](https://github.com/bhoudebert/mobile-motoride/commit/b39d8ceee95855526108de80c23df950064d4e39))
* **map:** save the basemap around a roadbook so it stays with no network ([#12](https://github.com/bhoudebert/mobile-motoride/issues/12)) ([9b83ad3](https://github.com/bhoudebert/mobile-motoride/commit/9b83ad320213dde5f9d2b5ffe97f32201c8c497a))
* **navigator:** follow progress, next stop, off route and corner warnings ([f374665](https://github.com/bhoudebert/mobile-motoride/commit/f374665ec0ca6e7f849adbe40e818bd6fb24e9d7))
* **replay:** script GPS rides from a roadbook, and the link that names a scenario ([00bd85f](https://github.com/bhoudebert/mobile-motoride/commit/00bd85fcd13ead11a907c52567d1f02c022da82c))
* **ride-control:** start choices, a named straight line and the startfrom scenario in the core ([2f77c00](https://github.com/bhoudebert/mobile-motoride/commit/2f77c000adb95bdd071dbfd0857c196f4cc830c3))
* **ride:** ask where to join, a map key, a quieter map, and no question before a ride begins ([df8febf](https://github.com/bhoudebert/mobile-motoride/commit/df8febf7ead82cd44eddc544014d9ace72134bd1))
* **ride:** fold the ride buttons behind a grabber, swipe or tap to bring them ([#4](https://github.com/bhoudebert/mobile-motoride/issues/4)) ([514585d](https://github.com/bhoudebert/mobile-motoride/commit/514585d66ae284df13ac014ea53292edb7b854e8))
* **ride:** keep guiding with the screen off through an Android foreground service ([#9](https://github.com/bhoudebert/mobile-motoride/issues/9)) ([a97e455](https://github.com/bhoudebert/mobile-motoride/commit/a97e4552489021ab8f84b576619130215c2e656f))
* **ride:** locate the rider, route to the start and show the approach ([907f1f1](https://github.com/bhoudebert/mobile-motoride/commit/907f1f19abd73368ca9f8177da82f1206cd82f23))
* **ride:** pause and resume, ask before ending, and start from any route point ([899da7f](https://github.com/bhoudebert/mobile-motoride/commit/899da7fd086dad371881fed6016aa876ea3bf832))
* **ride:** rejoin arrow, a road route back, and wrong-way instruction on the ride screen ([dfd454b](https://github.com/bhoudebert/mobile-motoride/commit/dfd454be4fcc8d2750db841008543f68e2995d49))
* **ride:** scripted GPS in dev builds, a basemap reachability check, 48 dp skip buttons ([c5056f3](https://github.com/bhoudebert/mobile-motoride/commit/c5056f38fb4fed7c206cdba48113510dc6c7ed69))
* **ride:** show the roundabout exit and the lanes to take ([#6](https://github.com/bhoudebert/mobile-motoride/issues/6)) ([c477910](https://github.com/bhoudebert/mobile-motoride/commit/c477910f75e487e07dd0c79b3ddab43c7fcc222f))
* **ride:** skip the next point with two taps, a new route, undo, and the safety rules ([410c59f](https://github.com/bhoudebert/mobile-motoride/commit/410c59f8e6f351e15c391967c5ffc24d224ef28f))
* **ride:** speed limit sign always on screen, red when over, and danger zone warnings ([d694b09](https://github.com/bhoudebert/mobile-motoride/commit/d694b09f2bea8df86ce6867225550bd9a03c5a14))
* **rides:** record every GPS ride and save it as a GPX, finished or not ([#17](https://github.com/bhoudebert/mobile-motoride/issues/17)) ([b155f81](https://github.com/bhoudebert/mobile-motoride/commit/b155f81431e00c5dd5ab750847eb9ac8c91e04e5))
* **ride:** tile-free map, direction arrows, top instruction, camera controls and demo ride ([78b6b4f](https://github.com/bhoudebert/mobile-motoride/commit/78b6b4fad895c88ee65808e65e222ddc61b7ba02))
* **ride:** voice guidance with full, alerts-only and off modes ([#7](https://github.com/bhoudebert/mobile-motoride/issues/7)) ([7079f43](https://github.com/bhoudebert/mobile-motoride/commit/7079f4362ba47ff3e9bb517ef549b5bd1c3125e1))
* **roadbook-file:** read the roadbook file with its limits and cameras ([4d212aa](https://github.com/bhoudebert/mobile-motoride/commit/4d212aadbccc449710092bd3614a274354569429))
* **roadbooks:** bundle agentRide GPX exports and test them end to end ([3a1b6ca](https://github.com/bhoudebert/mobile-motoride/commit/3a1b6cac3f65023d25060d6a6cb3776ca256e6f3))
* **share:** join a server by scanning an invitation, with an optional PIN ([#23](https://github.com/bhoudebert/mobile-motoride/issues/23)) ([557ca92](https://github.com/bhoudebert/mobile-motoride/commit/557ca92e575dc8b956ce1e090782415c2bab274b))
* **share:** share a ride live through the rider's server, encrypted on the phone ([#19](https://github.com/bhoudebert/mobile-motoride/issues/19)) ([44a70d6](https://github.com/bhoudebert/mobile-motoride/commit/44a70d6cf889db05bc8f2ec31cec5a6cbe7f61b9))
* **share:** share a ride that is already under way, and again after stopping ([#21](https://github.com/bhoudebert/mobile-motoride/issues/21)) ([3a98b0e](https://github.com/bhoudebert/mobile-motoride/commit/3a98b0eae90ff87d10d8be436d63c91822972c6e))
* **skip:** plan a skip of the next route point, stop kinds, and tidy coordinate names ([c0c46a6](https://github.com/bhoudebert/mobile-motoride/commit/c0c46a62677cdf10a418d46bd1230859bd253557))
* **track:** snap a position to the line within a window ([efe44be](https://github.com/bhoudebert/mobile-motoride/commit/efe44bed9cc21cb45113d9913e64cdfa88391447))
* **ui:** apply the agentMotoride roadbook theme ([e6e06f8](https://github.com/bhoudebert/mobile-motoride/commit/e6e06f8f74e0df551b524e31bde286c8b6219950))
* **ui:** roadbook list and ride screen with corner banner and voice ([90e7c7c](https://github.com/bhoudebert/mobile-motoride/commit/90e7c7c67be02f543184934f1674f20483c31704))


### Bug Fixes

* **corners:** require the turn angle for hairpin and sharp severities ([b989047](https://github.com/bhoudebert/mobile-motoride/commit/b989047c26ecc2aa826756e9d6eb0ee19c317cf6))
* **dev:** serve Metro over localhost so the dev client needs no firewall rule ([d57db10](https://github.com/bhoudebert/mobile-motoride/commit/d57db1052d957a542955c9473d7b1a98e3af2c1c))
* **ride:** put cards above the bottom panel, scrollable, with Close always reachable ([5ac7f48](https://github.com/bhoudebert/mobile-motoride/commit/5ac7f483fad77adca4537294c9168a73dd695440))
* **ride:** start map tracking only once location is granted ([8d4c166](https://github.com/bhoudebert/mobile-motoride/commit/8d4c166643f64d2a1ac96e0a7590977b4a06c9c5))
* **share:** drag the switch, retry a server that is down at the start, add dev:server ([#22](https://github.com/bhoudebert/mobile-motoride/issues/22)) ([05ae9c5](https://github.com/bhoudebert/mobile-motoride/commit/05ae9c52a7e6518c3e6a571f170cde28c75dee4b))
* **smoke:** clear stale uiautomator by exact name, so cleanup cannot kill its own shell ([4ab2146](https://github.com/bhoudebert/mobile-motoride/commit/4ab2146bda6ff8109c2d9d802fef1ef66b97a609))
* **smoke:** pause the demo to read it, fail fast, refuse a second run, judge only the app's crashes ([811422a](https://github.com/bhoudebert/mobile-motoride/commit/811422a84ad2f07118d00d7d328f008658942e17))
* **track:** pick the pass of the line nearest to where the rider should be ([a28dfea](https://github.com/bhoudebert/mobile-motoride/commit/a28dfea909fb02a96c47b291d1f3f63732b99c0d))
* **ui:** reset the location banner on Stop and name every control for screen readers ([c0a97bb](https://github.com/bhoudebert/mobile-motoride/commit/c0a97bb5cb9ce95759cea3b54ba67003c2b27414))
