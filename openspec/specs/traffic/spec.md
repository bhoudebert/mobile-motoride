# Traffic Specification

## Purpose

Show the rider where the traffic is slow on the next 60 km, from their own server's traffic source (open government data, or the host's TomTom key), so they can decide for themselves to use Skip or take another road. It informs; it never changes the roadbook and never re-routes (ADR 0040; the server side is agentRide's spec `traffic`).

## Requirements

### Requirement: Only with a server that has traffic

The ride screen SHALL offer traffic only when the rider has a server (spec live-share) whose health answer says `traffic: true`. Without a server, with one that has no traffic source, or while that is not yet known, the ride screen SHALL show nothing of traffic and SHALL send nothing: no chip, no request to `/traffic`. The app SHALL hold no traffic key and SHALL never speak to a traffic provider itself.

#### Scenario: A server without traffic

- **WHEN** the rider's server answers `traffic: false` and a ride screen opens
- **THEN** there is no traffic chip and `/traffic` is not called

### Requirement: The points asked

With traffic on, the app SHALL send to the server, with the rider's token, the position on the roadbook where the rider is and every 10 km ahead up to 60 km or the finish (at most 7 points), as latitude and longitude and nothing else. It SHALL ask again every 5 minutes and each time the rider has gone another 10 km, and what was known stays on the screen meanwhile. Nothing SHALL be asked before the stored on/off choice is known, nor with traffic off.

#### Scenario: Seven points

- **WHEN** the ride screen opens with a server that has traffic, 122 km of roadbook ahead
- **THEN** one request goes to `<server>/traffic` with seven points, here and every 10 km, with the token

### Requirement: Slow stretches on the map

A point the server answers `slow` SHALL be drawn amber, `heavy` or `closed` red, on the roadbook line, each standing for 5 km on each side of the point (never behind the rider nor past the finish), neighbouring points of the same level joining up. `free` and `unknown` points SHALL draw nothing. The roadbook, its corner marks and its guidance SHALL NOT change.

#### Scenario: A jam at 30 km

- **WHEN** the points at 30 km and 40 km are `heavy`
- **THEN** one red stretch from 25 to 45 km ahead is on the map and the roadbook is as it was

### Requirement: The traffic chip and card

A round chip with a car picture alone (no word, which takes the same place in every language) SHALL stand beside Find and the weather. The picture SHALL be **green** when the points ahead flow, **amber** when the first jam is slow, **red** when it is heavy or closed, and grey when nothing is known, while it loads, when it could not be loaded, and dimmed when traffic is off. Its name SHALL be the whole sentence ("Traffic: Heavy in 30.0 km", "Traffic: flowing for the next 60 km", "Traffic unknown", "Traffic not loaded", "Traffic is off"). Pressing it SHALL open the card: the level at each point (here, in 10 km, ...) with its colour, the note that this is an indication every 10 km and that the roadbook does not change, a notice when the server used its daily requests, Try again when it could not be loaded, the switch of traffic, and the credit "Traffic data: TomTom, through your server".

#### Scenario: Colour tells it

- **WHEN** the first jam ahead is at 30 km and heavy
- **THEN** the picture is red and the chip is named "Traffic: Heavy in 30.0 km"

#### Scenario: Not loaded

- **WHEN** the server cannot be reached
- **THEN** the picture is grey, the chip is named "Traffic not loaded" and the card offers Try again

### Requirement: The switch

The rider SHALL be able to turn traffic off on the card; the choice is kept between launches. With it off nothing is sent and the map shows no stretch.

#### Scenario: Off, and kept

- **WHEN** the rider turns traffic off and opens the ride screen at the next start
- **THEN** the chip says "Off" and `/traffic` is not called

### Requirement: What leaves the phone

The points sent are on the road ahead, so the rider's server learns about where they ride, to a kilometre. They go to the server the rider chose and to nobody else; the privacy policy and the guide say so and advise a server one trusts. Live sharing stays end-to-end encrypted.
