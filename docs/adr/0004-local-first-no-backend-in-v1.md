# 0004. Local-first, no backend in v1

- Status: accepted
- Date: 2026-10-18

## Context

Shipping a store app does not require a backend. User management is needed
only for things that cross devices or cost money: sync, sharing, a library fed
by agentRide, subscriptions, traffic keys that must not live in the APK.

## Decision

Version 1 has **no backend and no accounts**. Roadbooks are bundled with the
app (ADR 0005). Settings live on the device. A backend is added when the first
feature that truly needs one is built, in this order of likelihood: (1) the
roadbook library fed from agentRide, (2) a proxy for paid traffic APIs,
(3) accounts and sync. When it comes, prefer a managed service (for example
Supabase: auth, Postgres, storage) over a custom server, and keep the GPX
roadbook as the contract between agentRide and the app.

## Consequences

Fast to ship and nothing to operate or secure. No sync, no sharing, new
roadbooks need an app update until the library exists. Paid API keys cannot be
used yet (they would leak from the APK).

## Alternatives considered

Backend first: months of work before a rider can follow a track. Custom
server: more to run than a managed auth and database for a solo maintainer.
