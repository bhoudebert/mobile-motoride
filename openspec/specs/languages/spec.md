# Languages Specification

## Purpose

Let a rider use the app, and hear it, in English or French: the phone's language by default, switchable in the menu (ADR 0032).

## Requirements

### Requirement: English and French

The system SHALL offer its screens and its spoken messages in English and in French. Anything the rider reads or hears that the app
writes itself is translated: buttons, titles, messages, accessibility labels, turn instructions, corner and danger warnings,
junction and lane guidance, status messages, distances, dates and the summary of a recorded ride. The same screen in both languages
SHALL offer the same things: a translation never adds, drops or reorders a control, or changes a figure.

What comes from outside the app is not translated: the texts and names of a roadbook file (ADR 0010), place names from the map and
from the search, and the content of the rider's own server. Each language SHALL have every message of the other, checked by the
type checker and by a test, so no screen shows a missing text.

#### Scenario: A French phone

- **WHEN** the phone's language is French and the rider has not chosen a language
- **THEN** the screens are in French and a hairpin ahead is spoken in French, by a French voice

#### Scenario: Another language

- **WHEN** the phone's language is neither English nor French and the rider has not chosen a language
- **THEN** the app is in English

### Requirement: The language the rider chooses

The system SHALL follow the phone's language by default (**System**) and let the rider choose **English** or **Français** in the menu
of the home screen, one tap changing it in the order System, English, Français, as the voice does. The choice SHALL be kept between
launches and take effect at once on every screen, without restarting the app. The item SHALL be named with the current choice and say
what a tap does ("Language: System (English). Tap to change"), in the language in use. The language names are always written in their own
language ("English", "Français").

The menu is on the home screen, so a language change never happens during a ride; a ride in progress keeps the language it started with.

#### Scenario: Switching to French

- **WHEN** the rider taps the language item until it says "Langue : Français"
- **THEN** the menu and the home screen are in French at once, and still are after the app is closed and opened again

#### Scenario: Back to the phone's language

- **WHEN** the rider chooses System
- **THEN** the language is the phone's again, English if the phone's is neither English nor French

### Requirement: Spoken in the language

The system SHALL speak in the language in use with a voice of that language (en-GB for English, fr-FR for French) and write the
distances, the dates and the decimals the way that language does ("1,5 km" in French, "1.5 km" in English). The words of a message that
count something SHALL agree with the count in both languages (1 minute, 2 minutes).

#### Scenario: A turn in French

- **WHEN** the language is French and a right turn is 500 m ahead
- **THEN** the text and the voice say "Dans 500 mètres, tournez à droite", not "In 500 metres, turn right"
