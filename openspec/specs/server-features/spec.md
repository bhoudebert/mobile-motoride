# Server Features Specification

## Purpose

Say plainly what a server brings, switch nothing on that the server does not offer, and point to how to host one (ADR 0040; the server side is agentRide's specs `traffic` and `live-sharing`).

## Requirements

### Requirement: What the server brings

The Server screen SHALL tell, for the rider's server, what it offers, read from its public health answer: live sharing, and traffic with the countries it works in (`trafficCountries`, "On. Works in France for now; more countries on request."), or "Off on this server. Its host can turn it on: see the hosting guide.". While the answer is awaited it SHALL say it is checking; when the server cannot be reached it SHALL say so and claim nothing. A feature SHALL be shown on only when the server's answer says so.

#### Scenario: Traffic on, in France

- **WHEN** the server's health says `traffic: true` and `trafficCountries: ["FR"]`
- **THEN** the screen says "Traffic on your route. On. Works in France for now; more countries on request."

#### Scenario: Traffic off

- **WHEN** the server's health says `traffic: false`
- **THEN** the screen says traffic is off on this server and points to the hosting guide

### Requirement: What a server would add

With no server the Server screen SHALL say what one would add (a live ride shared by a link, slow traffic ahead on the route), that the app works fully without one, where to read how to host one (a button to the hosting guide), and that renting one is coming.

#### Scenario: No server

- **WHEN** the rider has no server and opens the Server screen
- **THEN** it says "What a server adds", "Without a server the app works fully", and offers "Host your own server", which opens the guide

### Requirement: Where traffic works, and its credit

The traffic card SHALL say in which countries the server's traffic works when the server says so, and SHALL credit the source: Bison Futé (transport.data.gouv.fr, Licence Ouverte 2.0) when the countries include France, "from your server" otherwise.

#### Scenario: French open data

- **WHEN** the server says its traffic covers France and the rider opens the traffic card
- **THEN** it says "Traffic works in France for now. More countries on request." and credits Bison Futé

### Requirement: What the Server screen says about the server

For the server set, the Server screen SHALL show its address (the token masked, as today), who provides it ("Free server from Adequate Function" when the app created it, "Your own server" otherwise), the plan when the app created it ("Free during launch"), what the library holds and its limit read from the server's `GET /me` ("Library 3.2 of 20 MB", or "Library 3.2 MB" with no limit), whether traffic is on, off or has requests left today, and when the server is paused, why and until when. When the app created the server it SHALL also show a short support code the sidecar returns for it (`supportCode`, optional until the sidecar sends it), to quote when asking for help; it SHALL NOT show the server's internal rider or tenant identifier or any token. What it cannot read it SHALL leave out, not guess.

The library figure SHALL be explained in words: it is the size of the rider's library file on the server, which holds the roadbooks, the rides sent, notes, ratings and caches, and it is checked when a ride is sent or a roadbook is pushed.

#### Scenario: A server made by the app

- **WHEN** the app created the server and `GET /me` says 3.2 MB used of 20
- **THEN** the screen shows the address, "Free server from Adequate Function", "Free during launch", "Library 3.2 of 20 MB", the support code, and the line saying what the library measures

#### Scenario: The rider's own server

- **WHEN** the server was set from an address and a token and `GET /me` has no hosted plan
- **THEN** the screen shows the address, "Your own server" and what `GET /me` allows, and no support code
