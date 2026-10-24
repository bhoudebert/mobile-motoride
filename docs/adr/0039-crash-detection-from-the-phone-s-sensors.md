# 0039. Crash detection from the phone's sensors

- Status: accepted
- Date: 2026-10-22

## Context

A rider who falls alone on a quiet road may not be found for hours. The phone is on the bike and already reads its accelerometer for the gauges (ADR 0031)
and the GPS speed for the ride. The question is what to detect, and what to do next without lying about what the app can do.

## Decision

- **Detect** with a pure state machine (`src/core/crash.ts`): a shock (4 g at speed, 2.5 g for a slow bike that was moving), then ten seconds without moving
  that start within eight seconds, with the phone no longer upright (45° or 60°, or the bike having been at 54 km/h or more). "Upright" is learned from the ride: the
  direction of gravity in the phone's frame while it goes along at 5 m/s or more, so it needs no calibration and works at any mount angle. The thresholds are
  constants in the code and in the spec, tested on synthetic scenarios: a crash, a pothole, hard braking, a corner, a tip-over, a parked bike, no GPS speed.
- **Ask first.** A 30 s alert over the whole screen with vibration, the voice and one very large button. A false alarm is cheap and a cancelled alert sends nothing.
- **Tell who can be told, honestly.** Silently sending an SMS or placing a call from the app needs permissions Google Play restricts to default messaging and dialer apps
  (`SEND_SMS`, `CALL_PHONE`); MotoRide is neither. So the only automatic thing is the live share (ADR 0029): the sharer sends the position with the state
  `alert`, every 30 s, until the rider says they are fine, and the follower page shows it **to someone who has it open**. That is a mark, not a notification:
  nobody is called, texted or pushed. Without a live share the alert offers a message prepared for the
  emergency contact and a call to 112, which a person with the phone (the rider, or someone who finds them) sends or places with one tap. The screen says which of the two happened.
- **A setting and a test.** Detection is on by default and can be turned off; the contact is a name and a number kept on the phone; "Try the alert" runs it for ten seconds and sends nothing.
- Only a ride on the phone's GPS is watched; the accelerometer is not read otherwise.

## Consequences

- It is a heuristic: it will miss some crashes (a slow low-side fall onto a soft verge, a phone thrown off its mount) and raise some false alerts (a dropped phone). The wording and the
  cancel button are made for that, and the settings page and the spec say it.
- The accelerometer is read at 20 Hz during a ride (as the gauges do), a small cost in battery.
- The follower page (agentRide) must show the state `alert`; a phone that sends it to an older page shows "Riding" (the follower sees the position, not the alert), so the page and the app
  are changed together.
- Automatic SMS would need a different distribution (a default messaging app) or a server that sends it: a later decision, with the contact kept on the server.

## What would notify someone (not built, decided later)

Dedicated services do it from their servers: a text or email to the contacts after a countdown, or a call centre that phones the rider and then
the emergency services. Options for MotoRide, none chosen yet:

- **A follower mode in the app on Android**: a foreground service polls the shared link every 10 to 20 s and shows local notifications for pause, end, "no news for
  10 minutes" (a watchdog on the follower's side) and a possible crash. No push service, no key to hold, free; iOS suspends background apps, so it cannot do this there.
- **Push (FCM, and APNs for iOS)** through a small gateway the publisher runs, because push credentials belong to the app and cannot be given to every self-hosted server.
  Free per message, one more service to keep up, needed for iOS background alerts.
- **A server that texts or emails the contact** (an SMS provider costs money per message; email and a push app are free); the server would hold the contact.
- **Staffed escalation to the emergency services** needs a partner (an insurer, a call centre) and is out of reach.

## Alternatives considered

- **SEND_SMS / CALL_PHONE.** The obvious way, and a Play policy declaration the app would not pass; sending SMS silently is also something a rider may not want.
- **Raising the alert on any shock.** Potholes and cobbles would raise it daily and riders would turn it off.
- **A machine-learned model.** No data of real crashes to train on or to test, and an opaque rule is worse for a safety feature than eight numbers anyone can read.
