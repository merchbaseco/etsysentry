# Development Sign-In

A development session opens on a signed-in dashboard. Nobody types a password, and nobody sets
anything up: the server mints a short-lived Clerk ticket for one fixed identity, the website spends
it, and the dev seed has already given that identity something to look at.

This is the auth half of the boot contract. The data half is
[`dev-data-seed.md`](dev-data-seed.md); the two only work together.

## The identity

The shared Merchbase **Dev Sign-In user** — Clerk user `user_38Q9fcwOarmNP41Hb4P9TPUt8rS`, whose
Clerk `public_metadata` maps it to Merchbase user `mbu_0ae4691c2dff45559d559bea99cd621b`. Every
Merchbase product signs its development sessions in as this one identity, which is what makes a
seeded database in one repo look like a seeded database in another.

Both ids are opaque public identifiers, not credentials, and both are committed on purpose: the
venue that needs them most — an ephemeral cloud VM — has to be correct before it can reach a vault.
The Clerk user id is declared as `ETSYSENTRY_DEV_CLERK_SIGN_IN_USER_ID` in `.env.schema`; the
Merchbase user id belongs to `@merchbaseco/access` and is imported from
`@merchbaseco/access/dev`, never re-typed here.

The development Clerk instance enables no password strategy, so there is no sign-in form to fill
even by hand. A **sign-in token** is the supported substitute: single-use, short-lived, minted
server-side against that one user id.

## Access, which is not the same as identity

A Clerk session proves who you are. EtsySentry authorizes against an **Access Projection** held in
its own database and kept current by Clerk webhooks — and a local or cloud database receives no
webhooks, so a freshly migrated one has no projection at all. A perfectly valid session would then
be told `UNAUTHORIZED` by every procedure before any seeded data could be seen.

The dev seed closes that gap by calling `bootstrapDevAccessProjection` from
`@merchbaseco/access/dev`, which writes the row the webhook would have written, through the very
same `AccessProjectionStore` adapter the webhook handler uses. **This repository writes no
projection SQL of its own.** The bootstrap refuses production, a non-loopback database, and the
production Clerk issuer, and it has no override.

The issuer it is given is byte-identical to the one `createClerkAuthenticator` is configured with —
`env.MERCHBASE_CLERK_ISSUER`, which is
`https://tolerant-roughy-27.clerk.accounts.dev` in development. A projection stored under any other
issuer authorizes nothing, because the authenticator looks the session's own `iss` up.

### When the bootstrap refuses

```
Bootstrapped the etsysentry Access Projection but it still does not grant mbu_…. A newer
projection event already owns subject user_… at https://…; delete this local database's Access
Projection rows and re-run the development seed.
```

Do exactly that — the bootstrap claims a deliberately ancient `sourceUpdatedAt` so that a real
webhook always wins over it, which also means a newer row is never overwritten:

```bash
psql -h 127.0.0.1 -p 5435 -U etsysentry -d etsysentry \
  -c 'delete from access_projection; delete from access_projection_event;'
bun run db:seed:dev
```

## Minting, and the three conditions

`POST /auth/dev/clerk-sign-in-token` returns `{ ticket, expiresInSeconds }`. The route is
**registered only when all three hold**, so an environment failing any of them serves a plain 404
rather than a guarded handler:

| Condition | Why |
| --- | --- |
| `NODE_ENV` is not `production` | There is no production equivalent of this flow, and minting one against the production instance would be an account-takeover primitive. |
| `ETSYSENTRY_DEV_CLERK_SIGN_IN_USER_ID` is set | The schema resolves nothing for it in production. |
| The database host is loopback | Load-bearing — see below. |

The loopback-database condition is the one that matters day to day. Local development points at the
**live** EtsySentry database over Tailscale, and auto sign-in there would silently swap a
developer's own identity for the shared development one against real data. Only a database on this
machine is a seeded, disposable one — the same test the dev seed itself applies. It is checked
instead of the request's `Host` header because a cloud session reaches the site through a port
forwarder on a public hostname, and unlike a header the database target cannot be forged by the
caller.

`bun run server:dev` prints `devAutoSignIn` in its startup summary: the user id when armed, `off`
otherwise.

## Spending the ticket

`useDevAutoSignIn` (`apps/website/src/hooks/use-dev-auto-sign-in.ts`) runs once while the app is
signed out, in development builds only. It asks for a ticket, exchanges it through
`signIn.create({ strategy: 'ticket' })`, and activates the session. A `404` is the ordinary answer
on a local checkout pointed at the live database and is not treated as an error.

The ticket never reaches the URL bar. Clerk also accepts one as a `__clerk_ticket` query parameter
on the app's own origin, and `ClerkProvider` has already consumed any such parameter by the time
Clerk reports itself loaded — so a leftover one is stripped from history, spent or not. A spent
ticket sitting in the URL bar is still a credential in history.

**The ticket is a credential.** It appears in one response body and nowhere else: not in a log, not
in an error message, not in a URL this app constructs. Its TTL is 60 seconds, which is generous for
one page load.

Do not reuse the `url` a Clerk mint response carries. It points at Clerk's own Account Portal,
which signs the browser in on Clerk's host and stops there — the session lands on an origin the app
cannot read.

## Reaching the dev server

`ETSYSENTRY_DEV_HOST` is the repository's contract for the website dev server's bind address, read
by `apps/website/vite.config.ts` and by nothing in the server runtime. It defaults to `127.0.0.1`,
which keeps a dev server — and the synthetic data behind it — off the network.

An environment that reaches the server through a port forwarder sets `0.0.0.0`, because such
forwarders find a session's ports by watching for listening sockets and a loopback-only bind is
invisible to them. `.cursor/start.sh` exports it for the cloud flow, so that vendor detail lives
under `.cursor/` rather than in app code. The API server already binds every interface and needs no
knob.

Only the socket widens. `ETSYSENTRY_APP_ORIGIN` stays loopback, so nothing about the origin the app
believes it serves changes.
