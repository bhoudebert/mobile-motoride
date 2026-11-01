# Hosted Server Specification

## Purpose

Let a rider who has no server get one from the app, with the fewest steps and nothing to type or scan, and keep every way out
(restore, manage, delete) one calm tap away. The decision and the screens are in ADR 0047. Plan names and prices are not decided:
they come from configuration and from the store, never from the screens' code.

At launch everything is free: there is no purchase, no store product and no paid plan on sale. The requirements about the store
sheet, restore, manage, subscribed on another device and a lapsed subscription are kept for the day a paid plan exists
(ADR 0048 and its spike) and are not built; the rest apply now.

## Requirements

### Requirement: Two paths on the Server screen

With no server set, the Server screen SHALL offer two clearly separate paths: "I have a server" (scan its invitation or enter the
address and token) and "Get a server" (from the app). It SHALL keep saying that the app works fully without a server. With a hosted
server set it SHALL show its state instead (status, what it includes, Manage subscription, Restore purchases, Delete my server and data).

#### Scenario: No server

- **WHEN** the rider has no server and opens the Server screen
- **THEN** it shows "I have a server" and "Get a server" as two separate choices and says the app works fully without one

#### Scenario: Hosted server set

- **WHEN** the server set on the phone was created by the app's purchase
- **THEN** the screen shows its status and the three calm actions Manage subscription, Restore purchases and Delete my server and data

### Requirement: Plan sheet

