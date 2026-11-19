# Destination Routing Specification

## Purpose

Let the rider ride somewhere without a roadbook from agentRide: name a place, get a motorcycle route to it from where they are, and ride it with the same guidance as a roadbook (ADR 0022).

## Requirements

### Requirement: Search a place

The list screen SHALL offer "Go to a place" which opens a search screen with a text field. A search SHALL start only when the rider submits it (the keyboard's search key or the Search button), never on each keystroke, and only for a query of at least 3 characters. It SHALL list at most 8 places with a name and a shorter line of where it is; it SHALL say when nothing was found and when the search could not be made (no network), and the rider SHALL be able to search again. The search SHALL NOT need the location permission.

#### Scenario: A place is found

- **WHEN** the rider types "Mons" and submits
- **THEN** the places named Mons are listed

#### Scenario: Nothing found

- **WHEN** the search answers with no place
- **THEN** the screen says "No place found" and keeps the field

### Requirement: Route from here

Choosing a place SHALL ask for the position of the phone (the location permission, if not yet given), ask for a motorcycle route from there to the place, and open it (or the one the rider chose, see "Choose between routes") as a roadbook named "To <place>" with the position as its start and the place as its finish, riding from the start as any roadbook: instructions, corner warnings, voice and the background service. The roadbook SHALL not be saved: it lives until the rider leaves the ride. When the position is refused or unknown, or no route can be had, the screen SHALL say so and stay on the results; it SHALL NOT open a ride on a straight line.

#### Scenario: A route is found

- **WHEN** the rider chooses "Mons" and a route comes back
- **THEN** a ride opens named "To Mons" with its distance

#### Scenario: Location refused

- **WHEN** the rider refuses the location permission
- **THEN** the screen says the position is needed and stays on the results

#### Scenario: No route

- **WHEN** the routing service gives no route
- **THEN** the screen says no route could be had now, and the rider can choose again

### Requirement: Choose between routes

Choosing a place SHALL ask for up to three motorcycle routes from the position of the phone to the place, in parallel: the **fastest** (motorways allowed), the one **without motorway**, and the **shortest** by distance. A route that could not be had SHALL be dropped; routes that follow nearly the same road (about the same length and most of their line within 150 m of the other) SHALL be shown once, under the name of the first of the three above. With one route left, the ride SHALL open at once as before. With several, a screen SHALL show them on a map and as cards, one card each with its name, its time and its distance, and for the ones that are not the first, how much longer or shorter than it. The route that takes the least time SHALL be selected when the screen opens and drawn thick in the route green; the others SHALL be drawn thinner in another colour, their card carrying the same colour. Pressing a card or a line SHALL select that route, and the Start button SHALL open the ride on the selected route as in "Route from here". Back SHALL return to the results.

When the rider has a server with a traffic source and traffic is on (spec traffic), the points of each route (at most 8, spaced 2 to 10 km over the first 60 km) SHALL be sent to the server's `/traffic`, and the time of each route SHALL be that of the route plus the delay of its jams: a `slow` point costs the 10 km it stands for 1.4 times its time, a `heavy` one 2.5 times. A route with a `closed` point SHALL say so on its card and SHALL be selected only when every route is closed. The card SHALL say how much of the time is traffic ("+8 min traffic"). Without traffic (no server, no traffic source, off, or not answered in time) nothing SHALL be said of it and the routes SHALL be ranked by their own time. The app never talks to a traffic provider (ADR 0040).

#### Scenario: Three roads to Tournai

- **WHEN** the rider chooses "Rue du Mont des Carliers 3, Tournai" and the three routes differ
- **THEN** the screen shows three cards and three lines, the fastest selected and thick, the other two thinner and in another colour, with their time and distance

#### Scenario: Another road selected

- **WHEN** the rider presses the card of the route without motorway and then Start
- **THEN** the ride opens named "To Rue du Mont des Carliers 3" on that route

#### Scenario: A short trip with one road

- **WHEN** the three routes follow the same road
- **THEN** no choice is asked: the ride opens at once

#### Scenario: A jam on the motorway

- **WHEN** the server says the points of the fastest route are `heavy` for 20 km and the route without motorway flows
- **THEN** the route without motorway is selected, and the card of the fastest says "+" the minutes of traffic

#### Scenario: A road closed

- **WHEN** a point of a route is `closed`
- **THEN** its card says so and another route is selected

#### Scenario: Traffic does not answer

- **WHEN** the server has no traffic source, or does not answer within a few seconds
- **THEN** the routes are ranked by their own time and no card mentions traffic

### Requirement: Leave the search

The search screen SHALL have a Back control that returns to the list, and the phone's Back button SHALL do the same.

#### Scenario: Back

- **WHEN** the rider presses Back on the search screen
- **THEN** the list is shown
