# 0045. Landscape on the ride screen only

- Status: accepted
- Date: 2026-10-31

## Context

The app was locked to portrait. A phone on a handlebar mount is often held sideways, and on a wide screen the portrait
layout (bar on top, buttons and panel stacked below) leaves a thin strip of map. Every other screen (lists, import,
server, review) was designed for a tall screen and has no landscape layout.

## Decision

The phone may turn on the ride screen only. The app sets `orientation: "default"` (iOS reads its supported orientations
from it) and locks portrait in code as soon as it starts; the ride screen unlocks all orientations while it is open and
locks portrait again when it closes, with `expo-screen-orientation`. In landscape the ride screen splits in two: the panel
(speed, limit, distance, buttons) is a column on the left, the map with its bar, warnings and buttons fills the rest. Sheets
(cards) keep covering the screen and scroll. A phone with no such native module (an older build) stays portrait: the lock
calls are guarded.

## Consequences

Needs a native rebuild (new module, new manifest and Info.plist values), so it reaches riders with a release build, not with
a JavaScript update. The other screens never see landscape, so they need no second layout; opening a list from the ride
turns the phone back. A rider who holds the phone sideways in a list sees it turn when the ride closes.

## Alternatives considered

Landscape everywhere: every list and card would need a layout, for screens used standing still. Rejected for now.
Orientation by the phone's sensor only, without a lock in code: the lists would rotate and look broken.
