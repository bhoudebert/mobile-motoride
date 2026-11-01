# 0047. Getting a server: one journey, no account, a purchase that is never lost

- Status: proposed
- Date: 2026-11-01

## Context

A rider with no server can rent one from the app (agentRide ADR 0057): a private sidecar verifies the store purchase and creates the
rider on a shared agentRide server. The app has to make this the smoothest sign-up a rider has met, without an account, and without
ever losing a payment. The requirements and scenarios are in `openspec/specs/hosted-server`.

## Decision

- **No account.** The app makes a random account token once (kept in the secure store) and gives it to the store with the purchase
  (Apple `appAccountToken`, Google obfuscated account id). The sidecar maps the subscription to the rider through it; Restore finds the same rider.
- **A purchase journal.** Before anything else the app writes `{accountToken, productId, step, transactionId?}` to the secure store.
  The purchase is _finished_ with the store (Apple `finish`, Google acknowledge, which Google refunds if missed for 3 days) only after
  the sidecar returned the invitation and the phone is enrolled. Every start and every return to the foreground resumes from the journal.
- **Steps are idempotent** (sidecar calls repeat safely), so resuming never pays or creates twice.
- **Two ways in on the Server screen, one way back out in each state:** Restore, Manage, Delete are always reachable and never styled as warnings except Delete.
- **Placeholders from configuration.** Plan names, inclusions, product ids and the legal URLs live in one config file, never in screens.
- The app calls the sidecar's `GET /v1/plans`, `POST /v1/purchases`, `GET /v1/account/status` (`Authorization: AccountToken <token>`),
  `POST /v1/restore`, `POST /v1/invitations` and `DELETE /v1/account` (sidecar PR #6 `docs/sidecar.openapi.json`), and the
  server's `GET /me`; mocks until both are frozen.
- Plans: Free, a paid plan (about 25 EUR a year, a temporary discount, price from the store), and Premium (TomTom traffic), shown
  as coming later and not purchasable while the backend refuses it. Retention: a free server is wiped after 12 months without
  activity, a paid one 12 months after the subscription ends; there is no backup yet, and the copy says so. Family Sharing is off.
- The app's acknowledgement tolerates "already acknowledged", since the sidecar may acknowledge Google purchases itself.

## State machine

```
 NoServer ──[Get a server]──▶ Plans ──[Buy]──▶ StoreSheet
    │  ▲                       │ ▲                │  │   │   │
    │  │                  [Close]│  [cancel]──────┘  │   │   └─[error]─▶ StoreError ─[Try again]▶ Plans
    │  │                       ▼ │                   │   └─[pending]──▶ Pending ──[store confirms]─▶ SettingUp
    │  └────────────────── NoServer                  └─[paid]──▶ SettingUp
    │                                                              │ steps: PaymentConfirmed → CreatingServer → ConnectingPhone
 [I have a server]                                                 │ [slow >20s] ▶ SettingUp+"taking longer" (keeps going)
    ▼                                                              │ [offline]   ▶ WaitingConnection ─[online]▶ SettingUp
 ScanOrEnter (existing)                                            │ [app closed] ▶ journal ─[next start]▶ SettingUp
                                                                   ▼
 Plans ─[store: already subscribed]▶ AlreadyHave ─[Connect]▶ SettingUp        Ready ─[Connect ChatGPT or Claude]▶ ChatCode ─[Done]▶ Hosted
                                                                              Ready ─[Done]▶ Hosted
 Hosted ─[Manage]▶ store settings        Hosted ─[server says suspended]▶ Lapsed ─[Resubscribe]▶ Plans
 Hosted ─[Restore]▶ Restoring ─▶ Hosted | NothingToRestore         Lapsed ─[Restore]▶ Restoring
 Hosted|Lapsed ─[Delete]▶ DeleteConfirm ─[Confirm, online]▶ Deleting ─▶ NoServer(+how to cancel)   DeleteConfirm ─[offline]▶ DeleteOffline
 NoServer ─[Restore]▶ Restoring ─▶ Hosted | NothingToRestore
```

## Screens (mock-ups, text only)

```
NoServer                               Plans (sheet)                           SettingUp
┌──────────────────────────┐          ┌──────────────────────────┐            ┌──────────────────────────┐
│ ←  Server                │          │ ———                      │            │                          │
│ The app works fully      │          │ Get a server             │            │   Setting up your server │
│ without a server.        │          │ ┌──────────────────────┐ │            │                          │
│ ┌──────────────────────┐ │          │ │ {Plan A}   {price}/mo│ │            │ ✓ Payment confirmed      │
│ │ I have a server      │ │          │ │ Includes: …          │ │            │ ● Creating your server   │
│ │ Scan or enter it     │ │          │ │ Not included: …      │ │            │ ○ Connecting this phone  │
│ └──────────────────────┘ │          │ └──────────────────────┘ │            │                          │
│ ┌──────────────────────┐ │          │ ┌──────────────────────┐ │            │ You can close the app:   │
│ │ Get a server         │ │          │ │ {Plan B}   {price}/mo│ │            │ this continues by itself.│
│ │ From the app         │ │          │ └──────────────────────┘ │            │                          │
│ └──────────────────────┘ │          │ Renews every month until │            │ [ Close ]                │
│ Restore purchases        │          │ you cancel, in your store│            └──────────────────────────┘
└──────────────────────────┘          │ settings. Terms · Privacy│
                                      │ [ Buy {Plan A} — {price}]│   Ready                       ChatCode
                                      │ [ Not now ]              │   ┌──────────────────────┐    ┌──────────────────────┐
                                      └──────────────────────────┘   │ Your server is ready │    │ Connect ChatGPT or   │
Hosted                                 Lapsed                         │ Roadbooks, rides and │    │ Claude               │
┌──────────────────────────┐          ┌──────────────────────────┐   │ traffic use it now.  │    │     K7QM-4X2P        │
│ ←  Server                │          │ ←  Server                │   │ [Connect ChatGPT or  │    │ [Copy]               │
│ Your server   ● Ready    │          │ Your server is paused    │   │  Claude]             │    │ Valid 10 min, once.  │
│ What it includes: …      │          │ Your library stays on the│   │ [ Done ]             │    │ 1 Open … 2 Paste …   │
│ Traffic 12 left today    │          │ server until {date}.     │   └──────────────────────┘    │ [ Done ]             │
│ Manage subscription      │          │ Your phone's rides and   │                                └──────────────────────┘
│ Restore purchases        │          │ roadbooks are untouched. │   DeleteConfirm
│ Delete my server and data│          │ [ Resubscribe ]          │   ┌──────────────────────────────────────────┐
└──────────────────────────┘          │ Restore purchases        │   │ Delete your server and data?             │
                                      └──────────────────────────┘   │ Your library and rides on the server are │
Pending / StoreError / Offline / Slow: one line of plain text, one │   erased for good. Copies on this phone  │
action (Close or Try again), no spinner longer than the step.        │   stay. This does not cancel the         │
                                                                     │   subscription: Manage subscription.     │
                                                                     │ [ Delete my server and data ] [ Keep it ]│
                                                                     └──────────────────────────────────────────┘
```

## Consequences

The purchase journal adds a small persistent state machine to test hard (kill at every step, offline at every step, duplicate
callbacks). The app depends on the sidecar being up to buy or restore, never to ride. Plan content in configuration means no
release for a price or wording change; the store's price stays the truth. The IAP library choice is the next record (ADR 0048).

## Alternatives considered

An email or social sign-up: more screens, a password or provider to hold, and not needed since the store already identifies the buyer.
Finishing the purchase at once and creating the server afterwards: simpler, and loses a payment whenever the sidecar is down.
