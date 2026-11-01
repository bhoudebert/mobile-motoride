# 0050. A backup email recovers the server on another phone

- Status: proposed
- Date: 2026-11-01

## Context

A rider's hosted server is tied to a random account token kept on one phone (ADR 0047). A new phone, a lost one or a
reinstall has no token, so the server, its library and a pending purchase cannot be reached again. The sidecar keeps only a
hash of the token and cannot give it back. An account with a password or a provider sign-in was set aside (ADR 0047): too heavy
and not what the rider asked for. A subscription adds the store as a second way back (restore purchases), which does not cover
a free server.

## Decision

- **An optional backup email**, asked for in the app once the server exists, never required. While there is none, the Server
  screen and the menu entry show a warning mark and one line: "No way back if you lose this phone. Add a backup email."
- **The app sends the address to the sidecar only** (not to agentRide, not to any third party). The sidecar mails a six-digit
  code (its SMTP settings live in its own environment, never in the app or this repository), the rider types it, and the address
  is confirmed. The sidecar stores the address (or the least it needs) against the rider and deletes it with the account.
- **Recovery on a new phone**: "I already have a server" then "Recover by email": the address, a mailed one-time code, and the
  code typed in the app. The new phone's own fresh token is then bound to the same rider by the sidecar, and the phone joins by
  invitation as usual. A lost phone can be cut off (`revokeOthers`). The answer to the first step is the same whether or not the
  address is known, so an address cannot be probed.
- The store purchase remains the way back for a paid plan (ADR 0048); the email is the way back for a free server, and also
  helps a paid one whose purchase is pending or whose store account changed.
- The contract is the sidecar's to write (a call to set an address and confirm it, one to start a recovery and confirm it); the
  app builds against its OpenAPI. Not built until that exists.

## Consequences

The rider is warned honestly and can always get back in. The app and the sidecar now handle an email address: the privacy policy,
the Apple App Privacy labels and Google's Data safety form must list it (collected, linked to the user, used for account recovery,
deleted with the account), and Delete my server and data must delete it. A mail account that is lost is a way into the server, so
the recovery mails are short, carry no link, and a recovery tells the old phones (the server's connections) that it happened.

## Alternatives considered

A recovery code the rider writes down: nothing to host and no personal data, but it is lost as easily as the phone; kept as a
second option for riders who give no email. Sign in with Apple or Google: heavy per platform. Backing up the token to the phone's
cloud keychain: not on Android, not across platforms.