"Get a server" SHALL open a sheet that, at launch, shows one card: Free during launch, with what it includes in plain words, the regular yearly price the sidecar names (its `launchOffer`: a number of euros, formatted by the app for the rider's locale) struck through, with the sidecar's own wording beside it, when there is one and nothing when there is not, and no purchase action. It SHALL say that it is free for now and that this may change later, and SHALL NOT promise that it stays free. It SHALL say who provides it (Adequate Function). Plan names, prices and offers SHALL come from the sidecar and the store, never from the screens' code, and a plan that is not on offer (a paid plan, Premium) SHALL NOT be shown. When a paid plan is on sale the sheet SHALL also show, for it, the price and period as the store returns them, that the subscription renews automatically until cancelled, how to cancel it, and links to the Terms and the Privacy policy. The sheet SHALL show no countdown, no pre-selected upsell and no pressure wording, and the choice not to take a server SHALL be as visible as the choice to take one.

#### Scenario: Plans shown

- **WHEN** the rider opens "Get a server" and the sidecar answers with the free plan and a launch offer of 25 euros and the text "Free during launch, normally 25 EUR per year"
- **THEN** one card reads "Free during launch" with "€25" struck through and the sidecar's text, "Free for now. This may change later." and a "Get a free server" action, and no price is written in the app

#### Scenario: Plans that are not on offer

- **WHEN** the sidecar lists a paid plan and Premium that are not available
- **THEN** neither is shown

#### Scenario: Store unavailable

- **WHEN** the store cannot be reached or has no such product
- **THEN** the sheet says the store is not available now, offers Try again and Close, and shows no price it does not know

### Requirement: Purchase through the store

The app SHALL start the purchase with the store's own sheet and an account token it made once at random and keeps (ADR 0047), and
SHALL NOT ask for an email, a password or any sign-up. A cancelled sheet SHALL return to the plan sheet with nothing changed. A
purchase the store holds as pending (ask to buy, slow payment) SHALL be shown as pending, with what happens next, and SHALL NOT
block the rest of the app.

#### Scenario: Rider cancels in the store sheet

- **WHEN** the rider dismisses the store's sheet without paying
- **THEN** the plan sheet is shown again, nothing is charged and nothing is stored

#### Scenario: Purchase pending

- **WHEN** the store reports the purchase as pending
- **THEN** the screen says "Waiting for the store to confirm your payment", that it can be closed, and that setup continues by itself when the store confirms

### Requirement: The free server

Choosing Free SHALL open no store sheet and ask for no payment: the app asks the sidecar for a free server with the account token alone, and continues with the same setup step, success and next step as a paid server. Asking again SHALL give the same server. Upgrading from Free to the paid plan SHALL keep the same server and library, and SHALL be offered from the Server screen as a calm choice, never as a nag. The plans, and whether each can be chosen, SHALL come from the sidecar's list of plans.

#### Scenario: Free server

- **WHEN** the rider chooses Free
- **THEN** no store sheet opens, "Setting up your server" runs, and the phone is enrolled on a free server

#### Scenario: Upgrade keeps the library

- **WHEN** a rider with a free server buys the paid plan
- **THEN** the same server and library are kept, with more allowed, and nothing is copied or lost

### Requirement: Setting up the server

After a confirmed purchase the app SHALL show one "Setting up your server" step with real progress (payment confirmed, creating the
server, connecting this phone), no longer than needed. The app SHALL write a durable record of the purchase before it asks the
sidecar anything, SHALL tell the store the purchase is finished only after the server is created and the phone is enrolled (an acknowledgement already made by the sidecar is not an error), and
SHALL resume from the record whenever the app starts or returns to the foreground. A purchase SHALL never be lost because the app was closed,
the phone was offline or the sidecar was slow.

#### Scenario: App closed mid-way

- **WHEN** the app is killed after payment and before the server is ready
- **THEN** the next start resumes the setup from the record and ends enrolled, without asking to pay again

#### Scenario: Verification delayed

- **WHEN** the sidecar has not confirmed the purchase after the usual wait
- **THEN** the screen says it is taking longer than usual, that nothing is lost and the rider is not charged twice, offers Close, and keeps trying in the background

#### Scenario: Offline during setup

- **WHEN** the phone has no connection while setup is under way
- **THEN** the screen says it will continue when the connection returns, and resumes by itself

### Requirement: Success and next step

When the server is ready the app SHALL be enrolled with the invitation the sidecar returned, with nothing scanned or typed, and SHALL
offer two choices: "Connect ChatGPT or Claude" and "Done". "Connect" SHALL call the server for a one-time code, show it large, selectable to copy and with a Share action, say it lasts 10 minutes and works once, and list the steps of the guide.

#### Scenario: Done

- **WHEN** setup ends and the rider taps Done
- **THEN** the Server screen shows the hosted server's state and the app uses it for roadbooks, rides and traffic

#### Scenario: Connect a chat

- **WHEN** the rider taps "Connect ChatGPT or Claude"
- **THEN** the phone asks the server for a code and shows it as XXXX-XXXX, selectable, with Share, "valid 10 minutes, works once" and the steps; a new code can be asked once it has expired

### Requirement: What the account allows

The app SHALL read what the rider may use from the server's `GET /me` (traffic mode off, open, tomtom or host, the daily allowance and what was used today, the library limit and what is used, and whether the rider is paused with its reason and end date) and
SHALL show or hide a feature accordingly, saying why when it is hidden (for example "Traffic: 12 requests left today").

#### Scenario: Traffic limit reached

- **WHEN** the server says no traffic requests are left today
- **THEN** the traffic card says so and when it comes back, and the route keeps showing without traffic colour

#### Scenario: Paused or invalid token

- **WHEN** `GET /me` answers with `suspended` set, or answers 401
- **THEN** the first shows "Your server is paused" (the lapsed path), the second says the phone's access is no longer valid and offers Restore purchases and the two paths

### Requirement: Restore purchases

The Server screen SHALL show a calm "Restore purchases" link, with or without a server. It SHALL ask the store for the rider's
subscriptions, find the same server through the account token the purchase carries, and enrol the phone. When there is nothing
to restore it SHALL say so.

#### Scenario: New phone

- **WHEN** the rider installs the app on a new phone and taps Restore purchases with the same store account
- **THEN** the same server is found and the phone is enrolled, with no second payment

#### Scenario: Nothing to restore

- **WHEN** the store has no active or lapsed subscription for this app for the rider
- **THEN** the screen says no purchase was found, and offers Get a server

### Requirement: Manage subscription

"Manage subscription" SHALL open the store's own subscription settings for the rider (App Store or Play), never an in-app cancel flow
of the app's own.

#### Scenario: Manage

- **WHEN** the rider taps Manage subscription
- **THEN** the store's subscription settings open

### Requirement: Subscribed on another device

When the store says the rider already has an active subscription (bought on another phone or another app install), the app SHALL NOT
offer a second purchase, SHALL say it found a subscription, and SHALL offer to connect to it (the restore path).

#### Scenario: Already subscribed

- **WHEN** the rider opens the plan sheet while the store shows an active subscription of this app
- **THEN** the sheet says "You already have a server" and offers Connect this phone instead of Buy

### Requirement: Lapsed subscription

When the subscription has lapsed, the app SHALL say so in plain words, say what is kept (the library and rides stay on the server for
the retention period, with its end date: a paid server is wiped 12 months after the subscription ends or is cancelled, a free one after 12 months without activity), say that the phone's own rides and roadbooks are untouched and the app keeps
working without the server, and offer Resubscribe and Restore purchases. It SHALL NOT show the lapse as an error or nag on the ride screen.

#### Scenario: Lapsed

- **WHEN** the server answers that the rider is suspended because the subscription lapsed
- **THEN** the Server screen says "Your server is paused", what is kept and until when, and offers Resubscribe

#### Scenario: Riding while lapsed

- **WHEN** the rider rides with a lapsed server
- **THEN** the ride screen shows nothing about it

### Requirement: Delete my server and data

The Server screen SHALL offer, in the app, "Delete my server and data". It SHALL say in plain words what is erased (the library and
rides on the server, for good, with no way back), that the phone's own copies stay, and that the store subscription is not cancelled
by it and how to cancel it (a link to Manage subscription). It SHALL ask for one explicit confirmation naming the consequence, then
delete through the sidecar and return the app to the no-server state.

#### Scenario: Delete

- **WHEN** the rider confirms the deletion
- **THEN** the server and its data are deleted, the setting is cleared, the Server screen shows the two paths again, and the screen tells how to cancel the subscription

#### Scenario: Delete refused while offline

- **WHEN** the phone is offline when the rider confirms
- **THEN** nothing is cleared and the screen says to try again with a connection

### Requirement: Looks and reach

Every screen of the journey SHALL work in light and dark, in English and French, with large text (no truncation of prices or
wording), with screen-reader labels and an order that follows the visual order, with the main action reachable by thumb in the lower
half, and with touch targets of at least 44 pt.

#### Scenario: Large text

- **WHEN** the system text size is at its largest
- **THEN** the plan sheet shows every price, period and cancellation wording in full, scrolling instead of cutting

#### Scenario: Screen reader

- **WHEN** a screen reader is on
- **THEN** each plan reads as one element with name, price, period and renewal, and the Buy action says what it costs

### Requirement: On by default, switchable off

"Get a server" SHALL appear for a rider with no server, at the address of the project's sidecar, unless a build switches it off or points it at another sidecar. Everything else about the Server screen SHALL be unchanged without it.

#### Scenario: Switched off

- **WHEN** a build switches the feature off
- **THEN** the Server screen shows no "Get a server"

### Requirement: Library full

When the server refuses a ride or a roadbook because the library is full (413 `library_full`), the app SHALL say it positively and plainly, in the rider's language, with the figures read from the server: "Your free server library is full (3.2 of 20 MB). Your rides are still on this phone; delete older ones from the server to make room." It SHALL offer a direct path to My rides, where the rides marked as on the server can be removed from it. The limit SHALL be read from the server, never written in the app, since it may be raised. Nothing SHALL be deleted by itself, the file refused SHALL stay on the phone, and the ride or roadbook SHALL be offered again afterwards.

#### Scenario: Ride refused

- **WHEN** the rider sends a ride and the server answers 413 `library_full`, with 20 of 20 MB used
- **THEN** the ride stays "Only on this phone", and the screen says "Your free server library is full (20 of 20 MB). Your rides are still on this phone; delete older ones from the server to make room." with a button to My rides
