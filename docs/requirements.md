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
- Raw payload retention: do not retain raw Etsy payloads; retain normalized fields only.
- Monitoring orchestration: continuous spacing with pg-boss jobs (not one global fixed daily run).
- Tenancy: multi-tenant from the start.
- Auth:
  - Clerk for app/user auth
  - managed API keys for CLI/public API auth
  - API keys are user-owned; no role system for key ownership
  - admin-only behavior is gated by `ADMIN_EMAIL` match (RankWrangler style)
- API organization: mirror RankWrangler tRPC organization with `api.public.*` and `api.app.*`.

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
  - Capture pages 1-3 each run.
  - Persist listing ranking observations with page and position.
  - Auto-add newly discovered listings.
- Listing monitoring:
  - Store/update listing profile data separately from metric snapshots.
  - Capture snapshot fields at each run (at minimum: review count, review average, favorers, price).
  - Add additional quantitative fields from Etsy listing responses where useful.
  - Persist append-only historical metric rows.
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
  - Capture active/recent listings for the shop each run.
  - Persist listing membership observations.
  - Auto-add discovered listings.
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
- Bridge pattern is mandatory:
  - each Etsy endpoint has one bridge file
  - bridge files are thin transport wrappers only

## Non-Goals (Initial Phase)

- Browser extension support
- Near-real-time monitoring (sub-daily cadence)
- Multi-marketplace abstraction beyond Etsy
- Advanced alerting/notification workflows

## Data Quality Requirements

- Timeseries records are append-only.
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
