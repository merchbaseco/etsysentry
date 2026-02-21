# EtsySentry Server

Fastify + tRPC API for EtsySentry Etsy API v3 integrations and monitoring jobs.

## Current Scope

Implemented scaffold:

- Fastify runtime with tRPC mounted at `/api`
- OAuth callback endpoint at `/auth/etsy/callback`
- Etsy OAuth PKCE flow (`api.app.etsyAuth.*`)
- PostgreSQL + Drizzle foundation (schema, migrations, runtime connection)
- Tracked listings app API (`api.app.listings.list|track|refresh`)
- First Etsy bridge file:
  - `apps/server/src/services/etsy/bridges/exchange-oauth-token.ts`
- Listing bridge:
  - `apps/server/src/services/etsy/bridges/get-listing.ts`

Planned next layers (not yet scaffolded):

- pg-boss job orchestration
- Clerk + tenant auth
- Primitive and timeseries storage

## Run Locally

```bash
bun install
cp .env.example .env
bun run server:dev
```

Useful scripts:

- `bun run server:dev` - run with watch mode
- `bun run server:build` - bundle to `apps/server/dist`
- `bun run server:start` - run bundled server
- `bun run server:typecheck` - TypeScript checks
- `bun run server:test` - focused unit tests
- `bun run --cwd apps/server db:generate` - generate Drizzle migrations from schema
- `bun run --cwd apps/server db:migrate` - run Drizzle migrations

## Environment Variables

See `.env.example` for the exact values required by this scaffold.

Required for OAuth:

- `ETSY_API_KEY`
- `ETSY_OAUTH_REDIRECT_URI`

Optional:

- `ETSY_API_SHARED_SECRET`
- `ETSY_OAUTH_SCOPES`
- `ETSY_OAUTH_STATE_TTL_MS`
- `ETSY_OAUTH_REFRESH_SKEW_MS`
- `DATABASE_HOST` (default `localhost`)
- `DATABASE_PORT` (default `5435`)
- `DATABASE_NAME` (default `etsysentry`)
- `DATABASE_USER` (default `etsysentry`)
- `DATABASE_PASSWORD` (default `etsysentry_local_dev_password`)

## OAuth Flow (Etsy v3)

1. Client calls `api.app.etsyAuth.start` (mutation) to obtain:
   - `authorizationUrl`
   - `oauthSessionId`
2. Client redirects user to Etsy authorize URL.
3. Etsy redirects to `ETSY_OAUTH_REDIRECT_URI` (`/auth/etsy/callback`).
4. Callback verifies `state`, exchanges `code` for tokens via the OAuth bridge, and stores token
   state.
5. Client calls `api.app.etsyAuth.status` / `api.app.etsyAuth.refresh` with `oauthSessionId`.

## API Structure

- tRPC routes under `/api`
- `api.public.*` - CLI/agent endpoints (placeholder router currently)
- `api.app.*` - dashboard/admin endpoints

Current app surface:

- `api.app.etsyAuth.start`
- `api.app.etsyAuth.status`
- `api.app.etsyAuth.refresh`
- `api.app.listings.list`
- `api.app.listings.track`
- `api.app.listings.refresh`

## Etsy Bridge Rules

- Location: `apps/server/src/services/etsy/bridges`
- One Etsy endpoint per bridge file
- Thin transport mapping only
- Retries/orchestration/persistence belong in services/jobs
- OpenAPI contract source: `https://www.etsy.com/openapi/generated/oas/3.0.0.json`
- Implementation guide: `docs/etsy-openapi-bridges.md`

## Operational Notes

- Startup logs include a status summary with API prefix, callback path, and OAuth scopes.
- Keep `.env.example` updated when env vars change.
- Do not embed Etsy HTTP calls directly in routers/jobs; add bridges instead.
