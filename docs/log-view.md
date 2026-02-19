# EtsySentry Rich Log View (Draft v0.1)

## Goal

Provide a high-signal, Vercel-style operational log experience where every monitoring action appears
as a distinct, searchable line item.

Access model:

- Separate page in the website application.
- Admin-only visibility (`Clerk user email === ADMIN_EMAIL`).
- Not exposed via CLI or public API.

Examples of actions that must log as separate rows:

- listing discovered from keyword search
- listing profile updated
- listing metrics snapshot recorded
- listing unchanged and cadence backed off
- shop listing added/removed
- keyword ranking page capture completed
- monitor run failure/retry

## UX Direction

Visual direction: dense, dark, terminal-adjacent console inspired by Vercel logs.

- High-contrast dark canvas with subtle separators.
- Compact monospaced timestamps and status tokens.
- Color-coded status/level pills (`success`, `warn`, `error`, `retry`).
- Left filter rail + top search bar + live toggle.
- Timeline-first browsing with fast scan behavior.

## Layout

1. Header row
   - date/time range picker
   - search input
   - `Live` toggle
   - quick actions (`Export`, `Reset filters`)
2. Left facet rail
   - severity/level
   - primitive type
   - action category
   - tenant (for operator/admin views)
   - shop/listing IDs
   - monitor status
3. Main log table
   - fixed header, virtualized rows
   - columns:
     - `Time`
     - `Level`
     - `Action`
     - `Primitive`
     - `Target`
     - `Message`
     - `Run`
4. Detail drawer
   - full payload details
   - links to related primitive/listing/shop
   - monitor run timeline context

## Row Model

Each row maps to one `event_logs` record:

- `occurredAt`
- `level`
- `category`
- `action`
- `status`
- `primitiveType`
- `primitiveId`
- `listingId`
- `shopId`
- `keyword`
- `message`
- `detailsJson`
- `monitorRunId`
- `requestId`
- `tenantId`

## Filtering and Search

Required filters:

- time range
- level (`info`, `warn`, `error`)
- status (`success`, `partial`, `failed`, `retrying`)
- primitive type (`keyword`, `listing`, `shop`)
- action/category
- listing ID / shop ID / keyword
- monitor run id

Search behavior:

- full-text on `message` and selected normalized detail fields
- exact token match for ids (`listingId`, `shopId`, `monitorRunId`, `requestId`)

## Live Mode

- Poll-based first version (short interval) with cursor pagination.
- New rows prepend without resetting scroll when user is reading older logs.
- "N new logs" indicator appears when viewport is not at top.

## Performance Targets

- P95 filter/query response under 300ms for recent 30-day slices.
- Virtualized table rendering for large datasets.
- Cursor pagination, not offset pagination.

## Data Storage

Event logs should be persisted in PostgreSQL as first-class data.

Table (logical): `event_logs`

- partition/index strategy:
  - index `(tenant_id, occurred_at desc)`
  - index `(tenant_id, primitive_type, occurred_at desc)`
  - index `(tenant_id, listing_id, occurred_at desc)`
  - index `(tenant_id, shop_id, occurred_at desc)`
  - full text/search index for `message`

Retention:

- hot retention: 14 days.
- optional archival later; no raw Etsy payload storage.

## API Surface

App/Admin only:

- `api.app.logs.list`
- `api.app.logs.tail`
- `api.app.logs.export`

## Instrumentation Rules

- Every monitoring state transition emits a log row.
- Every external Etsy bridge failure emits a log row with error code/classification.
- Every cadence tier change emits a log row.
- Keep PII/secrets out of `message` and `detailsJson`.
