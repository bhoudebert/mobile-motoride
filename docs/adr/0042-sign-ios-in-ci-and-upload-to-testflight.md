# 0042. Sign iOS in CI and upload it to TestFlight

- Status: accepted
- Date: 2026-10-30

## Context

ADR 0041 built iOS unsigned, for want of a paid Apple account. The account now exists, the bike works only with an iPhone, and the
repository is public, so GitHub macOS runners cost nothing. EAS Build would add an Expo account, a build quota and a second place
holding the signing material, for something `xcodebuild` does on the runner we already use.

## Decision

- `.github/workflows/ios.yml` archives the app unsigned with `xcodebuild` and signs it on export, automatically,
  through an App Store Connect API key (`-allowProvisioningUpdates` with the key). Archiving signed would ask for a development
  profile and so for a registered device; a distribution build needs none. Apple creates and keeps the distribution certificate and the profile, so no
  certificate file is stored in the repository's secrets.
- The signed IPA goes to TestFlight with `xcrun altool --upload-app` and the same key. The Release workflow runs it with the new
  tag; by hand it runs with an option to skip the upload.
- Four secrets drive it: `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`. Without them the workflow builds the unsigned
  IPA of ADR 0041 and uploads nothing, as the Android workflow skips without its key (ADR 0030).
- `ios.infoPlist.ITSAppUsesNonExemptEncryption` is `false`: the only encryption is the standard AES-256-GCM of live sharing.
- EAS is not used.

## Consequences

- A release reaches TestFlight with no manual step; testers install over the air and a build lasts 90 days.
- App Store Connect refuses a build number it has already seen (`CFBundleVersion` is the `versionCode`, ADR 0041): a second
  manual run of the same version fails at the upload. Bump the version, or run it with the upload off.
- The API key needs the Admin or App Manager role to create certificates; a leak of its secret is a leak of that access.
- A signed release no longer attaches an IPA to the GitHub release: a store build cannot be sideloaded.
- Still unproven: that the app runs on an iPhone (ADR 0041).

## Alternatives considered

EAS Build and Submit: more moving parts, a quota, no gain on a public repository. Fastlane `match`: certificates in a private
repository, more to maintain than an API key. A certificate and profile stored as secrets: they expire and need renewing by hand.
