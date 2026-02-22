# EtsySentry Architecture (Draft v0.3)

## System Overview

EtsySentry is a monorepo server system that ingests Etsy data daily for three primitives
(`keyword`, `listing`, `shop`), stores append-only historical observations, and exposes retrieval
APIs for agents/CLI.

Current scope assumptions:

- US market only (v1).
- Etsy API v3 only.
- Multi-tenant from day one.

## Design Principles

1. One Etsy endpoint per bridge file (thin wrapper only).
2. Business logic lives in orchestrator/services, never in bridge files.
3. Historical data is append-only for auditability and trend analysis.
4. Public API and CLI share one canonical contract (`api.public.*`).
5. Jobs are deterministic and idempotent.
6. Persist normalized data only (no raw Etsy payload retention).
7. Every monitor action emits a durable event log row.
8. Admin-only operational visibility (logs and related ops) stays in `api.app.*` and website UI.

## Proposed Monorepo Layout

```txt
apps/
  server/
    src/
      api/
        public/
        app/
      config/
      db/
      jobs/
      services/
        etsy/
          bridges/
          client.ts
          rate-limiter.ts
          errors.ts
      utils/
packages/
  http-client/
docs/
```

## Runtime Components

1. API server (Fastify + tRPC)
2. Job runner/scheduler (pg-boss)
3. PostgreSQL (Drizzle-managed schema)
4. Etsy integration layer (bridges + client orchestration)
5. Auth layer:
   - Clerk bearer auth for `api.app.*` users/tenants
   - API key validation for CLI/public surface (`api.public.*`)
6. Etsy OAuth connection persistence:
   - server-managed OAuth token storage in PostgreSQL
   - keyed by `(tenantId, clerkUserId)`

## Etsy Integration Layer

### Bridge Rules

- Folder: `apps/server/src/services/etsy/bridges`
- One file per Etsy endpoint, example:
  - `get-shop.ts`
  - `get-shop-listings.ts`
  - `get-listing.ts`
  - `search-listings.ts`
- A bridge file contains:
  - input type(s)
  - output type(s)
  - endpoint path/query handling
  - HTTP call + response parsing/mapping
- A bridge file does not contain:
  - DB access
  - retry loops
  - cross-endpoint orchestration
  - monitoring job logic
- OpenAPI contract source of truth:
  - `https://www.etsy.com/openapi/generated/oas/3.0.0.json`
- Bridge implementation guide:
  - `docs/etsy-openapi-bridges.md`

### Higher-Level Services

- `etsy-search-service.ts`:
  - calls `search-listings` bridge
  - handles Etsy search query wiring (pagination optional by caller)
- `keyword-rankings-service.ts`:
  - calls the active listings search bridge for daily product ranks by keyword
  - persists rank facts into `product_keyword_ranks` (append-only)
  - updates tracked keyword refresh state/errors
- `etsy-listing-service.ts`:
  - calls listing bridges
  - updates listing profile data
  - records listing metric snapshots
- `etsy-shop-service.ts`:
  - calls shop + shop-listings bridges, detects listing set changes

### API Naming Guidance

- Name API procedures from user intent and query perspective.
- Use `...ForKeyword` for keyword-scoped operations.
- Use `...ForProduct` for product/listing-scoped operations.
- Prefer explicit nouns over shorthand:
  - use `daily product ranks`, `keyword ranks for product`
  - avoid vague names such as `latestRanks` or `reverseKeywords`
- Current examples:
  - `api.app.keywords.syncRanksForKeyword`
  - `api.app.keywords.getDailyProductRanksForKeyword`
  - `api.app.listings.getKeywordRanksForProduct`

## Multi-Tenant and Auth Model

- Tenant boundary key: `tenantId` on all tenant-owned tables.
- Clerk user identity maps to one or more tenant memberships (no role model for regular users).
- `api.app.*` procedures:
  - require Clerk bearer auth (`Authorization: Bearer <token>`)
  - derive `tenantId` and `clerkUserId` from verified token/context
  - do not trust client-supplied auth identity fields
  - enforce tenant membership
  - enforce admin-only operations via `email === ADMIN_EMAIL`
