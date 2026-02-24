# EtsySentry Requirements (Draft v0.3)

## Product Goal

Enable automated, daily monitoring of Etsy search and listing performance so agents can retrieve
current and historical data for analysis.

## Confirmed Decisions

- Geography scope: US only for v1.
- Etsy integration: Etsy API v3 only.
- Listing storage model:
  - store listing profile data (title, seller/shop identity, tags, descriptive metadata)
  - store listing metrics snapshots separately (review count, average rating, favorites/favorers, and
    other useful quantitative fields from listing APIs)
  - persist native Etsy listing price fields as source of truth; derive USD-converted price at
    request time from server-managed FX cache
- Raw payload retention: do not retain raw Etsy payloads; retain normalized fields only.
- Monitoring orchestration: continuous spacing with pg-boss jobs (not one global fixed daily run).
- Tenancy: multi-tenant from the start.
- Auth:
  - Clerk for app/user auth
  - Clerk identity is only used at the auth boundary to resolve `accountId`
  - tenant/domain records are keyed by `accountId` (not Clerk user ids)
  - managed API keys for CLI/public API auth
  - API keys are user-owned; no role system for key ownership
  - admin-only behavior is gated by `ADMIN_EMAIL` match (RankWrangler style)
- API organization: mirror RankWrangler tRPC organization with `api.public.*` and `api.app.*`.
- API naming: user-intent-first names (for example: `track`,
  `getDailyProductRanksForKeyword`, `getKeywordRanksForProduct`).
- Listing field ownership:
  - keyword monitoring owns rank data and listing discovery insertion only
  - listing monitoring is the canonical source for listing snapshot fields

## Primitives

1. `keyword`
2. `listing`
3. `shop`

Each primitive must be creatable, listable, retrievable, and monitorable.

## Functional Requirements

### 1) Primitive Management

- Users/agents can add primitives via API and CLI.
- Primitive add should be idempotent where possible (avoid duplicate active records).
- Primitive metadata includes:
  - creation timestamp
  - status (`active`, `paused`, `archived`)
  - source (manual, discovered-from-keyword, discovered-from-shop)

### 2) Daily Monitoring

- Monitoring starts at daily cadence for active primitives.
- Listing cadence policy uses Etsy `updated_timestamp` from `getListing`:
  - if no listing change for 3 days, move listing to 3-day cadence
  - if no listing change for 7 days, move listing to 7-day cadence
  - once a listing changes, reset back to 1-day cadence
- Listing cadence must be persisted as explicit metadata per listing for auditability:
  - intended cadence (`1d`, `3d`, `7d`)
  - cadence reason (`updated_timestamp_changed`, `3_day_no_change`, `7_day_no_change`)
  - last evaluated timestamp
- Keyword monitoring:
  - Query Etsy search for the keyword.
  - Capture first-page results each run.
  - Persist listing ranking observations with a single absolute rank per listing.
  - Upsert every encountered listing id into `tracked_listings` (dedupe by account + Etsy listing id).
  - Enqueue listing sync jobs for newly inserted listing rows so canonical listing snapshots are
    hydrated.
- Listing monitoring:
  - Is the canonical source of truth for listing snapshot fields.
  - Store/update listing profile data separately from metric snapshots.
  - Capture snapshot fields at each run (at minimum: favorers, price, views, quantity).
  - Add additional quantitative fields from Etsy listing responses where useful.
  - Persist one listing metric row per UTC calendar day (dedupe by account + listing + day).
  - If a listing is synced multiple times in one UTC day, keep only the most recent run for that day.
  - Sales is treated as an inferred/estimated metric if Etsy does not provide a direct field.
  - Estimated sales must be implemented in v1 and isolated into a helper to support recalculation.
  - v1 estimate should combine three methods into an intelligent weighted average:
    - reviews-based estimate: `reviewCount * 10` baseline (`*7` conservative, `*15` generous)
    - views-based estimate: `views * conversionRate` using 1%-5% range (3% midpoint)
    - quantity-drop estimate: weekly `quantity` deltas from snapshots (delta ~= sold units for window)
    - default method weights (when all signals are available):
      - reviews: `0.50`
      - views: `0.30`
      - quantity-drop: `0.20`
    - if one method is unavailable, renormalize weights across available methods
  - `num_favorers` should be included as a weighting signal for confidence/adjustment in the helper.
- Shop monitoring:
  - Capture the active listing set for the shop each run.
  - Use incremental pagination with `sort_on=updated`, `sort_order=desc`.
  - First run captures the full active set; later runs stop once they pass the prior sync watermark
    (including the full tie bucket at that watermark timestamp).
  - Persist daily shop metrics snapshots with at least:
    - active listing count
    - new listings count
    - favorites total + daily delta
    - sold total + daily delta
    - review total + daily delta
  - Persist tracked shop listing state with:
    - `firstSeenAt`
    - `lastSeenAt`
    - active/inactive status
  - Upsert every encountered listing id into `tracked_listings` (dedupe by account + Etsy listing id).
  - Enqueue listing sync jobs for newly inserted listing rows.
  - Removals are eventual state transitions (`isActive = false`), not exact daily counts.
- v1 cadence policy for primitives:
  - listing: adaptive (`1d -> 3d -> 7d -> 1d on change`)
  - keyword: fixed daily
  - shop: fixed daily

### 3) Retrieval Interfaces

- CLI and public API support:
  - singular data retrieval (`get` style)
  - series retrieval for trend/performance analysis
- Example query families:
  - primitive-level metadata
  - listing metric timeseries
  - keyword listing rank timeseries
  - shop listing change history

### 4) Integration Requirements

- Etsy API v3 is the only external catalog/performance provider for now.
- Etsy OpenAPI source-of-truth for endpoint contracts:
  - `https://www.etsy.com/openapi/generated/oas/3.0.0.json`
- Bridge pattern is mandatory:
  - each Etsy endpoint has one bridge file
  - bridge files are thin transport wrappers only

## Non-Goals (Initial Phase)

- Browser extension support
- Near-real-time monitoring (sub-daily cadence)
- Multi-marketplace abstraction beyond Etsy
- Advanced alerting/notification workflows

## Data Quality Requirements

- Rank/fact timeseries records are append-only (for example keyword rank history).
- Listing metric snapshots are day-keyed and keep only the most recent run per UTC day.
- Monitor runs are auditable with status and error details.
- Daily runs should be resumable/retriable if partial failure occurs.
- Per-action event logs are first-class records (listing discovered, listing updated, keyword rank
  captured, shop listing added/removed, etc.).

## Security and Access Requirements

- Public API key auth for agent/CLI use.
- App/admin auth uses Clerk and a separate surface (`api.app.*`).
- Secrets remain in environment variables only.
- Tenant isolation is required at the data and API layers.

## Logging Requirements

- Every monitor action must emit a durable event log row.
- Log rows must be filterable by tenant, primitive type, primitive id, listing id, shop id, severity,
  and date/time window.
- Log UI should support:
  - searchable, high-density rows
  - live mode auto-refresh
  - rich facets similar to Vercel log UX
  - quick drill-in from a row to primitive/listing/shop context
- Log retention policy: hot 14 days.
- Log display is a separate website page and restricted to admin app endpoints.

## Open Questions

- None currently blocking for v1 specification.
