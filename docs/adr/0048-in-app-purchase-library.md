# 0048. Buy the subscription with expo-iap, verify nothing in the app

- Status: proposed (a spike must pass first)
- Date: 2026-11-01

## Context

The app sells a hosted server as an auto-renewing subscription (ADR 0047, agentRide ADR 0057). Apple 3.1.1 and Google's Payments
policy make store billing mandatory for a digital service like this; 3.1.3 exceptions do not apply (the rider buys inside the app, a
service used in the app). The sidecar verifies purchases with the stores itself, so the app must only start the purchase with an
account token, hand the proof to the sidecar, and finish the purchase afterwards. Research as of 2026-11-01; "UNVERIFIED" marks
what no primary source confirmed.

The app is Expo SDK 58, React Native 0.88.1 with the new architecture, a development client, and native builds made in CI (no EAS).

## Decision

Use **expo-iap** (MIT, Expo module over the OpenIAP native cores: StoreKit 2 on iOS, Play Billing 8.x on Android; 6.4.1 on npm,
about 481k downloads a week). The app calls it for products, the purchase with the account token, pending and restore events, and
finishing a transaction; it holds no verification logic. The library sits behind one small port in `src/services/` so a replacement
touches one file.

**Gate: a spike before any screen is built.** On a CI-built dev client (Expo SDK 58, RN 0.88) it must: list a product, buy in TestFlight
sandbox and in Play internal testing as a licence tester, carry the account token (iOS `appAccountToken`, a UUID; Android
`obfuscatedAccountId`, whose exposure by the library is UNVERIFIED), survive a kill and relaunch with the purchase still unfinished
(ADR 0047's journal), and restore on a second device. If any fails, fall back in this order: react-native-iap 17.3.1 (same cores,
needs Nitro modules, new-architecture fit UNVERIFIED), then a thin own Expo module over StoreKit 2 and Play Billing 8.

The account token is a UUID v4 (Apple requires it); the same value is the Android obfuscated account id.

## Consequences

No vendor service sees purchases beyond the stores and our sidecar; the sidecar verifies with the App Store Server API and Server
Notifications V2 (Apple) and the Play Developer API subscriptions v2 and real-time notifications (Google), and acknowledges on
Google within the 3-day limit through the app's finish call or itself (the sidecar's choice). The app gains a native dependency
(config plugin options UNVERIFIED), a full native rebuild, and a single maintainer risk (same author for both OpenIAP libraries; the
old `hyochan/*` repositories were archived on 2026-08-04, development moved to `hyodotdev/openiap`; the npm names did not change).
Expo SDK 58 and RN 0.88 are not stated as supported by any option; the spike is how we find out. Google's table and banner disagree
on the Billing 7 and 8 deadlines: treat 8 as the minimum.

Store rules the screens obey (sources in the research notes of the pull request): Apple 3.1.2 (what the rider gets for the price, the
renewal price most prominent, duration, Terms and Privacy links in the app and in the metadata, a way to restore), 5.1.1(v) and Google's
account-deletion policy (an in-app deletion path and a web link; whether a token-only identity counts is UNVERIFIED, so we provide
both), Apple 2.1 (the sidecar and a reviewable server live during review), Google's subscription policy (how to manage or cancel,
shown plainly). Apple's exact auto-renew and 24-hour cancel wording is in the Developer Program License Agreement Schedule 2 and
must be copied from it by the account holder (UNVERIFIED here).

## Alternatives considered

**RevenueCat** (`react-native-purchases` 11.0.0): the easiest client, but its servers verify purchases and hold the entitlements, which
duplicates and conflicts with the sidecar, adds a third party that sees every purchase, and its `appAccountToken` handling is UNVERIFIED.
Free up to 2,500 USD of monthly revenue, then 1% (scope of the 1% UNVERIFIED). **react-native-iap**: the same cores, a heavier native
setup. **An own wrapper first**: most control, most upkeep; kept as the way out.
