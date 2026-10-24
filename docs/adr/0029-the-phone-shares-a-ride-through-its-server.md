# 0029. The phone shares a ride through its server

- Status: accepted (the phone's side of ADR 0028 of this repository and of agentRide's ADR 0028)
- Date: 2026-10-19

## Context

Live sharing needs a relay (agentRide's multi-user server, which passes encrypted updates and serves the follower's page) and
a phone that makes the link and sends the updates. The app stays serverless by default (ADR 0004): everything here is
behind one optional setting.

## Decision

The rider sets a server (address and token) in a "Server" screen, or by a link the administrator sends; the token goes in the
phone's secure store. Before a GPS ride the ride screen offers to share it; starting the ride makes a random channel and a
random 256-bit key on the phone and opens the share sheet with the link `https://<server>/follow/<channel>#<key>`. The app
encrypts each position with AES-256-GCM (`@noble/ciphers`, with random bytes from `expo-crypto`; the channel is the
associated data, as the follower's page expects) and posts it with the token, about every 30 seconds while moving and every 2
minutes when stopped; a pause sends a stopped update and the end of the ride an ended one. The sharing hook rides on the
fixes the ride already gets and on the foreground service of ADR 0020, so it goes on with the screen off. A failure to
reach the server never touches the ride.

## Consequences

A rider with no server sees nothing new. A shared ride costs one small request every 30 seconds and a little battery. The
link is the secret: anyone who has it follows, and the rider can stop at any time, which removes the ride at once. The
token in the secure store is the rider's identity on the server: a lost phone's token is ended by the administrator
(`admin devices --revoke`, or `admin token` for the rider's own).

**Joining** is by invitation (agentRide's ADR 0029): the QR code of `admin invite` carries a one-time code, not a token; the
app asks before it joins, sends the code (and the PIN, if there is one) to the server's `/enrol`, and keeps the token it gets
back. The code is held in memory until then and never stored. A server link with a token (`&token=`) still works for a
rider who has one, and the address and token can still be typed. A ride under way that is not shared can be shared from the
ride screen (a new channel and link each time), and a server that is down at the start is tried again until it answers.

## Alternatives considered

Pure JavaScript crypto in the app versus a native library (`react-native-quick-crypto`): the native one is faster and heavier
to build; 120 bytes every 30 seconds does not need speed. Sharing from the Key sheet or a map control: the ride screen's
controls are full, so the choice sits in the idle panel and a line shows the state during the ride.
