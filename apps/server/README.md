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
- Tracked shops app API (`api.app.shops.list|track|refresh`)
- Dashboard summary app API (`api.app.dashboard.getSummary`)
- Keyword rank read API (`api.app.keywords.getDailyProductRanksForKeyword`)
- Currency conversion API (`api.app.currency.getStatus|refresh`)
- Keyword rank sync inserts a `tracked_listings` row only when a ranked listing is not already
  tracked, then inserts `product_keyword_ranks`
- Newly discovered listings from keyword sync enqueue `sync-listing` jobs to hydrate canonical
  listing snapshot fields
- Scheduled currency rates sync job (`sync-currency-rates`) refreshes USD conversion rates cache
  from `open.er-api.com`
- Canonical listing snapshot fields (`price*`, `quantity`, `endingTimestamp`, `shouldAutoRenew`,
  `views`, `numFavorers`, `shopName`, `etsyState`, `updatedTimestamp`, `lastRefreshedAt`,
  `lastRefreshError`) are owned by listing sync (`track|refresh`) paths
- Tracked listings persist `isDigital` based on Etsy `listing_type`
- Tracked listings persist sync queue state in `tracked_listings.syncState` (`idle|queued|syncing`)
  so dashboard refresh actions can reflect in-progress work across page reloads
- Tracked keywords persist sync queue state in `tracked_keywords.syncState` (`idle|queued|syncing`)
  so dashboard "next sync" labels can reflect queued/in-progress syncs across page reloads
- Canonical queue/sync-state lifecycle is documented in `docs/refresh-strategy.md`
  (`Queue State Management` section)
- User-facing event logs persisted in `event_logs` with admin listing API
- Event log action catalog documented in `docs/event-log-actions.md`
- Listing responses include derived `priceUsdValue` computed from cached conversion rates at
  request time
- Product keyword-rank query (`api.app.listings.getKeywordRanksForProduct`)
- First Etsy bridge file:
  - `apps/server/src/services/etsy/bridges/exchange-oauth-token.ts`
- Listing bridge:
  - `apps/server/src/services/etsy/bridges/get-listing.ts`
- Search listings bridge:
  - `apps/server/src/services/etsy/bridges/find-all-listings-active.ts`
- Shop bridges:
  - `apps/server/src/services/etsy/bridges/get-shop.ts`
  - `apps/server/src/services/etsy/bridges/find-shops.ts`
  - `apps/server/src/services/etsy/bridges/find-all-active-listings-by-shop.ts`

Planned next layers (not yet scaffolded):

- Primitive and timeseries storage

## Run Locally

```bash
bun install --frozen-lockfile
bun run server:dev
```

`server:dev` runs under `varlock run`, so there is no `.env` step: values resolve from the committed
`.env.schema` through 1Password.

Useful scripts:

- `bun run server:dev` - run with watch mode (jobs disabled for local development)
- `bun run server:build` - bundle to `apps/server/dist`
- `bun run server:start` - run bundled server (jobs enabled)
- `bun run server:typecheck` - TypeScript checks
- `bun run server:test` - focused unit tests
- `bun run --cwd apps/server db:generate` - generate Drizzle migrations from schema
- `bun run --cwd apps/server db:migrate` - run pending Drizzle migrations, stopping before centralized-access cleanup until it is recorded
- `bun run --cwd apps/server db:migrate:phase1` - run only the centralized-access phase-one migration
- `bun run --cwd apps/server db:migrate:phase2` - apply centralized-access cleanup after approved backfill
- `bun run --cwd apps/server access:audit` - read-only central-access migration audit
- `bun run --cwd apps/server access:plan` - fail-closed explicit mapping planner
- `bun run --cwd apps/server access:backfill` - approved transactional projection/account backfill

## Environment Variables

`.env.schema` at the repository root is the contract: canonical names, types, sensitivity, and the
per-lifecycle 1Password references. There is no `.env` file and no manual setup step — every entry
point runs under `varlock run`. `docs/deployment.md` maps each value to the vault that holds it.

Secrets (resolved from 1Password):

- `MERCHBASE_CLERK_SECRET_KEY`, `MERCHBASE_CLERK_JWT_KEY` — shared suite Clerk instance
- `ETSYSENTRY_CLERK_WEBHOOK_SIGNING_SECRET` — production only; development registers no webhook route
- `ETSYSENTRY_ADMIN_MERCHBASE_USER_ID` — optional; unset disables the admin tRPC surface
- `ETSYSENTRY_ETSY_API_KEY`, `ETSYSENTRY_ETSY_API_SHARED_SECRET`
- `ETSYSENTRY_DATABASE_PASSWORD`

Public values (schema literals, per lifecycle):

- `MERCHBASE_CLERK_ISSUER`, `MERCHBASE_CLERK_PUBLISHABLE_KEY`
- `ETSYSENTRY_CLERK_AUTHORIZED_PARTIES`
- `ETSYSENTRY_PORT`, `ETSYSENTRY_APP_ORIGIN`, `ETSYSENTRY_DISABLE_SERVER_JOB_RUNNER`
- `ETSYSENTRY_ETSY_OAUTH_REDIRECT_URI` (must be the public server URL in production, for example
  `https://etsysentry.merchbase.co/auth/etsy/callback`, and must match the Etsy app settings)
