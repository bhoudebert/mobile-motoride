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

Choosing a place SHALL ask for the position of the phone (the location permission, if not yet given), ask for a motorcycle route from there to the place, and open it as a roadbook named "To <place>" with the position as its start and the place as its finish, riding from the start as any roadbook: instructions, corner warnings, voice and the background service. The roadbook SHALL not be saved: it lives until the rider leaves the ride. When the position is refused or unknown, or no route can be had, the screen SHALL say so and stay on the results; it SHALL NOT open a ride on a straight line.

#### Scenario: A route is found

- **WHEN** the rider chooses "Mons" and a route comes back
- **THEN** a ride opens named "To Mons" with its distance

#### Scenario: Location refused

- **WHEN** the rider refuses the location permission
- **THEN** the screen says the position is needed and stays on the results

#### Scenario: No route

- **WHEN** the routing service gives no route
- **THEN** the screen says no route could be had now, and the rider can choose again

### Requirement: Leave the search

The search screen SHALL have a Back control that returns to the list, and the phone's Back button SHALL do the same.

#### Scenario: Back

- **WHEN** the rider presses Back on the search screen
- **THEN** the list is shown
