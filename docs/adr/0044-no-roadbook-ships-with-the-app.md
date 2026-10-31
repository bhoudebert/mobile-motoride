# 0044. No roadbook ships with the app

- Status: accepted
- Date: 2026-10-30

## Context

The first versions bundled four roadbooks made by agentRide (ADR 0005) so the app worked with nothing else. They have
no purpose now: the rider imports a file (ADR 0025) or fetches from their server (spec roadbook-library), and the bundled
ones carried old speed limits that were wrong or assumed. They also sat in every list and could not be deleted.

## Decision

The app ships no roadbook. The list holds what the rider imported or fetched, and tells a new rider how to get one. The four
real roadbooks stay in `test/fixtures/roadbooks` for the tests: the core tests run on them and the UI tests keep them as
imported roadbooks. The device smoke does not read them from the app: it starts agentRide's server on the computer with a test
rider, pushes the fixtures to it, points the phone at it and downloads them from the list, so the smoke rides what a rider's
phone gets from a server. `npm run bundle:roadbooks` is removed.

## Consequences

- A new install has an empty list until a file or a server gives it a roadbook.
- The smoke needs agentRide next to this repository, with the push to a server (agentRide PR 138).
- Supersedes the bundling part of ADR 0005.
