# 0021. What may be said about a camera follows the country

- Status: accepted (replaces the "zones only" decision of ADR 0011)
- Date: 2026-10-19

## Context

ADR 0011 made every camera a "danger zone" and kept one switch for the whole build. A ride crosses borders and the
rules differ (`docs/danger-zones-by-country.md`): the place of a fixed camera may be given in Belgium, Luxembourg, the
Netherlands and Spain (Italy and the United Kingdom to be confirmed); France allows only a danger zone that does not
give the place away, with lengths the French protocol of 28 July 2011 sets by the kind of road; Germany and
Switzerland forbid the warning for the driver. One switch is either too timid or too bold, and a "danger zone" of 600 m
around a camera is not one in France.

## Decision

Three policies, `exact`, `zones` and `off`, by country in a table in `src/core/cameraPolicy.ts`; a country that is not
in it is `off`. The roadbook file says the country of each stretch (`countries`, written by agentRide from the
countries Valhalla reports); a roadbook that does not say it gets no camera warning. The policy that applies is the
stricter of the camera's country and the rider's own at that moment, and it covers everything that tells of a camera:
screen, voice, distance and map marker. Under `exact` a camera is warned 600 m ahead with its limit and drawn on the
map. Under `zones` the warning starts when the rider enters a zone of at least 300 m, 2 km or 4 km by the kind of road,
holds the camera at a share between a quarter and three quarters of its length drawn from its coordinates, and has no
countdown, no marker and no word camera. agentRide does not write cameras in Germany and Switzerland. The off switch
stays as the build's ceiling and cannot allow what a country forbids.

## Consequences

A rider is told what the law of where they are lets the app say, with no setting to get wrong. Old roadbooks, GPX files
and routes to a place have no countries and so no camera warning until agentRide writes the countries. The table is
the owner's to keep up to date, and Italy and the United Kingdom stay to be confirmed before a public build. This is
documented research, not legal advice: a lawyer should look at a public release.

## Alternatives considered

One switch for the build (ADR 0011): simple, wrong somewhere. A country lookup on the phone from boundary data: more
weight and a second source of truth next to the roadbook. Showing the user's own choice of policy: it would let a rider
enable what the country forbids.
