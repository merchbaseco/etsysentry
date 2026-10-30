# Development Sign-In

Local and cloud development use the fixed Dev Sign-In user from `@merchbaseco/access/dev`. The
website gets an application session from the same-origin `/auth/session` bootstrap; production
Cloudflare Access credentials and configuration are not needed for ordinary local development.

The development adapter resolves that one stable Merchbase user to the local account projection.
The seed writes the projection through the repository's `AccessProjectionStore`, the same adapter
used by the production Cloudflare Access service. It does not write projection SQL directly.

## Local-only guard

The server calls `assertDevCloudflareAccessTarget` before opening or migrating the database. The
adapter requires `NODE_ENV=development` and a local PostgreSQL DSN. It also rejects production
lifecycle markers, remote database hosts, and ambiguous/query-overridden DSNs. The seed applies the
same guard before dynamically importing the database connection. There is no override flag.

Local development normally points at the live EtsySentry database over Tailscale, so the guard
refuses that target. To use the development identity, start an isolated local PostgreSQL database,
point the app at it, then seed it:

```bash
ETSYSENTRY_DATABASE_HOST=127.0.0.1 \
ETSYSENTRY_DATABASE_NAME=etsysentry_dev \
bun run db:seed:dev
```

The root `dev`, `server:dev`, and `db:seed:dev` scripts set `NODE_ENV=development`; running the
server directly with another lifecycle value does not enable the adapter.

## Browser session

The website calls `GET /auth/session` with same-origin credentials and does not render the dashboard
until the server confirms a session. Unknown or unavailable results remain signed out. The browser
signs out through `/cdn-cgi/access/logout` when running behind Cloudflare Access. There is no Clerk
provider, browser token polling, development ticket route, or authentication token in a URL.

The trusted browser origin remains `ETSYSENTRY_APP_ORIGIN`. Interactive mutations and websocket
upgrades reject any supplied origin that is not an exact match. Native clients may omit `Origin`,
but still need their own cryptographically verified API credential.

## Reaching the dev server

`ETSYSENTRY_DEV_HOST` is the website dev server's bind address, read by
`apps/website/vite.config.ts`. It defaults to `127.0.0.1`; cloud sessions may bind `0.0.0.0` so the
port forwarder can reach the server. The website origin and database guard remain unchanged.
