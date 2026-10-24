# 0028. An optional server for live sharing and sync

- Status: accepted (direction; nothing of it is built in the app yet)
- Date: 2026-10-19

## Context

The app has no backend and the owner wants it to stay that way (ADR 0004): everything works with the phone alone. Three
wishes need something between phones or between the phone and agentRide: followers watching a ride live, the
roadbooks of an agentRide library reaching the phone without moving files, and a recorded ride going back to agentRide
for review. The public relays that exist have daily limits that a ride of a few hours would exceed, so a relay is a
service somebody runs.

## Decision

The app stays serverless by default and gains one optional setting, a **server**: an address and a token (a link
`mobilemotoride://server?url=…&token=…`, or a QR code of it, fills it in). The server is agentRide's multi-user server (its
ADR 0027): one instance, one SQLite library per rider, reached by token. It may be run by the rider on their own machine,
by anyone on any host (a Docker image and a Nix module are planned), or by us for a fee. With a server set the app can: list
and download the rider's roadbooks (the roadbook file is still the contract, ADR 0010), send a recorded ride back (the GPX
already names its roadbook by agentRide's number and name, ADR 0027 of the app is the ride recording one), and share a ride
live. A live ride is a link whose fragment holds an encryption key: the app encrypts every position on the phone, the server
relays and keeps only what it cannot read, and the follower's page decrypts in the browser, so a hosted server never sees
where anybody rides. Sharing starts only when the rider taps it, ends with the ride, and is limited by the server's own
quotas, not by a public service's.

## Consequences

Nothing changes for a rider who sets no server. The feature set that needs a backend grows behind one setting, one
protocol and one thing to run. A paid hosted offer is possible later (billing and Google Play's rules for selling inside
the app to be checked first). Positions are personal data: they are encrypted end to end, kept only as long as a ride, and
never stored in the clear, but a hosted offer still needs terms and a way to delete an account.

## Alternatives considered

The public ntfy.sh relay: free, about 250 messages a day per sender, not enough for a ride. A Cloudflare Worker of our own:
generous free limits, but one more thing to write, deploy and pay for beside agentRide's server. Telegram live location:
quick, but only for followers on Telegram.
