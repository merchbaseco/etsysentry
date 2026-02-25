# Merchbase Dashboard Logs Spec (Standalone)

This is a standalone specification for implementing a high-signal, user-facing logging system in a
Merchbase product dashboard.

It is written as a general spec: reuse the same design for any Merchbase product area (listing
intelligence, keyword intelligence, shop intelligence, automation, or system operations).

## 1) Core outcome

Primary goal: Merchbase dashboard users can answer "what happened?" in seconds.

System goals:

- each important transition is a durable row in `event_logs`
- events are user-facing, not internal debug traces
- rows are searchable and filterable by identity and status
- new rows appear quickly without hard page refresh

Non-goals:

- step-by-step tracing of every internal function call
- streaming raw third-party payloads into logs

## 2) End-to-end design

1. Domain workflows call a single write gateway (`createEventLog` / `createEventLogs`).
2. The gateway validates input at runtime and writes to `event_logs`.
3. After insert, backend emits a realtime invalidation signal for logs queries.
4. Client receives invalidation, refreshes the head page, and merges new rows safely.
5. If user is reading older logs, incoming rows are staged behind an "N new logs" indicator.

## 3) Canonical event row contract

Use a single event envelope with strict enums.

Enums:

- `level`: `info | warn | error | debug`
- `status`: `success | failed | pending | retrying | partial`
- `primitiveType`: finite set for your Merchbase primitives (for example
  `keyword | listing | shop | system`)

Required fields:

- `id` (unique event ID)
- `accountId` (tenant/account partition key)
- `occurredAt` (event timestamp)
- `category` (high-level domain, for example `keyword`, `listing`)
- `action` (stable action key, for example `keyword.synced`)
- `status`
- `primitiveType`
- `message` (human-readable one-liner)
- `detailsJson` (structured context object)

Optional but strongly recommended fields:

- `primitiveId` (internal record ID)
- `listingId`, `shopId`, `keyword` (external/domain-facing target IDs)
- `monitorRunId` (workflow/job attempt ID)
- `requestId` (request correlation)

Merchbase guidance:

- keep primitive names aligned with dashboard navigation and filters
- use the same names in queue/job names, API filters, and log actions

## 4) Storage and indexing

Use an append-only table (`event_logs`) with at least:

- `(account_id, occurred_at desc)` index
- `(account_id, primitive_type, occurred_at desc)` index
- `(account_id, listing_id, occurred_at desc)` index
- `(account_id, shop_id, occurred_at desc)` index
- `(account_id, monitor_run_id, occurred_at desc)` index

Recommendation: do not hard-delete recent logs; apply retention policy separately.

## 5) Action taxonomy and event selection

This section is the key behavior to preserve.

### 5.1 Log milestones, not internal steps

Emit events only for user-visible milestones:

- intent accepted (`*.sync_queued`)
- terminal outcome (`*.synced` or `*.sync_failed`)
- discovery events (`listing.discovered`)
- batch summary outcomes (`*.bulk_sync_queued` with counts)

Critical rule:

- do not emit `*.sync_started` / `*.sync_finished`
- emit one terminal sync outcome per attempt (`*.synced` or `*.sync_failed`)

### 5.2 Keep action names stable

Naming format:

- `<primitive>.<transition>`

Good examples:

- `keyword.tracked`, `keyword.updated`, `keyword.sync_queued`, `keyword.synced`,
  `keyword.sync_failed`
- `listing.tracked`, `listing.updated`, `listing.discovered`, `listing.bulk_sync_queued`,
  `listing.synced`, `listing.sync_failed`
- `shop.tracked`, `shop.updated`, `shop.synced`, `shop.sync_failed`

These examples are a reference pattern. Keep the grammar, swap the primitive namespace only if your
Merchbase product uses different primitive names.

Bad examples:

- `sync_ok`, `done`, `event_42`, `listing_update_v2`

### 5.3 Status and level are different

Status is workflow state:

- `pending` accepted/queued
- `success` finished successfully
- `failed` terminal failure
- `partial` mixed batch result
- `retrying` active retry lifecycle

Level is urgency/presentation:

- `info` expected transitions
- `warn` degraded but recoverable behavior
- `error` failure paths needing attention
- `debug` low-priority diagnostic lines

## 6) Message and metadata rules

- `message`: short sentence optimized for table scanning
- `detailsJson`: structured payload for diagnostics and exact values

Guidelines:

- message should make sense without opening detail panel
- details should answer "why" and "how many"
- keep details normalized (counts, IDs, error reason/classification)
- never store secrets/tokens/PII or entire raw external payloads

## 7) Write-path rules (prevents duplicates)

Use one central log write gateway and enforce ownership:

- each action has one owner layer (service or orchestrator)
- nested calls must not emit the same action twice
- one sync attempt yields one terminal sync event

Failure handling:

- preserve original domain error behavior
- logging failure must not replace the original failure reason

## 8) Read API contract

Expose one dashboard logs list API with cursor pagination.

Sort order:

1. `occurredAt DESC`
2. `id DESC` for deterministic tiebreaker

Filters:

- `levels`, `statuses`, `primitiveTypes`, `actions`
- `listingId`, `shopId`, `keyword`, `monitorRunId`
- optional `search`

Search behavior:

- partial text match: `message`, `action`, `keyword`
- exact token match: `listingId`, `shopId`, `monitorRunId`, `requestId`

## 9) Realtime model

Prefer invalidation events, not full row pushes.

Event shape:

- type: `query.invalidate`
- queries: list of query keys to invalidate
- account/tenant scoping so users only receive their own invalidations

Client behavior:

- invalidate logs query cache
- refresh head page
- prepend new rows if near top
- stage new rows behind an indicator if user is scrolled down

## 10) UI behavior

Recommended table columns:

- time
- level
- action
- primitive type
- target
- message
- run ID
- status

Interaction model:

- infinite scroll for older pages
- optional live polling fallback
- detail drawer/panel with full metadata
- clear "N new logs available" UX

Merchbase dashboard requirement:

- the log table should be dense and operational, optimized for fast scan during monitoring and
  incident triage

## 11) Common mistakes and fixes

- Mistake: logging both `sync_started` and `sync_finished`.
  Fix: log one terminal event (`*.synced` or `*.sync_failed`) per attempt.
- Mistake: duplicate outcome events from nested orchestration.
  Fix: assign explicit action ownership to one layer.
- Mistake: unstable action names.
  Fix: enforce a stable action catalog and treat changes as contract changes.
- Mistake: status/level mismatch.
  Fix: validate expected pairings in tests.
- Mistake: missing IDs, making logs unfilterable.
  Fix: always populate strongest available identifiers; use `null` intentionally.
- Mistake: only searching `message`.
  Fix: implement exact ID token matching.
- Mistake: realtime pushes full event payloads.
  Fix: push invalidations, fetch canonical rows via API.
- Mistake: logging sensitive external payloads.
  Fix: whitelist details fields and redact aggressively.

## 12) Implementation checklist

1. Define strict enums and a typed event envelope.
2. Create append-only `event_logs` with tenant/time-focused indexes.
3. Implement one runtime-validated write gateway.
4. Define and freeze a stable action taxonomy.
5. Enforce one terminal sync event per attempt.
6. Implement cursor-based list API with rich filters.
7. Add realtime invalidation channel with tenant isolation.
8. Build dense table + detail drawer + staged head updates.
9. Add tests for enums, payload builders, and filter/search semantics.
