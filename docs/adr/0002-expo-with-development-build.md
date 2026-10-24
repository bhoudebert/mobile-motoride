# 0002. Expo with a development build

- Status: accepted
- Date: 2026-10-18

## Context

The app needs a native map, background GPS and speech. The author knows
TypeScript, and agentRide is TypeScript: shared types and tooling help.

## Decision

React Native with Expo (TypeScript) and a **development build**
(`expo-dev-client`, `expo prebuild`). Native folders are generated and
ignored. Expo Go is not used: it does not include MapLibre.

## Consequences

One codebase for Android now and iOS later; EAS Build or a local Gradle build
produces the app. Native modules (MapLibre, location) are available. Each
native dependency change needs a rebuild of the dev client.

## Alternatives considered

Flutter: good map support, but a second language and no sharing with
agentRide. Native Kotlin: best background-location control, Android only.
Expo Go: fast to start, cannot load MapLibre.
