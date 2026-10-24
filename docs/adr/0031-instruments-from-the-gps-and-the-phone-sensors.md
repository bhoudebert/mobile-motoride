# 0031. Instruments from the GPS and the phone's sensors

- Status: accepted
- Date: 2026-10-21

## Context

Riders like a few readings next to the map: compass, altitude, climb, slope, and for the fun of it lean angle and G.
The app has the GPS fix and the phone has an accelerometer and a gyroscope. The phone is fixed to the bike, in an unknown
orientation, and a motorcycle leans: in a steady corner the accelerometer measures gravity along the bike's own axis, so
it cannot tell the lean by itself.

## Decision

- A pure core module (`src/core/instruments.ts`, no sensor import) turns samples into readings: compass points, altitude
  smoothing with a 3 m hysteresis for the climb, slope over the last 150 m, and the lean and G maths below. The hook
  `useInstruments` feeds it from `expo-sensors` (accelerometer and gyroscope at about 20 Hz) and from the GPS fix, and
  gives the screen a reading about four times a second.
- **Lean** is `asin(v · w / g)`, with `v` the GPS speed, `w` the turning rate about the bike's upright axis (the gyroscope
  projected on the calibrated upright axis), and `g` 9.81. It does not use the accelerometer in the corner, where it
  is useless, and it needs no knowledge of the mount except the upright axis. **Lateral G** is the tangent of the lean.
  **Braking G** is the accelerometer along the calibrated forward axis, which is exact while the bike is upright; the slope of the road (from the altitude) is taken off, since gravity
  leaks into the forward axis by its sine. The nose dive under braking is not compensated.
- **Calibration** is one tap with the bike upright: the phone's gravity vector gives the upright axis; the forward axis is the
  phone's back direction projected on the level (the phone faces the rider), or its top edge when it lies flat.
- Each reading has a switch, kept in AsyncStorage like the voice mode (ADR 0019). A switched-off reading costs nothing: its
  sensors are not listened to.
- Readings never feed a warning or the voice.
- Android only for now: the sign conventions of the iOS sensors are not verified.

## Consequences

Lean and G are indicative: the phone's mount, vibration and the GPS speed (updated once a second) limit them. The rider
calibrates once per mount. A native module is added (`expo-sensors`), so a development build must be rebuilt and the
device smoke run. The readings are stored with the recorded ride (spec ride-recording): per point in the GPX, and the climb and the
peak leans in its metadata, which is also what the lean can be tuned from after a first real ride.

## Alternatives considered

The sensor-fusion `DeviceMotion` roll: it fuses the accelerometer, so it reads close to zero in a steady corner. The lean
from the corner's radius on the roadbook: needs no sensor, but it is the corner's, not the rider's. A Bluetooth IMU on the
bike: accurate and out of scope.
