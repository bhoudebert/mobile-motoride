# Places Search Specification

## Purpose

Find a bakery, a café, a viewpoint or a toilet along the route without leaving the ride (ADR 0036).

## Requirements

### Requirement: Find along the route

The ride screen SHALL offer **Find**, a button over the panel (a magnifier, named "Find a place along the route"), before and during a ride. It opens a card with the kinds of place to look
for: Fuel (which opens the fuel stops, spec fuel-stops), Bakery, Café, Restaurant (restaurants and fast food), Viewpoint, Toilets, Cash
machine and Motorcycle shop (sales and repair). Choosing a kind SHALL ask OpenStreetMap (through Overpass, ADR 0035) for places within 1 km
of the part of the roadbook between the rider and 60 km ahead (from the start of the roadbook before a ride), and list them nearest first
along the route with their name ("Bakery" and so on when they have none), how far ahead they are and how far off the route. The card
says what it looks at, says when nothing was found, and when the search could not be made says so and offers Try again. The kinds SHALL stay at the
top of the card whatever the length of the list, the one looked for marked, so that another kind is one tap away; opening the card again after a place was chosen shows the kinds with
the last results under them. A ride in progress SHALL NOT be touched by the search.

#### Scenario: A bakery ahead

- **WHEN** the rider presses Find, then Bakery, with a bakery 12 km ahead and 400 m off the route
- **THEN** the card lists it with "in 12 km · 400 m off the route"

#### Scenario: No network

- **WHEN** the search cannot be made
- **THEN** the card says "The search could not be made. Check the network." and offers Try again, and the ride is as it was

### Requirement: Show the place chosen

Pressing a place SHALL close the card, mark the place on the map, centre the map on it (the map stops following the rider) and keep a
chip over the panel with its name and how far ahead it is, updated as the rider rides; once it is passed the chip says so. Pressing
the chip SHALL clear the place. The roadbook SHALL stay the active route: going to the place is riding off the route, and the guidance
back (spec ride-navigation) is what brings the rider back to it.

#### Scenario: A place chosen

- **WHEN** the rider presses a bakery 12 km ahead in the list
- **THEN** it is marked on the map, the map is centred on it, and a chip says "Chez Marie · 12.0 km"

### Requirement: Reading the language

The names of the kinds, the card and the chip SHALL be in the language in use (spec languages). The names of the places are those of
OpenStreetMap and are not translated.
