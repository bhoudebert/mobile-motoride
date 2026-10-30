# 0043. Build the iOS development client in CI and run Metro on the developer's machine

- Status: accepted
- Date: 2026-10-30

## Context

The project is developed on Linux, which cannot build iOS. With only the TestFlight build (ADR 0042) every iPhone test costs a pull
request, a release build and 30 to 40 minutes. The first ride on an iPhone found six problems at once; most are JavaScript. The app
already uses `expo-dev-client` (Android uses it daily): a Debug build that loads its JavaScript from Metro.

## Decision

- `.github/workflows/ios-dev.yml` (run by hand) builds the Debug configuration on a macOS runner and signs it with a development
  profile, through the same App Store Connect API key and Team ID as ADR 0042. The result is `motoride-dev.ipa`, kept 14 days.
- Apple signs a development build only for registered devices, so each iPhone's UDID is registered once in the Developer account.
- The IPA is installed over USB from Linux (`ideviceinstaller`, libimobiledevice) and `npm start` serves the JavaScript over the
  local network; `idevicesyslog` gives the phone's log.
- The client is rebuilt only when native code or a native dependency changes.

## Consequences

- A JavaScript change shows on the iPhone in seconds; a native change costs one macOS build (about 25 minutes).
- The development client is never distributed: it is signed for named devices and is not attached to a release.
- The registered devices count against the account's 100 per type per year.

## Alternatives considered

A Mac of our own: faster, but there is none. TestFlight for every test: the loop of ADR 0042, too slow for fixing UI. EAS dev
builds: ADR 0042 already left EAS out.
