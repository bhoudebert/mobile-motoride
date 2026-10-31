# Roadbook Library Specification

## Purpose

Let the rider bring roadbooks into the app themselves, from a GPX file of any route app or a roadbook file of agentRide, and keep them on the phone, with no server (ADR 0025).

## Requirements

### Requirement: Import a file

The app SHALL import a roadbook from a file in two formats, told apart by what the file holds and not by its name: a `motoride-roadbook` file (spec roadbook-import) and a GPX document. The rider SHALL be able to bring a file in by choosing it from the phone ("Import a roadbook" in the menu and on the roadbook list), by sharing it to the app or opening it with the app from another app, and by a link `mobilemotoride://import?url=<address>` that makes the app download the file at that address. A file that is neither, that cannot be read or downloaded, or that holds no line of two points SHALL be refused with a message that says why and leaves everything as it was. An address that is not http or https SHALL be refused.

#### Scenario: A GPX shared from another app

- **WHEN** the rider shares a GPX file of 800 points and 3 waypoints to the app
- **THEN** the ride opens on a roadbook of that line with those stops

#### Scenario: Not a roadbook

- **WHEN** the rider picks a photo or a text file
- **THEN** the app says it is not a roadbook or a GPX file and stays where it was

### Requirement: Keep what was imported

An imported roadbook SHALL be kept on the phone, as the same roadbook the app reads, until the rider deletes it, and SHALL survive restarts and updates of the app. Importing the same route again (same line and name) SHALL replace the earlier copy, not add a second. The roadbook list SHALL show the imported roadbooks first, marked as imported, then the bundled ones, and SHALL offer to delete an imported one after asking; a bundled roadbook cannot be deleted. Opening an imported roadbook SHALL put it in the recent rides like any other. A file kept on the phone that can no longer be read SHALL be left out of the list, not crash it.

#### Scenario: Same file twice

- **WHEN** the rider imports the same GPX twice
- **THEN** the list has it once

#### Scenario: Delete

- **WHEN** the rider deletes an imported roadbook and confirms
- **THEN** it is gone from the list and from the phone

### Requirement: A refreshed roadbook replaces its old copy

A roadbook file that carries an `origin` with an app, a roadbook number and a name SHALL replace the kept roadbook with the same app, number AND name, in place, keeping its local id so the rides recorded on it stay linked. The same number under another name is another library's roadbook and SHALL be kept as a new one. A file with no origin, and a GPX, SHALL behave as before (the same name and line replace). When both files carry `generatedAt` and the incoming one is older than the kept one, the app SHALL NOT replace it: the newer copy stays, opens, and a message says the older file was not imported. The same time, or no time, replaces.

#### Scenario: The route changed

- **WHEN** the rider imports a file of origin agentRide, number 7, name "Loop", then a refreshed file of the same origin with another route
- **THEN** the list has one "Loop", with the new route and the id of the first

#### Scenario: Same number, other name

- **WHEN** a kept roadbook is agentRide 7 "Loop" and the rider imports agentRide 7 "Coast"
- **THEN** the list has both

#### Scenario: An older file

- **WHEN** the kept copy was generated on 20 October and the rider imports the same roadbook generated on 10 October
- **THEN** the kept copy is unchanged, it opens, and a message says a newer version is already kept

### Requirement: Roadbooks on the rider's server

When the rider has a server (spec server-features), the roadbook list SHALL ask it, with the rider's token, for the roadbooks it holds (`GET /roadbooks`) and show them in the same list as the others, each roadbook once. A server roadbook the phone does not keep SHALL be a card of its own, marked "On your server", with its name, distance and riding time and a download icon. A kept roadbook that came from the server SHALL be marked "From your server" and carry, in a column at the right of the card with the delete icon, its state against the server: a check when its stamp is the server's (up to date), a refresh icon when the stamps differ or it has none ("Newer version on your server"). A roadbook imported from a file SHALL be marked "Imported from a file". Every kept roadbook, from the server or from a file, SHALL offer a delete icon that asks before deleting; deleting a roadbook that came from the server brings its download back.