- Etsy OAuth connection/session model:
  - OAuth callback exchanges code for tokens and persists connection server-side
  - connection lookup key is `(tenantId, clerkUserId)`
  - website does not persist OAuth tokens/session IDs in browser storage
- API keys:
  - generated/managed via `api.app.apiKey.*`
  - hashed at rest in DB
  - used by CLI against `api.public.*`
  - user-owned keys (owned by a Clerk user)
  - carry tenant context for authorization and query scoping

## Data Model (Initial Draft)

### Core Entities

- `tenants`
  - `id`, `name`, `createdAt`
- `tenant_memberships`
  - `tenantId`, `clerkUserId`, `createdAt`
- `api_keys`
  - `id`, `tenantId`, `ownerClerkUserId`, `name`, `keyPrefix`, `keyHash`, `lastUsedAt`, `revokedAt`
- `etsy_oauth_connections`
  - `tenantId`, `clerkUserId`, `accessToken`, `refreshToken`, `tokenType`, `scopes`, `expiresAt`,
    `createdAt`, `updatedAt`
- `primitives`
  - `id`, `tenantId`, `type`, `value`, `status`, `source`, `createdAt`, `updatedAt`
- `listing_profiles`
  - static/slow-changing listing data
  - `tenantId`, `listingId`, `shopId`, `title`, `description`, `tags`, `shopOwner`,
    `url`, `imageUrl`, `createdAt`, `updatedAt`, `firstSeenAt`, `lastSeenAt`
- `listings`
  - thin canonical listing identity row
  - `tenantId`, `listingId`, `shopId`, `firstSeenAt`, `lastSeenAt`
- `shops`
  - `tenantId`, `shopId`, metadata fields, `firstSeenAt`, `lastSeenAt`

### Observation Tables

- `product_keyword_ranks`
  - purpose: append-only rank facts only (no listing metadata snapshots)
  - `tenantId`, `trackedKeywordId`, `etsyListingId`, `observedAt`, `rank`
- `listing_metric_snapshots`
  - `tenantId`, `listingId`, `observedAt`, `reviewCount`, `reviewAverage`, `favorerCount`,
    `price`, `currency`, `views`, `quantity`, `estimatedSales`
- `shop_listing_observations`
  - `tenantId`, `shopPrimitiveId`, `shopId`, `listingId`, `observedAt`, `isActive`
- `monitor_runs`
  - `id`, `tenantId`, `monitorType`, `targetPrimitiveId`, `startedAt`, `finishedAt`,
    `status`, `error`
- `event_logs`
  - rich per-action log stream
  - `id`, `tenantId`, `occurredAt`, `level`, `category`, `action`, `status`,
    `primitiveType`, `primitiveId`, `listingId`, `shopId`, `keyword`, `message`,
    `detailsJson`, `monitorRunId`, `requestId`

### Scheduling Tables

- `monitor_targets`
  - `tenantId`, `primitiveId`, `monitorType`, `nextRunAt`, `frequencyTier`,
    `consecutiveNoChangeDays`, `lastListingUpdatedTimestamp`, `lastRunAt`, `lastStatus`
- `listing_monitor_metadata`
  - explicit listing cadence audit row
  - `tenantId`, `listingId`, `intendedCadence` (`1d|3d|7d`), `cadenceReason`,
    `lastEvaluatedAt`, `lastUpdatedTimestampSeen`
- `monitor_jobs` (optional audit table if pg-boss internal metadata is not enough)
  - `tenantId`, `monitorType`, `scheduledFor`, `startedAt`, `finishedAt`, `status`

## Monitoring and Scheduling

Scheduling strategy:

1. A lightweight dispatcher runs continuously (e.g., every minute).
2. Dispatcher queries due rows from `monitor_targets` (`nextRunAt <= now()`).
3. Dispatcher enqueues pg-boss jobs spaced over time (avoid burst spikes).
4. Worker handlers execute monitor jobs and update `nextRunAt` + `frequencyTier`.
5. Every action emits an `event_logs` row.

Primitive cadence policy (v1):

- `listing`: adaptive cadence from `updated_timestamp` rules.
- `keyword`: fixed daily cadence.
- `shop`: fixed daily cadence.

