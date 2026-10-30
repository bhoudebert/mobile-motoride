# 0041. Build iOS unsigned in CI, sign it on the way to the phone

- Status: superseded by 0042
- Date: 2026-10-24

## Context

The project is developed on Linux, which cannot build iOS, and the first iOS goal is to ride with the app on an iPhone several times
a week, not to publish it. The paid Apple Developer Program (US$99 a year) is needed for TestFlight, over-the-air installs and
the App Store, not for building. GitHub macOS runners are free on a public repository. Expo's EAS Build has a free tier of 15
builds a month and, for a device build, still needs the paid account.

## Decision

- `.github/workflows/ios.yml` runs `expo prebuild --platform ios` and `xcodebuild` (Release, `CODE_SIGNING_ALLOWED=NO`) on
  `macos-latest` and packs `motoride-X.Y.Z.ipa` from the `.app`. It runs by hand and, with the new tag, from the Release
  workflow, which attaches the IPA to the GitHub release as it does the Android files (ADR 0030).
- The IPA is unsigned. Signing happens when it is installed: with a free Apple ID (Sideloadly, AltStore; 7 days) or, once an account is
  paid for, in CI before TestFlight. Adding that later changes the workflow, not the app.
- `app.config.ts` gives iOS `CFBundleVersion` the same growing number as Android's `versionCode`.
- The iOS project is generated (`/ios` is ignored), like `android/` (ADR 0002).

## Consequences

- Every release has an installable iOS file at no cost, and a build needs no Mac.
- A free-account install expires after 7 days: fine for trying the app, not for relying on it on a trip.
- Nothing proves the app runs on an iPhone yet: background location and the audio session are set in `Info.plist` and untested.
  The music-ducking module is Android only (ADR 0038), so on iOS the voice does not lower other audio yet.
- A macOS build is slow (about 15 minutes); on a private repository its minutes cost ten times a Linux minute.

## Alternatives considered

EAS Build: no Mac needed either, but a free tier of 15 builds and the paid account for devices. A Mac of our own: faster loop,
but there is none. Signing in CI with a paid account: the right end state, not needed to start.
