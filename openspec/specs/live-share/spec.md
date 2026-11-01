# Live Share Specification

## Purpose

Let the rider share a ride with people who follow from a link, through a server of their choice, with the positions encrypted so that the server cannot read them (ADR 0029; the relay is agentRide's, its spec live-sharing).

## Requirements

### Requirement: A server of the rider's choice

The app SHALL keep an optional server setting: an address (https; http only for this phone or a local network address) and a token. It SHALL be changed in a "Server" screen of the menu, and filled in by a link `mobilemotoride://server?url=<address>&token=<token>` after the rider confirms it, naming the address. The token SHALL be kept in the phone's secure store and never shown in full once saved nor written to a log. The rider SHALL be able to test the setting (the app creates and removes a ride on the server, and says whether it worked, the token was refused or the server could not be reached) and to remove it. What the screen says about what was just done (saved, tested, removed, joined, refused) SHALL be shown right above the block it concerns, the one with the Test button when a server is set, never at the top of the screen away from it. With a server set, the screen SHALL NOT show the address and token fields: to use another server the rider removes this one, and the fields come back. Without a server, nothing of live sharing SHALL show or run.

#### Scenario: A link from the administrator

- **WHEN** the rider opens `mobilemotoride://server?url=https://rides.example.org&token=mrt_…`
- **THEN** the app asks to use rides.example.org as its server, and keeps it only after a yes

### Requirement: Join with an invitation

A link `mobilemotoride://server?url=<server>&code=<code>`, such as the QR code of agentRide's `admin invite` carries, SHALL open the Server screen on the invitation: the address it names, a field for a PIN (if the rider was given one) and a button to join, and nothing SHALL be set before the rider joins. Joining SHALL send the code (and PIN) to `POST /enrol` of that server and keep the token it returns as the server setting. A server that wants a PIN and did not get one SHALL be answered by asking for it; a wrong PIN SHALL say how many tries are left, a burnt invitation SHALL say to ask for a new one, an unknown, used or expired code SHALL say the invitation is no longer valid, and a server that cannot be reached SHALL say so, each keeping the invitation on screen until it is joined or put away. The code and the PIN SHALL NOT be kept after joining. An address that is not acceptable SHALL be refused as for any server link.

#### Scenario: Scan and join

- **WHEN** the rider scans the invitation QR code with the phone's camera and opens the link
- **THEN** the app shows the server's address, asks for the PIN if there is one, and after Join the server is set and its test works

### Requirement: Share a ride live

With a server set, the ride screen SHALL offer, before a ride on the phone's GPS starts, to share it live. Starting such a ride SHALL make a channel on the server and a key on the phone, and open the phone's share sheet with a message and the link `https://<server>/follow/<channel>#<key>`, so that it can be sent through any app. While the ride runs the app SHALL send the position about every 30 seconds while moving (a speed of 1 m/s or more) and every 2 minutes while stopped, each update encrypted on the phone with AES-256-GCM, a fresh random nonce and the channel as associated data, carrying the position, speed, heading, accuracy, whether the rider is riding or stopped and the roadbook's name. A pause SHALL send a stopped update; ending the ride SHALL send an ended update and end the channel; leaving the ride screen SHALL do the same. Nothing SHALL be shared for a demo or a scripted ride, or without the rider's choice.

#### Scenario: Share and ride

- **WHEN** the rider chooses to share, starts the ride and sends the link to a friend
- **THEN** the friend sees the rider's position and trail on a map, updated about every 30 seconds

### Requirement: Share a ride that is already under way

With a server set, a ride on the phone's GPS that is not shared (the rider did not choose it before the start, or stopped it) SHALL say so and offer to share it. Choosing it SHALL make a new channel and a new key, and open the share sheet with the new link, as at the start; the link of an earlier channel stays dead.

#### Scenario: Share again to someone new

- **WHEN** the rider stops sharing a ride, then chooses to share it again and sends the new link to another friend
- **THEN** the first link no longer works and the new one shows the rider's position

### Requirement: See it, send the link again, stop

While a ride is shared, the ride screen SHALL say so on a line (folded away with the buttons while riding, spec ride-control) that offers to send the link again (also while sharing is interrupted) and to stop sharing. Stopping SHALL remove the ride from the server at once and send nothing more; the ride itself goes on. A failure to reach the server SHALL NOT stop the ride or its guidance: the app says it is not sharing at the moment and tries again with the next update; a server that no longer knows the channel (it was restarted) SHALL be given the channel again.

#### Scenario: No network for a while

- **WHEN** the phone has no network for ten minutes in a shared ride
- **THEN** the ride and its voice go on, the line says sharing is interrupted, and it resumes when the network comes back

### Requirement: What the server and the followers learn

The server SHALL learn only that a rider shares, when and how often, never where; the key SHALL appear only in the link's fragment and in the rider's share. The link SHALL be kept on the phone only while the ride is shared.

#### Scenario: A server that reads everything

- **WHEN** a hostile server stores every request of a shared ride
- **THEN** it holds ciphertext and nonces, and no position, speed or name
