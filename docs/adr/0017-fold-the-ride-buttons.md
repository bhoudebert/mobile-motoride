# 0017. Fold the ride buttons while riding

- Status: accepted
- Date: 2026-10-18

## Context

The bottom panel carries the speed, the limit, the distance and next point, the skip button and a row of three buttons
(Back, Pause, End). On a phone mounted on a handlebar the panel covers a large share of the map, and the buttons are
the part a rider uses least while riding.

## Decision

While a ride or demo is on, the row of buttons and its disclaimer are folded away. A small grabber line at the top of the panel
(the usual sign of a sheet that can be pulled) takes no room: a swipe up on the panel, or a tap on the grabber, brings
the buttons back, and a swipe down or a tap folds them; they also fold after 8 seconds, when a card opens, and when the
ride ends. The first version used a full-width button as the strip; it only swapped one row of buttons for another. Before a ride nothing is folded, since Start is needed. The phone's Back button keeps asking
the leave question. The read-outs stay in view, as does Skip.

The row slides in and out (about 220 ms, ease-out, the panel growing with it) like the sheets of iOS Maps; it stays
mounted, and hidden from screen readers, until it has left.

## Consequences

The map gains the height of a button row. End and Pause take two taps instead of one, which is a deliberate guard against
a stray touch on a bumpy road. A rider may not guess the grabber exists; it is the convention of every sheet on a phone, and it also takes a tap. Tests and the phone smoke test must open the panel before pressing these buttons.

## Alternatives considered

Hiding the whole panel on a tap: loses the speed and the limit, which must be seen at all times. A swipe with no visible sign: invisible
to a first-time rider and to screen readers; the grabber gives both a handle. Keeping the buttons and making them smaller: still takes the room.
