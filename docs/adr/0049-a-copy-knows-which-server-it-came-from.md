# 0049. A copy kept from a server knows which library it came from

- Status: proposed
- Date: 2026-11-01

## Context

A roadbook or ride kept on the phone from the rider's server is matched to the server's list by the number it was fetched under
(spec roadbook-library, ADR 0028). That is right for one server. When the rider removes the server or sets another, the number
means another roadbook: the copy shows as "On your server" for a library it did not come from, and a download of the new
server's number 7 can overwrite a local copy that came from the old server's number 7. The hosted server makes switching
ordinary: a rider can delete a free server and get a new one, or move to their own.

## Decision

- Each copy from a server stores the **identity of that library**: a hash of the server's address and an opaque rider reference
  returned by `GET /me` (the address alone while `/me` gives none), never the token and never an internal tenant id. The same
  rider on a second phone, with another token, has the same identity.
- A copy is matched to a server entry by number only when identities are equal.
- On Remove, or when another server with another identity is set, copies from the old one become **local-only**: file kept,
  number, stamp, server link, "sent" mark dropped. Rides the same way ("Only on this phone"). Nothing is deleted or overwritten.
  Copies kept before identities existed take the identity of the server in use the first time the list is asked of it.
- Moving to the new server is the rider's choice: "Send to your server" uses the server's push (the app has no client for it yet, and builds one; the server numbers the
  roadbook and keys on origin and name, so sending twice replaces) after showing the count and the room left, and stops on
  `library_full` (413).
- The Server screen says who provides the server, the plan, the library figure and what it measures, and, for a server the app
  made, a support code from the sidecar's account status; never a token or tenant id.

## Consequences

Switching server can no longer lose or overwrite a rider's copy, and the lists stay honest about where each roadbook is. A
rider who switches back to a server of the same identity does not get the old links back (the copies stay local until downloaded
again): that is the safe choice, since the library may have changed. The server must give `GET /me` a stable opaque rider reference
and the sidecar a support code in `/v1/account/status`: both are requests to those projects. The identity is only as stable as
the address: a server that moves address makes its roadbooks local copies, which a download from the new address repairs by name.

## Alternatives considered

Keeping the copies linked and asking the rider to confirm a switch: a prompt a rider on a bike cannot answer, and it still
mismatches numbers across servers. Deleting the copies of the old server on a switch: loses roadbooks the rider may not have
elsewhere. Matching by origin and name across servers: names repeat, and a stamp then compares unrelated files.