Cadence policy (listing `updated_timestamp` aware):

- Tier 1: every 1 day (default).
- Tier 2: every 3 days after 3 no-change days.
- Tier 3: every 7 days after 7 no-change days.
- Reset to Tier 1 immediately when Etsy `updated_timestamp` changes.
- Persist cadence decisions to `listing_monitor_metadata` on every listing monitor run.

### `monitor-keywords`

1. Load due keyword primitive.
2. Search Etsy first page for the tracked keyword.
3. Persist ranking observations.
4. Upsert discovered listings and queue listing monitoring targets.
5. Emit event logs for each discovered listing and each ranking capture batch.

### `monitor-listings`

1. Load due listing target.
2. Fetch listing detail via listing bridges.
3. Upsert profile changes (`listing_profiles`).
4. Append metric snapshot (`listing_metric_snapshots`).
5. Compare `updated_timestamp` against last known value and recalculate cadence tier.
6. Update `listing_monitor_metadata` intended cadence and reason.
7. Emit event logs (updated/no-change/profile-changed/metrics-changed/cadence-changed).

### Estimated Sales Helper (v1)

Keep estimation isolated in a helper module for auditability and recalculation:

- location (proposed): `apps/server/src/utils/estimated-sales.ts`
- inputs:
  - `reviewCount`
  - `views`
  - `quantity`
  - `previousQuantity` (weekly historical snapshot)
  - `numFavorers`
  - listing age / data freshness metadata
- component estimates:
  - reviews method: midpoint `reviewCount * 10` (range `*7`..`*15`)
  - views method: midpoint `views * 0.03` (range `0.01`..`0.05`)
  - quantity-drop method: `max(0, previousQuantity - quantity)` over trailing weekly window
- composition:
  - weighted average of available methods
  - default weights (all signals available):
    - reviews: `0.50`
    - views: `0.30`
    - quantity-drop: `0.20`
  - renormalize across available methods when one signal is missing
  - dynamically reweight based on signal availability:
    - new listings: downweight quantity-drop method
    - sparse view/review signals: rely more on available signals
  - use `numFavorers` as an adjustment/confidence signal
- outputs:
  - `estimatedSales`
  - optional debug fields persisted in snapshot details for later calibration
  - helper version id to support backfill traceability

Helper refinement strategy:

- when estimator logic changes, run a background backfill job to recompute historical
  `estimatedSales` from stored normalized snapshot data.

### `monitor-shops`

1. Load due shop primitive.
2. Fetch shop listing set.
3. Persist membership observations.
4. Upsert/enqueue newly observed listings.
5. Emit event logs for additions/removals/refresh outcomes.

## API Contracts

Canonical specs:

- `docs/api-spec.md` (API modality contract: `api.app.*` + `api.public.*`)
- `docs/cli-spec.md` (CLI command contract)

Public API and CLI intentionally share one canonical shape for `api.public.*`.

### Public API (`api.public.*`)

- `keywords/track|list|get|pause|resume|archive`
- `listings/track|list|get|pause|resume|archive`
- `shops/track|list|get|pause|resume|archive`
- `metrics/series/keywords|listings|shops`

### App API (`api.app.*`)

- `tenant.*` membership + metadata
- `apiKey.create|list|revoke`
- `logs.list|tail|export` (admin-only)
- operator/admin endpoints (admin-only)

## CLI Design

- CLI directly uses `@etsysentry/http-client`.
- Command groups:
  - `config`
  - `keywords|listings|shops` (`products` alias for `listings`)
  - `track` convenience aliases
  - `metrics series keywords|listings|shops`
- No admin functionality from CLI.

## Reliability and Observability

- Structured logs with monitor run IDs and tenant IDs.
- Retry policy on transient Etsy failures (outside bridge files).
- Etsy bridge rate limiting (v1): one global limiter with conservative defaults; split by endpoint
  only if telemetry shows contention.
- Metrics:
  - monitor success rate
  - per-endpoint latency/error rate
  - queue depth and job lag
  - frequency tier distribution
  - event log ingest throughput

## Open Architecture Questions

- None currently blocking for v1 specification.