- `ETSYSENTRY_ETSY_OAUTH_SCOPES` (space/comma-delimited; `listings_r` is always added)
- `ETSYSENTRY_ETSY_OAUTH_STATE_TTL_MS`, `ETSYSENTRY_ETSY_OAUTH_REFRESH_SKEW_MS`
- `ETSYSENTRY_ETSY_RATE_LIMIT_DEFAULT_PER_SECOND`, `ETSYSENTRY_ETSY_RATE_LIMIT_DEFAULT_PER_DAY`,
  `ETSYSENTRY_ETSY_RATE_LIMIT_MAX_RETRIES`, `ETSYSENTRY_ETSY_RATE_LIMIT_BACKOFF_INITIAL_MS`,
  `ETSYSENTRY_ETSY_RATE_LIMIT_BACKOFF_MAX_MS`, `ETSYSENTRY_ETSY_API_REQUEST_TIMEOUT_MS`
- `ETSYSENTRY_DATABASE_HOST`, `ETSYSENTRY_DATABASE_PORT`, `ETSYSENTRY_DATABASE_NAME`,
  `ETSYSENTRY_DATABASE_USER`

`NODE_ENV` is set by the runtime image, not by the schema, and is the in-container lifecycle signal.

## OAuth Flow (Etsy v3)

1. Client calls `api.app.etsyAuth.start` (mutation) with Clerk bearer auth to obtain:
   - `authorizationUrl`
2. Client redirects user to Etsy authorize URL.
3. Etsy redirects to `ETSYSENTRY_ETSY_OAUTH_REDIRECT_URI` (`/auth/etsy/callback`), and this value must also be
   registered in your Etsy app settings.
4. Callback verifies `state`, exchanges `code` for tokens via the OAuth bridge, and stores token
   state keyed by `accountId`.
5. Client calls `api.app.etsyAuth.status` / `api.app.etsyAuth.refresh` with Clerk bearer auth.

## Centralized Access

See [`docs/centralized-access-cutover.md`](../../docs/centralized-access-cutover.md) for the
as-built access contract, two-phase migration tooling, and production cutover runbook. The
Etsy OAuth connection is provider state, not customer authentication, and remains keyed by the
existing local account UUID.

Container builds install the private `@merchbaseco/access` package through the
`github_packages_token` BuildKit secret, which Compose sources from `MERCHBASE_GITHUB_NPM_TOKEN`.
`bun run deploy` resolves it under the install switch when the environment does not already carry
one; the deploy workflow supplies its package-read `github.token` instead. The token is never an
image build argument, Dockerfile environment variable, or committed environment file.

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
- `api.app.shops.list`
- `api.app.shops.track`
- `api.app.shops.refresh`

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
  `app.keywords.list`, `app.listings.list`, and `app.shops.list`.
- Job runtime performs startup reconciliation via `apps/server/src/jobs/startup-reconciliation*.ts`
  before workers start; tasks are extensible and currently include resetting stale
  `tracked_keywords.syncState` / `tracked_listings.syncState` / `tracked_shops.syncState` rows
  that have no live `sync-keyword` / `sync-listing` / `sync-shop` pg-boss job.
- Startup queue-state lifecycle semantics are defined in `docs/refresh-strategy.md`
  (`Queue State Management` section).
- Keyword ranks are auto-synced by `pg-boss` workers:
  - immediate enqueue when a keyword is tracked
  - daily scheduled dispatch for due tracked keywords
- Shop monitors are auto-synced by `pg-boss` workers:
  - immediate enqueue when a shop is tracked or manually refreshed
  - daily scheduled dispatch for due tracked shops
- Listing monitors are auto-synced by `pg-boss` workers:
  - `sync-listing` worker uses local concurrency `5` per server process
  - daily scheduled dispatch for due tracked listings (`trackingState != paused`)
- USD conversion rates are auto-synced by `pg-boss` workers every 24 hours.
- Etsy bridge HTTP calls are protected by in-process rate limiting with dynamic header sync:
  - reads `x-limit-per-second`, `x-limit-per-day`, `x-remaining-*`
  - honors `retry-after` on rate-limit responses
  - applies exponential backoff when `retry-after` is absent
- `api.app.*` procedures require Clerk bearer auth (`Authorization: Bearer <token>`).
- Admin-only app procedures require the authenticated stable `merchbaseUserId` to match the
  operator-supplied `ETSYSENTRY_ADMIN_MERCHBASE_USER_ID`; email is never used for authorization.
- Customer API-key issuance, verification, routes, UI, and local API-key storage are removed at
  clean cutover. CLI/automation uses `MERCHBASE_API_KEY` and the shared Merchbase Keychain entry.
- `accounts.merchbaseUserId` is the only local account mapping used by request and background-job
  authorization. Existing Etsy OAuth/provider state and product/metering rows remain account-keyed.
- Keep `.env.schema` updated when env vars change; `bun run check` fails when it drifts.
- Do not embed Etsy HTTP calls directly in routers/jobs; add bridges instead.
