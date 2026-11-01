# Spike: buying the paid plan with expo-iap

The gate of ADR 0048: nothing of the paid plan's screens is built until this passes on real builds. It is a day of work
that tells whether `expo-iap` fits Expo SDK 58 and React Native 0.88, or whether the fallbacks are needed. A throwaway branch,
never merged as is.

## What the spike needs from the account holder

An Apple subscription product and a Google subscription product (ids of your choice, for example `motoride.plus.year`), in
a test state; an Apple sandbox tester and a Google licence tester; a TestFlight build and a Play internal-test track.
Without them the spike can only prove the library builds and loads (steps 1 and 2).

## Steps and what each must show

1. **Builds.** Add `expo-iap` and its config plugin (options UNVERIFIED: read the library's setup page first), run the
   existing CI build for Android and iOS. Pass: both build and the app starts with the library loaded; the dev client works
   (no EAS).
2. **Products.** Read the two products and show their localized price and period on a throwaway screen. Pass: the store
   price is what the screen shows, in the store's language.
3. **Purchase with the account token.** Buy with `appAccountToken` (iOS, a UUID) and the obfuscated account id (Android, same
   UUID). Pass: the signed transaction (iOS) carries the token; on Android the purchase carries the obfuscated id. If the
   library does not expose the Android field, that fails the spike (ADR 0048 fallbacks).
4. **Unfinished purchases survive a kill.** Buy, kill the app before finishing the transaction, relaunch. Pass: the
   purchase is listed again as unfinished and can be finished; nothing is charged twice.
5. **Restore.** On a second device, or after a reinstall with the same store account, list the active subscriptions. Pass: the
   same transaction and token are found.
6. **Pending.** On Android, a slow payment (test card "slow") reports pending, then confirmed. On iOS, "ask to buy" if
   testable.
7. **Finish tolerant.** Finishing or acknowledging a purchase the sidecar already acknowledged does not fail the app.
8. **Manage.** The call that opens the store's subscription settings works on both platforms.

## Outcome

Write the result in ADR 0048: accept `expo-iap`, or move to `react-native-iap` or an own module with the reason (which step
failed, with the error). The proof the sidecar receives is the signed transaction (Apple) or the package name and purchase
token (Google), as in its API.
