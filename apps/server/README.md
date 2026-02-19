# EtsySentry Server

Fastify + tRPC API for EtsySentry's Etsy API v3 integrations and monitoring jobs.

## Scope

- Primitive management (`keyword`, `listing`, `shop`)
- Continuous monitoring pipeline (pg-boss spaced scheduling)
- Etsy API v3 bridge orchestration
- Public APIs for agent/CLI usage
- Rich event logging for every monitor action

## Planned Runtime Stack

- Bun + TypeScript
- Fastify + tRPC
- PostgreSQL + Drizzle ORM
- Queue/scheduler (pg-boss)
- Clerk (multi-tenant auth and user management)

## Local Development (Target)

```bash
bun install
cp .env.example .env
docker compose -f apps/server/compose.yml up --build
```

## Core Scripts (Target)

- `bun run build` - bundle server
- `bun run start` - run compiled server
- `bun run dev` - development server
- `bun run cli -- <command>` - CLI for public API

## API Structure

- tRPC routes under `/api`
- `api.public.*` - CLI/agent endpoints
- `api.app.*` - dashboard/admin endpoints

Initial public surface goals:

- `api.public.primitive.create`
- `api.public.primitive.list`
- `api.public.primitive.get`
- `api.public.series.keywordRank`
- `api.public.series.listingMetrics`
- `api.public.series.shopListings`

Initial app/admin surface goals:

- `api.app.apiKey.create|list|revoke` (user-owned keys)
- `api.app.logs.list|tail|export` (admin-only)

## Job Topology (Initial)

- Dispatcher runs continuously and enqueues due jobs through pg-boss.
- `monitor-keywords`
  - Fetch top 3 Etsy search result pages for each due keyword primitive.
  - Upsert discovered listings.
  - Write daily rank observations.
  - Fixed daily cadence in v1.
- `monitor-listings`
  - Fetch listing details for each due listing.
  - Update listing profile data.
  - Append listing metrics snapshots.
  - Compute `estimatedSales` via helper (reviews + views + quantity-drop + favorers signal).
  - Adapt cadence from Etsy `updated_timestamp`:
    - no change for 3 days => every 3 days
    - no change for 7 days => every 7 days
    - any change => reset to every 1 day
  - Persist intended cadence metadata row per listing for auditability.
- `monitor-shops`
  - Fetch shop listing set/updates for due shop primitives.
  - Upsert listings and shop-listing relationships.
  - Emit change/no-change logs; cadence policy for shops can be extended later.
  - Fixed daily cadence in v1.

Every action above emits a durable event log row.

## Etsy API Bridge Contract

- Location: `apps/server/src/services/etsy/bridges`
- Rule: one Etsy endpoint per file.
- Rule: bridge files are thin wrappers only.
- Rule: orchestration/retries/rate-limiting belong in higher-level services.

## Data Persistence (Initial)

- Primitives table(s): keyword/listing/shop + metadata
- Listing profile table: descriptive listing metadata
- Listing metric snapshots: append-only timeseries records
- Listing monitor metadata: explicit intended cadence + reason per listing
- Keyword ranking observations: append-only by date + page + position
- Shop listing observations: append-only listing membership history
- Monitor run records: status, latency, error metadata
- Event logs table: one row per monitor action (for rich log UI)

## Operational Notes

- Keep startup status summary current in server entrypoint as jobs/services are added.
- Add observability early (structured logs + monitor run IDs + endpoint traces).
- Keep `.env.example` updated whenever env vars change.