A server roadbook is matched to a kept copy by the number it was fetched under, else by origin (agentRide, same number AND same name) for a copy that was not fetched from a number, else, when the server has renumbered a roadbook (its old number is no longer listed, as when a pushed roadbook is taken into the rider's library), by name with an agentRide copy whose number is gone: it is that roadbook under its new number, shown as one card with its refresh, and the download replaces the copy in place and keeps the new number. A roadbook the server lists under any number, however it got there, is an ordinary roadbook with an ordinary state: the app has no rule for a range of numbers. The icon SHALL fetch the file (`GET /roadbook/<id>`, with a spinner in place of the icon) and keep the stamp the server answered with (its `ETag`) beside the roadbook, importing it by the rules of "A refreshed roadbook replaces its old copy", so a refresh keeps the local id. The file's `generatedAt` SHALL NOT be compared with the server's stamp. Nothing about the server SHALL be shown when the rider has no server, and the app SHALL NOT ask a server that does not answer `/roadbooks` (404) again during that visit.

Each server roadbook carries a **state** (`current`, `outdated`, `refreshing`, `failed`, with an optional `error`; a server that says none is read as `current`), and its `stamp` is the version of the file ready to download now. The card SHALL show it: with the ready file held (the held stamp is the listed one), `current` is the check; `outdated` ("Map out of date. Tap to update.") is an icon that asks the server for a new file (`POST /roadbook/<id>/refresh`: 202 when it starts, 200 when it is already current, 404 when it is not the rider's) and, at once, shows the roadbook as under refresh; `failed` says "Update failed: <reason>. Tap to try again." with the same tap, the reason being the server's `errorCode` (`map_down`, `rate_limited`, `timeout`) said in the rider's language, else the server's `error` sentence. A roadbook `refreshing`, whatever the stamp, SHALL show "Under refresh on your server…" with a spinner and nothing to press, and while any is, the open list SHALL be asked again every 4 seconds without showing it is being asked; a poll that is not answered SHALL leave the list as it was. When a roadbook the rider asked to update is `current`, and its stamp is not the one held, the app SHALL download it by itself (`GET /roadbook/<id>`, keeping the `ETag` it answers with as the held stamp), SHALL stay on the list, and SHALL say "<name> is updated from your server."; a refresh that ends on the stamp held SHALL download nothing. A stamp that is not the one held, in any state but `refreshing`, SHALL offer the download of the ready file (it works even when outdated). After a download the held stamp is the listed one, so the update SHALL NOT be offered again the next time the list opens. A roadbook not on the phone keeps its download whatever its state, and says "Map out of date on your server" when it is outdated. A problem asking for the refresh (401, 404, 429, unreachable) SHALL be said in words and change nothing.

A download SHALL wait 15 seconds, not longer: a file that is ready comes in well under a second, while the first file of a roadbook is made on the first request (its limits are traced along the whole route, minutes for a long one) and the server's gateway gives up at about a minute. When a download times out, or the server's gateway answers 504 or 408, the app SHALL NOT report a failure: it keeps nothing, says "Your server is preparing <name>. It will come down by itself when it is ready.", asks the server to prepare the file (`POST /roadbook/<id>/refresh`, which is already running if the first request started it), shows the card under refresh with nothing to press, and downloads the roadbook by itself, staying on the list, when the server lists it `current`; a roadbook not on the phone SHALL be downloaded this way too, and then says "<name> is downloaded from your server.".

The list SHALL work offline: when the server cannot be reached the kept roadbooks SHALL be shown as usual, without state marks, with a short note that the server could not be reached and a way to try again. A refused token (401), too many requests (429), a roadbook that no longer exists (404) and a route the server could not make (502) SHALL each say so in words; nothing SHALL be thrown, and no kept roadbook SHALL change.

#### Scenario: A roadbook not yet on the phone

- **WHEN** the server lists agentRide roadbook 7 "Loop" and no kept roadbook matches it
- **THEN** the list has one card "Loop" marked "On your server" with a download icon, and pressing it keeps the roadbook with the server's stamp and opens its ride

#### Scenario: Once kept, the same card

- **WHEN** the rider has downloaded it
- **THEN** the list has one card "Loop", marked "From your server", with a check and a delete icon, and no second card for the server's entry

#### Scenario: The server has a newer version

- **WHEN** a kept roadbook has origin agentRide 7 "Loop" and stamp "aaa", and the server lists it with stamp "bbb"
- **THEN** its card shows a refresh icon, and pressing it replaces the kept copy in place, keeping its local id, and stores stamp "bbb"

#### Scenario: Out of date, asked, ready

- **WHEN** a kept roadbook is `outdated` on the server, the rider taps its update icon, the server answers 202, lists it `refreshing`, then `current` with a new stamp
- **THEN** the card shows "Map out of date", then "Under refresh on your server…" with a spinner, then the new file comes down by itself, the list stays, and the card is a check

#### Scenario: The server renumbers a roadbook

- **WHEN** a kept roadbook was fetched under number 1000000 and the server now lists the same name under number 3 and no longer lists 1000000
- **THEN** the list has one card for it, with a refresh icon, and pressing it replaces the kept copy in place and stores number 3 and the new stamp

#### Scenario: A file the server has not made yet

- **WHEN** the rider downloads a roadbook whose file the server has not made, and the server's gateway answers 504 after a minute (or 15 seconds pass)
- **THEN** no failure is shown: the card goes under refresh, a word says the server is preparing it, and the roadbook comes down by itself when the server lists it current

#### Scenario: Not offered again

- **WHEN** the roadbook has just been updated and the rider opens the list again
- **THEN** the card is a check, with no update icon

#### Scenario: A refresh that fails

- **WHEN** the server lists the roadbook as `failed` with the error "no route found"
- **THEN** the card says "Update failed: no route found. Tap to try again." and the tap asks again

#### Scenario: Deleting

- **WHEN** the rider deletes a roadbook from the server and confirms
- **THEN** it is gone from the phone and its server card, with a download icon, is back

#### Scenario: Server unreachable

- **WHEN** the phone has no network
- **THEN** the list shows the kept roadbooks, a note says the server could not be reached, and "Try again" asks again

### Requirement: Complete an imported GPX

A roadbook that comes in with no speed limits and no countries (a GPX) SHALL be completed once, at import, with what public services know of its roads (ADR 0026): the speed limit of each stretch (the posted one, else the legal default of the country, capped on minor roads and 50 at most in a built-up area), the country of each stretch, the roundabouts with their exits, and the fixed speed cameras along it. The line SHALL be sent thinned to about one point in thirty metres, in pieces for a long route, and matched to the roads; what comes back SHALL be laid on the imported line. While it runs the screen SHALL show that it is working with a percentage. The result SHALL be kept with the roadbook and ridden like an agentRide roadbook, with the camera policy of the country (spec danger-zones). A roadbook file that already has limits or countries SHALL NOT be sent.

#### Scenario: A GPX of a loop through France and Belgium

- **WHEN** the rider imports a GPX of such a loop with the network on
- **THEN** after a few seconds the ride opens with a speed limit along the whole line, its countries and its roundabouts

### Requirement: When the services cannot complete it

When the roads cannot be matched, or the services cannot be reached, the roadbook SHALL still be imported and kept, as it was, with a message that says why and that it can be tried again; the list SHALL offer "Add speed limits and cameras" on it until it succeeds. When only the cameras cannot be had (the services shed load; the app tries a mirror and waits before giving up) the limits, countries and roundabouts SHALL be kept, the message SHALL say the cameras are missing, and the offer SHALL stay. An imported GPX that has not been completed SHALL be ridden with the guidance computed from its geometry (turns and corner warnings), the speed limit unknown and no camera warning (spec danger-zones).

#### Scenario: No network

- **WHEN** the rider imports a GPX with no network
- **THEN** it is kept, its ride opens, a message says it was imported without speed limits, and the list offers to add them

### Requirement: Each tile shows its route

Each roadbook of the list SHALL have the shape of its route drawn faintly behind its name and figures (north up, in proportion, a few dozen points of the line), not a plain background. The drawing SHALL not be read by a screen reader and SHALL NOT make the text harder to read.

#### Scenario: The shape behind the tile

- **WHEN** the list of roadbooks is shown
- **THEN** each tile carries the drawn shape of its own line
