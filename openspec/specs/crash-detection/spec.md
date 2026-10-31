# Crash Detection Specification

## Purpose

Notice a crash or a fall of the bike while riding, ask the rider if they are all right, and when no one answers, tell whoever can be told (ADR 0039).
It is a help, not a guarantee: it can miss a crash and it can be wrong, and the screen says so.

## Requirements

### Requirement: What counts as a crash

During a ride on the phone's GPS the system SHALL read the accelerometer and the GPS speed and raise an alert when all of this happens:

- a **shock** of 4 g or more while the bike had gone at 8 m/s (29 km/h) or more in the 5 seconds before, or of 2.5 g or more for a bike that is slower but was moving in the last minute (a **fall**);
- the bike then **stands still** (GPS speed under 1.5 m/s) for 10 seconds, the stillness beginning within 8 seconds of the shock;
- and the phone is **no longer upright**: 45° or more from upright for a crash, 60° or more for a fall, upright being what the phone's gravity was while riding along (learned on the ride, so a phone mounted at any angle works); a crash from 15 m/s (54 km/h) or more SHALL count even when the phone is still upright.

A pothole (a shock and the bike goes on), a hard stop (no shock), a corner, a bike on its side stand and a phone knocked while parked SHALL NOT raise an alert. With no GPS speed
nothing is raised. After an alert nothing is looked for during the next two minutes.

#### Scenario: A crash at 72 km/h

- **WHEN** at 20 m/s the phone feels 8 g, the speed falls to 0 and the phone lies on its side for ten seconds
- **THEN** the alert starts

#### Scenario: A pothole

- **WHEN** the phone feels 6 g at 20 m/s and the bike goes on at that speed
- **THEN** nothing is raised

### Requirement: The alert

The alert SHALL cover the screen with "Possible crash", a countdown of 30 seconds, and one very large button "I'm OK". It SHALL vibrate and speak "Crash detected. Tap the screen if you
are all right." at once and every 8 seconds (in every voice mode but Off, and lowering the music, spec voice-guidance). The phone's Back button SHALL NOT close it: only "I'm OK". "I'm OK" stops the vibration and
the voice, closes the alert, and marks a live ride as fine again.

#### Scenario: All is well

- **WHEN** the rider presses I'm OK during the countdown
- **THEN** the alert closes, the vibration and the voice stop, and nothing is sent to anyone

### Requirement: When no one answers

When the countdown reaches 0 the alert SHALL say "No answer. Alert sent." aloud and show what was done:

- If the ride is shared live (spec live-share) the system SHALL send the position at once with the state "alert", and again every 30 seconds until the rider presses I'm OK, and SHALL say "Your live ride now shows a possible crash and your position to anyone who has its page open. Nobody was called or texted." The follower page shows a possible crash and the position **to someone who has it open**: there is no notification, and nobody is called or texted. A server or a follower mode that notifies is a later step (ADR 0039).
- Otherwise it SHALL say "No one was told automatically. Send the message or call.".
- In both cases it SHALL offer **Message {name}** (or "Write the message"), which opens the messages app with a text for the emergency contact and the last position as a map link, ready to send by the person who has the phone, and **Call 112**, which opens the dialler with 112. The app SHALL NOT send a message or place a call by itself.

#### Scenario: A shared ride

- **WHEN** no one answers and the ride is shared live
- **THEN** the live ride shows the alert with the position to anyone who has the follower page open, and the screen says that, and that nobody was called or texted

### Requirement: Settings, contact and test

The menu SHALL offer **Safety**, a page with: crash detection on or off (on by default, kept between launches; off means the sensors are not read for it), the emergency
contact (a name and a phone number, checked as a phone number, saved or removed), the sentence that to alert someone automatically the ride must be shared live with them, and **Try the alert**,
which shows the alert for 10 seconds, labelled as a test, and at its end says "The test is over. Nothing was sent." without offering a message or a call. Only a ride on the phone's GPS is watched, not a demo or a scripted ride.

#### Scenario: A test

- **WHEN** the rider presses Try the alert and waits 11 seconds
- **THEN** the page says the test is over and nothing was sent, and no message or call was offered

### Requirement: What the app does not do

The app SHALL NOT claim that help is on the way: its words say what was done ("Your live ride now shows a possible crash") and what was not ("No one was told automatically"). The sensors are read only
while a ride on the phone's GPS runs with detection on; nothing of them leaves the phone except, after an alert, the position in the live share and in the message the person with the phone chooses to send.

#### Scenario: An alert is raised

- **WHEN** a possible crash is detected and the rider does not answer
- **THEN** the words say what was done ("Your live ride now shows a possible crash") and what was not ("No one was told automatically"), and the app never says help is on the way
