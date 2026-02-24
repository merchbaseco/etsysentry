# EtsySentry Server

Fastify + tRPC API for EtsySentry Etsy API v3 integrations and monitoring jobs.

## Current Scope

Implemented scaffold:

- Fastify runtime with tRPC mounted at `/api`
- WebSocket realtime invalidation endpoint at `/ws`
- OAuth callback endpoint at `/auth/etsy/callback`
- Etsy OAuth PKCE flow (`api.app.etsyAuth.*`)
- PostgreSQL + Drizzle foundation (schema, migrations, runtime connection)
- pg-boss keyword sync automation (dispatch + workers)
- Tracked listings app API (`api.app.listings.list|track|refresh`)
- Tracked keywords app API (`api.app.keywords.list|track`)
- Dashboard summary app API (`api.app.dashboard.getSummary`)
- Keyword rank read API (`api.app.keywords.getDailyProductRanksForKeyword`)
- Currency conversion API (`api.app.currency.getStatus|refresh`)
- Keyword rank sync inserts a `tracked_listings` row only when a ranked listing is not already
  tracked, then inserts `product_keyword_ranks`
- Newly discovered listings from keyword sync enqueue `sync-listing` jobs to hydrate canonical
  listing snapshot fields
- Scheduled currency rates sync job (`sync-currency-rates`) refreshes USD conversion rates cache
  from `open.er-api.com`
- Canonical listing snapshot fields (`price*`, `quantity`, `views`, `numFavorers`, `shopName`,
  `etsyState`, `updatedTimestamp`, `lastRefreshedAt`, `lastRefreshError`) are owned by listing
  sync (`track|refresh`) paths
- User-facing event logs persisted in `event_logs` with admin listing API
- Listing responses include derived `priceUsdValue` computed from cached conversion rates at
  request time
- Product keyword-rank query (`api.app.listings.getKeywordRanksForProduct`)
- First Etsy bridge file:
  - `apps/server/src/services/etsy/bridges/exchange-oauth-token.ts`
- Listing bridge:
  - `apps/server/src/services/etsy/bridges/get-listing.ts`
- Search listings bridge:
  - `apps/server/src/services/etsy/bridges/find-all-listings-active.ts`

Planned next layers (not yet scaffolded):

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

- `CLERK_SECRET_KEY`
- `ADMIN_EMAIL`
- `ETSY_API_KEY`
- `ETSY_API_SHARED_SECRET`
- `ETSY_OAUTH_REDIRECT_URI` (must be your public server URL in production, for example
  `https://etsysentry.merchbase.co/auth/etsy/callback`)

Optional:

- `ETSY_OAUTH_SCOPES` (space/comma-delimited; `listings_r` is always required)
- `ETSY_OAUTH_STATE_TTL_MS`
- `ETSY_OAUTH_REFRESH_SKEW_MS`
- `ETSY_RATE_LIMIT_DEFAULT_PER_SECOND`
- `ETSY_RATE_LIMIT_DEFAULT_PER_DAY`
- `ETSY_RATE_LIMIT_MAX_RETRIES`
- `ETSY_RATE_LIMIT_BACKOFF_INITIAL_MS`
- `ETSY_RATE_LIMIT_BACKOFF_MAX_MS`
- `DATABASE_HOST` (default `localhost`)
- `DATABASE_PORT` (default `5435`)
- `DATABASE_NAME` (default `etsysentry`)
- `DATABASE_USER` (default `etsysentry`)
- `DATABASE_PASSWORD` (default `etsysentry_local_dev_password`)

## OAuth Flow (Etsy v3)

1. Client calls `api.app.etsyAuth.start` (mutation) with Clerk bearer auth to obtain:
   - `authorizationUrl`
2. Client redirects user to Etsy authorize URL.
3. Etsy redirects to `ETSY_OAUTH_REDIRECT_URI` (`/auth/etsy/callback`), and this value must also be
   registered in your Etsy app settings.
4. Callback verifies `state`, exchanges `code` for tokens via the OAuth bridge, and stores token
   state keyed by tenant + Clerk user.
5. Client calls `api.app.etsyAuth.status` / `api.app.etsyAuth.refresh` with Clerk bearer auth.

## API Structure

- tRPC routes under `/api`
- Realtime invalidation websocket under `/ws`
- `api.public.*` - CLI/agent endpoints (placeholder router currently)
- `api.app.*` - dashboard/admin endpoints

Current app surface:

- `api.app.admin.status` (admin-only)
- `api.app.admin.enqueueSyncAllListings` (admin-only)
- `api.app.dashboard.getSummary`
- `api.app.etsyAuth.start`
- `api.app.etsyAuth.status`
- `api.app.etsyAuth.refresh`
- `api.app.etsyAuth.disconnect`
- `api.app.listings.list`
- `api.app.listings.track`
- `api.app.listings.refresh`
- `api.app.listings.refreshMany`
- `api.app.listings.getKeywordRanksForProduct`
- `api.app.keywords.list`
- `api.app.keywords.track`
- `api.app.keywords.getDailyProductRanksForKeyword`
- `api.app.logs.list` (admin-only)
- `api.app.currency.getStatus`
- `api.app.currency.refresh`

## Etsy Bridge Rules

- Location: `apps/server/src/services/etsy/bridges`
- One Etsy endpoint per bridge file
- Thin transport mapping only
- Retries/orchestration/persistence belong in services/jobs
- OpenAPI contract source: `https://www.etsy.com/openapi/generated/oas/3.0.0.json`
- Implementation guide: `docs/etsy-openapi-bridges.md`

## Operational Notes

- Startup logs include a status summary with API prefix, callback path, and OAuth scopes.
- `/ws` requires a Clerk bearer token passed as `token` query param during websocket connect.
- Realtime websocket payloads are invalidation-only events (no record payloads), currently targeting
  `app.keywords.list` and `app.listings.list`.
- Keyword ranks are auto-synced by `pg-boss` workers:
  - immediate enqueue when a keyword is tracked
  - daily scheduled dispatch for due tracked keywords
- USD conversion rates are auto-synced by `pg-boss` workers every 24 hours.
- Etsy bridge HTTP calls are protected by in-process rate limiting with dynamic header sync:
  - reads `x-limit-per-second`, `x-limit-per-day`, `x-remaining-*`
  - honors `retry-after` on rate-limit responses
  - applies exponential backoff when `retry-after` is absent
- `api.app.*` procedures require Clerk bearer auth (`Authorization: Bearer <token>`).
- Admin-only app procedures require authenticated user email to match `ADMIN_EMAIL`.
- Keep `.env.example` updated when env vars change.
- Do not embed Etsy HTTP calls directly in routers/jobs; add bridges instead.
