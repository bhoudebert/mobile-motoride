# 0037. Weather ahead from MET Norway

- Status: accepted
- Date: 2026-10-22

## Context

A motorcycle is not a car in the rain: a shower in 20 km is a reason to stop under a bridge or put the jacket on, ice on a cold morning is a
reason to turn back. The rider wants the weather where they are going, at the time they will be there, not a weather app's page for the town
they left. Two free services came to mind. Open-Meteo is simple, takes several places in one request and has a rain radar for 15 minutes, but its free
service is for non-commercial use and the app has a commercial page (ADR 0030 and the site). MET Norway's Locationforecast needs no key, allows commercial use
with credit and an identifying User-Agent, and covers the world, but takes one place per request and asks to be cached.

## Decision

- MET Norway Locationforecast 2.0 `compact`, one request per place, for here and each 15 km up to 60 km, five requests at most. Each answer is kept in memory until its
  `Expires` header (ten minutes if it has none), so the same place is not asked for twice; the places are rounded to a hundredth of a degree, which also keeps
  the exact position of the rider off the wire.
- The pure core (`src/core/weather.ts`) reads the answer, picks the hour of the time the rider will be there (the speed of the ride, 16 m/s when slower), says what it
  means (thresholds of rain per hour, thunder, snow, ice below 2 °C) and decides what is worth a word: bad weather ahead within 30 km and not already in it, once for each
  kind until the sky ahead has been clear. The thresholds are numbers in the code and in the spec.
- The ride screen shows one line on the panel and a card with the details; the voice says a warning in Full and Alerts. A switch on the card turns the weather off and keeps
  the choice; the hook asks nothing until the stored choice is known.
- The credit "Weather data: MET Norway" is on the card.

## Consequences

- Up to five requests every ten minutes while a ride screen is open; a rider who prefers none turns the weather off.
- The forecast is of the model, not a radar: a shower can miss the road or hit it an hour earlier. The words are "ahead" and a distance, not a promise.
- The privacy policy and the store's data-safety answers say that a place, a hundredth of a degree, goes to MET Norway.
- A different service (a radar, a paid one) is a replacement of `fetchForecast` and `parseForecast`; the rest does not change.

## Alternatives considered

- **Open-Meteo.** Easier and with a radar, but not free for a commercial app; the day it is wanted a key and a plan replace the service in one file.
- **Asking only at the start of the ride.** A ride is hours long and the sky changes; the question was exactly "from time to time".
- **A weather map layer.** Pretty, and it answers nothing about the road in 30 km.
