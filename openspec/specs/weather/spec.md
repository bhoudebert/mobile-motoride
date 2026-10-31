# Weather Specification

## Purpose

Tell the rider what the sky is doing now and on the next 60 km of the roadbook, at the time they will be there: "dry", "rain in 30 km", "rain on a cold road here, clear in 15 km" (ADR 0037).

## Requirements

### Requirement: The forecast on the way

The system SHALL ask MET Norway (the Locationforecast service, free for commercial use with an identifying agent and credit) for the hourly
forecast at the rider's place and at every 15 km of the roadbook ahead, up to 60 km or the finish, each for the hour the rider is expected there
(the speed of the ride, 16 m/s when slower or standing). The places are sent with a hundredth of a degree (about a kilometre), not the exact position.
What the service answered is kept until it says it will have changed (ten minutes without a hint) and the same place is not asked for twice in that time.
The forecast SHALL be asked for again every ten minutes and each time the rider has gone another 10 km, and what was known stays on the screen meanwhile.

#### Scenario: Rain 30 km ahead

- **WHEN** the forecast for the hour the rider reaches the point 30 km ahead says 1.8 mm of rain, and it is dry here and at 15 km
- **THEN** the weather chip says "30.0 km" and is named "Rain in 30.0 km"

### Requirement: What the sky means

The system SHALL call a point **dry** under 0.2 mm of rain an hour, **light rain** from 0.2, **rain** from 1 mm, **heavy rain** from 4 mm, a **thunderstorm** when
the service names one, **snow** when it names snow or sleet, and **rain on a cold road** (ice risk) for any rain of 0.2 mm or more at 2 °C or less. Rain, heavy rain, a
thunderstorm, snow and rain on a cold road are warnings; dry and light rain are not.

#### Scenario: Rain on a cold road

- **WHEN** the forecast gives 0.5 mm of rain an hour at 1 °C
- **THEN** the point is "rain on a cold road", a warning, while 0.1 mm is dry and 0.5 mm at 10 °C is light rain, neither a warning

### Requirement: The weather row and the weather card

The ride screen SHALL carry, before and during a ride, a short chip beside Find and Fuel (not a line of the panel, which the map needs) with a sign and a few words: the
temperature here when it is dry ("13 °C"), where the rain is when it comes ("30.0 km"), "Clear in 30.0 km" or the sky when it is raining here, "Off" when the weather is off. Its name
SHALL be the whole sentence: "Dry for the next 60 km", "Rain in 30 km", "Rain here, clear in 30 km", "Rain for the next 60 km", "Light rain", with the temperature here;
"Weather unknown", "Weather not loaded", or "Weather is off" when that is so. Pressing it SHALL open the weather card: the forecast for here and each point ahead with the time of day, the sky, the temperature, the rain and the wind,
the credit "Weather data: MET Norway", Try again when it could not be loaded, and the switch of the weather.

#### Scenario: Rain ahead

- **WHEN** rain is forecast 30 km ahead and it is dry here
- **THEN** the chip reads "30.0 km" and is named "Rain in 30 km", and pressing it opens the card with the forecast for here and each point ahead, the credit "Weather data: MET Norway" and the weather switch

### Requirement: A word before bad weather

When a warning (rain, heavy rain, a thunderstorm, snow, rain on a cold road) is forecast within 30 km ahead and the rider is not in bad weather already, the system
SHALL say it once for that kind: "Rain ahead in 30 km." It is said again for the same kind only after the sky ahead has been clear. It is said in the Full and Alerts voice
modes and not in Off (spec voice-guidance), in the language in use.

#### Scenario: Said once

- **WHEN** rain comes within 30 km and the forecast is refreshed ten minutes later with the same rain ahead
- **THEN** "Rain ahead in 30 km." was said once and is not said again

### Requirement: The switch

The rider SHALL be able to turn the weather off on the weather card; the choice is kept between launches. With the weather off nothing is asked of the network, and
nothing is asked before the stored choice is known.

#### Scenario: Off from the start

- **WHEN** the weather was turned off in an earlier ride and the ride screen opens
- **THEN** no request is made and the row says "Weather is off"

### Requirement: What leaves the phone

Each forecast sends a place (a hundredth of a degree) to MET Norway, with the name of the app and no identifier, up to five places every ten minutes while a ride screen is
open and the weather is on. The privacy policy says so.

#### Scenario: A forecast

- **WHEN** a ride screen is open with the weather on
- **THEN** up to five places, each to a hundredth of a degree, go to MET Norway every ten minutes with the name of the app and no identifier
