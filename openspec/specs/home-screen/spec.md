# Home Screen Specification

## Purpose

Open the app on the map of where the rider is, with the three things a rider does first within reach: go somewhere, ride a roadbook, pick up a recent ride (ADR 0024).

## Requirements

### Requirement: The map first

The app SHALL open on a full-screen map centred on the rider's position, without the name of the app on screen. A marker SHALL show the position. When the position is not allowed or not known yet, the map SHALL still show, on a wide view, and a line SHALL say that the location is needed to see where the rider is, with a way to allow it; it SHALL NOT block the rest of the screen. A control SHALL bring the map back to the rider's position.

#### Scenario: Position known

- **WHEN** the app opens and the phone gives its position
- **THEN** the map is centred on it with a marker

#### Scenario: Location refused

- **WHEN** the rider has refused the location permission
- **THEN** the map is shown wide, the search and the roadbooks still work, and a line says the location is needed

### Requirement: Where to, roadbooks and recent rides

A bottom panel SHALL offer: a search field "Where to?" which opens the search for a place (spec destination-routing); a "Roadbooks" control, as wide as the search field and centred, which opens the list of roadbooks; and the recent rides. It SHALL show the most recent two at rest and all of them (at most 8) when pulled up or tapped on its handle, and fold back by pulling down or tapping the handle again. With no recent ride it SHALL say where they will appear.

#### Scenario: Pull up the recent rides

- **WHEN** the rider has five recent rides and swipes up on the panel
- **THEN** the five are listed

### Requirement: Recent rides

A ride SHALL be remembered when it is opened from a place or from a roadbook: the place with its position, or the roadbook by its identity, newest first, without duplicates (the same place or roadbook moves to the top), at most 8, kept between launches. Choosing a recent roadbook SHALL open its ride; choosing a recent place SHALL route to it from the rider's position as in spec destination-routing, with the same messages when that fails. A rider SHALL be able to clear the recent rides.

#### Scenario: A place again

- **WHEN** the rider chooses a recent place
- **THEN** a route is asked from the rider's position and the ride opens named "To <place>"

#### Scenario: Same roadbook twice

- **WHEN** the rider opens the same roadbook twice
- **THEN** it appears once in the recent rides, at the top

### Requirement: Menu

A menu control SHALL open a panel with: Roadbooks, Go to a place, the voice mode (changed with one tap, as on the ride screen), Clear recent rides, and a short About with the map attribution. It SHALL close on a tap outside it, on its close control and on the phone's Back button.

#### Scenario: Close by Back

- **WHEN** the menu is open and the rider presses the phone's Back button
- **THEN** the menu closes and the app stays on the home screen

### Requirement: Back goes where the rider came from

Leaving a ride SHALL return to the screen it was opened from: the home screen for a ride opened from a place, a recent ride or the search, the list of roadbooks for a roadbook chosen there. The Back control of the ride SHALL be named for where it goes ("Back to the map", "Back to the list").

#### Scenario: Back from a recent ride

- **WHEN** the rider leaves a ride opened from a recent place
- **THEN** the home screen is shown

### Requirement: Back is an arrow

The way back at the top of the screens (the list of roadbooks, My rides, a ride's review, the search for a place, the server, the safety page) SHALL be a bold arrow, not a word, so that it takes the same place in every language. It SHALL keep a target of at least 48 by 48 dp and its name ("Back to the map", "Back to the list") for a screen reader.

#### Scenario: An arrow with a name

- **WHEN** the list of roadbooks is open
- **THEN** its top shows an arrow and no word "Back", and a screen reader names it "Back to the map"

### Requirement: Swipe back

The screens that have a way back at the top (the list of roadbooks, My rides, a ride's review, the search for a place, the server) SHALL also go back when the rider sweeps a finger from the left edge of the screen to the right, mostly sideways and far enough, to the same place as the arrow. A tap, a scroll and a swipe that starts away from the edge SHALL NOT go back. The ride and the safety page SHALL NOT go back this way: a swipe made on a bike must not end a ride or leave a crash alert.

#### Scenario: Swipe from the edge

- **WHEN** the list of roadbooks is open and the rider sweeps from the left edge to the right
- **THEN** the home screen is shown

#### Scenario: A scroll is not a swipe back

- **WHEN** the rider scrolls the list of roadbooks up and down
- **THEN** the list stays open
