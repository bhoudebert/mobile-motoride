# Appearance Specification

## Purpose

Let the rider read the app in full sun and at night: a light and a dark look, the phone's by default, or one fixed in the menu (ADR 0033).

## Requirements

### Requirement: A light and a dark look

The system SHALL have a light look and a dark look, and every screen SHALL be readable in both: the roadbook list, the map and its
buttons, the ride screen with its panels, warnings and gauges, the menu, the settings and the questions. In both looks every text
SHALL keep its contrast against its background (at least 4.5:1, 3:1 for large text), the route and the markers SHALL stand out from
the map, and a warning SHALL look the same in both: a sharp corner is yellow with dark text and a hairpin is rust with light
text, whatever the look. The map SHALL follow the look: a dark basemap in the dark look when the plain basemap is on.

#### Scenario: A dark ride

- **WHEN** the dark look is on and a hairpin warning appears on the ride screen
- **THEN** its text is light on rust and readable, and the map behind it is dark

### Requirement: The look the rider chooses

The system SHALL follow the phone's light or dark setting by default (**System**), also while the app runs (the phone going dark
at dusk), and let the rider choose **Light** or **Dark** in the menu of the home screen, one tap changing it in the order System,
Light, Dark. The choice SHALL be kept between launches and take effect at once on every screen. The item SHALL be named with the
current choice and what a tap does ("Theme: System (dark). Tap to change"). When the phone does not say, the look is light. A
fixed choice SHALL NOT follow the phone.

#### Scenario: A dark phone

- **WHEN** the phone is in its dark mode and the rider has not chosen a look
- **THEN** the app is dark, and the menu item says "Theme: System (dark)"

#### Scenario: A fixed look

- **WHEN** the rider chooses Light on a phone that goes dark
- **THEN** the app stays light until the rider changes the choice
