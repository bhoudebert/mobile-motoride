# Speed cameras by country

A research note behind ADR 0021 and `src/core/cameraPolicy.ts`, from a documented regulatory check on 2026-10-19 (an
earlier web search of ours, then a longer review that found the official texts). **It is not a legal opinion**: the
status "allow" means no prohibition applicable to GPS information about fixed cameras was found. A public release
needs a lawyer's look, above all for the countries still to be confirmed.

| Country        | Fixed camera, exact place | Policy in the app | Evidence                                                                                                     |
| -------------- | ------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| France         | No                        | `zones`           | Article R413-15 of the Code de la route; the protocol of 28 July 2011 (Interior ministry and AFFTAC)         |
| Belgium        | Yes                       | `exact`           | Article 62bis of the law of 16 March 1968 bans detectors, not GPS databases; Vlaamse Stichting Verkeerskunde |
| Luxembourg     | Yes                       | `exact`           | Government answer of 11 March 2026 to parliamentary question no. 3629: Waze and Coyote are not prohibited    |
| Netherlands    | Yes                       | `exact`           | Public confirmation, August 2026                                                                             |
| Spain          | Yes                       | `exact`           | Law and DGT position                                                                                         |
| Italy          | Yes, pre-recorded places  | `exact`           | Ministerial circular of 2007, old: **confirm before a public release**                                       |
| United Kingdom | Yes, it seems             | `exact`           | Historic government position: **confirm before a public release**                                            |
| Germany        | No                        | `off`             | § 23(1c) StVO; OLG Karlsruhe, 7 February 2023 (a passenger's app is the driver's too)                        |
| Switzerland    | No                        | `off`             | Federal law, art. 98a LCR (the earlier note's art. 57b LCR was repealed in 2013)                             |
| Any other      | Not checked               | `off`             | The default                                                                                                  |

## What the app does with it

- **The policy follows everything about a camera**: the warning, the voice, the distance and the marker on the map. It
  is the stricter of the camera's country and the country the rider is in, so a warning begun before a border does not
  go on into a country that forbids it.
- **France**: a zone is at least 300 m in a built-up area, 2 km on an ordinary road and 4 km on a motorway. These are
  the protocol's prescriptions, not thresholds written in the article. The camera lies inside the zone, never at its
  middle, there is no countdown to it and no marker, so the place cannot be deduced from the zone's shape. The kind of
  road is read from the speed limit at the camera.
- **Germany and Switzerland**: nothing, and agentRide does not write cameras there. A general navigation app may stay
  installed with the camera feature off; for Switzerland the rules also touch the supplier of the service, so do not
  distribute Swiss camera data without a specific legal check.
- **The rider's switch** (`EXPO_PUBLIC_DANGER_ZONES=0`) can only take warnings away; it never allows what a country
  forbids. Telling the rider they are responsible does not free the publisher from building the limits in.

## To do before a public build

- Confirm Italy and the United Kingdom, and read the official texts behind the Netherlands and Spain.
- Have the French zones checked against the protocol on real roadbooks (the lengths and the placement in the zone).
- A lawyer's review of the whole feature.

## Sources

Légifrance (R413-15); the protocol of 28 July 2011 as reproduced in a report of the Assemblée nationale; veiligverkeer.be
(Vlaamse Stichting Verkeerskunde) on article 62bis; the Chambre des Députés of Luxembourg (answer of 11 March 2026);
Radar (Netherlands, August 2026); the BOE and the DGT (Spain); the 2007 circular reported by Rivista Giuridica (Italy);
the UK Parliament (historic position); Einzelnorm (§ 23 StVO) and the OLG Karlsruhe judgment of 7 February 2023;
Fedlex (art. 98a LCR).
