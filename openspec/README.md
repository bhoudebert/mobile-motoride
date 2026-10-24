# Specifications

`specs/<capability>/spec.md` describes what the system does, as requirements
with scenarios. `changes/` holds proposals that add or modify requirements
before they are implemented; once merged into the code, the change is folded
into the specs and its folder moves to `changes/archive/` (dated).

| Capability        | Covers                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- |
| roadbook-import   | GPX turned into a roadbook, bundled roadbooks, the library list                           |
| ride-navigation   | Following a roadbook with GPS: progress, next stop, off route, the ride screen            |
| turn-instructions | "Straight 1.2 km", "Left in 150 m": turns found on the line, the top instruction, bearing |
| speed-limits      | The limit on the line from the roadbook file, always on screen, red when over             |
| danger-zones      | Cameras as generic danger zones, warned once, with an off switch and a release gate       |
| ride-control      | Pause and resume, end with a question, start a roadbook from any of its points            |
| live-corrections  | Skip the next point during the ride, with a new route, undo, and the safety rules         |
| corner-warnings   | Detecting dangerous corners on the line and warning the rider in time                     |
