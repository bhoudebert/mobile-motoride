# Store readiness for the hosted-server offer

What the app itself must have before the first submission that sells a server (spec `hosted-server`, ADRs 0047 and 0048),
and what only the account holder can do. The general procedure is [`SHIPPING.md`](SHIPPING.md). Every statement about what
the app collects or sends comes from the code on the date below; a line marked UNVERIFIED is a rule of a store that no
primary source confirmed (see ADR 0048). Check the store rules again before each submission.

Status date: 2026-11-01. There is no store listing yet.

## 1. In the app (the repository's part)

| Requirement                                                                                 | Where                            | State                                                                                  |
| ------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| Buy with the store's own purchase, no other payment (Apple 3.1.1, Google Payments policy)   | ADR 0048, spike first            | Not built                                                                              |
| Subscription disclosure: what the rider gets, price, period, auto-renew, how to cancel      | Plan sheet, spec `hosted-server` | Specified; the Free plan screen exists, the paid one is not built                      |
| Links to Terms and Privacy policy in the app, and in the store metadata                     | Plan sheet                       | URLs needed from the account holder (section 3)                                        |
| Restore purchases, visible                                                                  | Server screen                    | Specified, not built                                                                   |
| Manage subscription, opens the store's settings                                             | Server screen                    | Specified, not built                                                                   |
| Delete my server and data, in the app, with a clear warning (Apple 5.1.1(v), Google policy) | Server screen                    | Specified, not built; whether a token-only identity counts is UNVERIFIED, built anyway |
| A web page to request deletion, naming the app or the developer (Google)                    | Privacy policy site              | Needed from the account holder                                                         |
| The backend live and reachable during review, a demo path (Apple 2.1)                       | Sidecar + agentRide              | Account holder; a reviewer note must say how to get the free server                    |
| Premium not purchasable while the backend refuses it                                        | Plan sheet                       | Done (shown as coming later)                                                           |

## 2. What the app collects and sends

This is the list to answer the Apple App Privacy labels and the Google Data safety form from. It is the app as built, not
the offer: the hosted server adds the last two rows.

**Kept on the phone only:** recorded rides (GPX), the roadbook library, the settings, fuel stops chosen, crash-alert
settings, the server setting and, with the hosted offer, a random account token and a setup journal (secure store).

**Sent to third parties, by the phone, with no account:**

| To                                                                  | What                                                                                                                                             | When                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| `valhalla1.openstreetmap.de` (FOSSGIS, public)                      | Positions and routes: the start and target of a way back or a skip; a trail of recent positions for the speed limit; the line of an imported GPX | Off route, skipping, importing a GPX |
| `overpass-api.de`, `overpass.openstreetmap.fr`, `z.overpass-api.de` | Points along a route, to find cameras and fuel stations                                                                                          | Importing a GPX, fuel stops          |
| `nominatim.openstreetmap.org`                                       | The text searched and, to bias results, the area                                                                                                 | Searching a place                    |
| `api.met.no` (MET Norway)                                           | The rider's position, rounded by the app, for the weather                                                                                        | Weather chip                         |
| `tiles.openfreemap.org`                                             | Map tile requests (so, the area viewed)                                                                                                          | Showing the basemap                  |

**Sent to the rider's own server, when there is one:** the roadbook list, rides uploaded, live-share positions (encrypted
on the phone, the server cannot read them), the traffic request for a route.

**Sent to the sidecar, for the hosted offer only:** the random account token; for a purchase, the store's signed proof
(never a card number: the store handles payment); nothing else. No email, name or phone number is asked.

**Device permissions in the build:** location when in use and always (to keep guiding with the screen off; an Android
foreground service); `RECEIVE_BOOT_COMPLETED`; iOS background mode `audio` (voice guidance); the motion sensors for the
lean and G gauges (no permission prompt on Android; the iOS usage text is UNVERIFIED, check before submitting). No
camera, microphone, contacts or photos.

**Tracking / advertising:** none in the code. No analytics SDK, no advertising id.

## 3. What only the account holder can do

Apple (App Store Connect): Apple Developer Program membership; the Paid Apps Agreement with tax and bank details
(UNVERIFIED as a gate in the pages read, but the subscription flow needs it); the app record for bundle id
`com.adequatefunction.motoride`; a subscription group and the paid plan's product (id, duration, price, localized name and
description, review screenshot and notes); an App Store Connect API key (.p8, key id, issuer id) and the Server Notifications
V2 URLs (sandbox and production) for the sidecar; sandbox testers; the privacy policy URL and the Terms of Use (EULA) URL in the
metadata; the App Privacy labels (section 2); review notes with a demo path and the backend live; export compliance (already
`ITSAppUsesNonExemptEncryption: false` in the build).

Google (Play Console): developer account and a payments (merchant) profile with tax details; the app with the same package
name; the subscription product and base plan, activated; a service account with Play Developer API access and the Pub/Sub
topic for real-time notifications for the sidecar; licence testers and the internal test track; the Data safety form (section 2),
including the data deletion answers and the web deletion URL; the privacy policy link; confirmation that Play Billing 8 or later
is used (the deadlines in Google's own pages disagree; treat 8 as the minimum).

Both: the legal texts (Terms, Privacy policy) written or approved by the owner; the seller is Adequate Function; the final plan
names and the price of the paid plan; the decision of which store goes first (iOS is the riding target).

## 4. Test accounts and the review path

Apple wants the backend running during review and a way to see the paid feature: give the reviewer sandbox purchase
instructions in the notes, and the free server needs no purchase. Google: license testers buy for free; a test subscription
renews every few minutes and unacknowledged test purchases are refunded after 3 minutes (the sidecar acknowledges), so test
the whole path on the internal track before any submission.
