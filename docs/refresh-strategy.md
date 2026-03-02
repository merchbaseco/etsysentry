# Product Refresh Strategy

This document is the canonical product-level refresh strategy for:

- listings
- keywords
- shops

It describes how often each primitive refreshes, what signals drive cadence, and what is
persisted.

## Global Scheduling Model

- Stale-dispatch jobs run every minute via cron:
  - `sync-stale-listings`
  - `sync-stale-keywords`
  - `sync-stale-shops`
- Each stale-dispatch job finds due primitives and enqueues the corresponding worker job.
- Batch size is currently `100` per stale-dispatch run for each primitive type.

## Queue State Management (Canonical)

This section is the source of truth for queue/sync state lifecycle across listings, keywords, and
shops.

### Sync State Contract

Tracked primitives persist `syncState` as:

- `idle`: no work is currently queued or running
- `queued`: work has been accepted and is waiting to run
- `syncing`: work is actively running in a worker or inline refresh path

### Queue-Backed Lifecycle

For queue-backed flows (stale-dispatch, discovery enqueue, track/refresh enqueue):

1. Claim work by transitioning `idle -> queued`.
2. Worker start transitions `queued -> syncing`.
3. Worker finish transitions `syncing -> idle` on both success and failure.

If enqueue fails after a claim, the claim is rolled back to `idle`.

### Inline Refresh Lifecycle

Some endpoints run sync immediately instead of queueing. Current listing row refresh is inline:

1. Transition `idle -> syncing`.
2. Run refresh work inline.
3. Transition `syncing -> idle`.

### Startup Reconciliation Rules

During startup reconciliation, rows currently in `queued|syncing` are checked for a live job
(`created|retry|active`) in pg-boss:

- live job exists:
  - keep `queued` rows as `queued`
  - normalize `syncing` rows to `queued`
- no live job exists: reset row to `idle`

This keeps UI behavior honest after restarts: work that is still pending is visibly `queued`, and
sync actions remain disabled while pending.

### Implementation Map

- startup reconciliation:
  - `apps/server/src/jobs/startup-reconciliation*.ts`
- primitive reconciliation tasks:
  - `apps/server/src/services/listings/reconcile-tracked-listing-sync-state.ts`
  - `apps/server/src/services/keywords/reconcile-tracked-keyword-sync-state.ts`
  - `apps/server/src/services/shops/reconcile-tracked-shop-sync-state.ts`
- stale dispatch:
  - `apps/server/src/services/listings/sync-stale-listings.ts`
  - `apps/server/src/services/keywords/sync-stale-keywords.ts`
  - `apps/server/src/services/shops/sync-stale-shops.ts`

## Listings Refresh Strategy

### Cadence Tiers

- `1d` (highest tier): refresh every 24 hours
- `3d`: refresh every 72 hours
- `7d`: refresh every 168 hours

### Momentum Signals

Signals are calculated from listing metric snapshots:

- `favorersDelta = latest.favorerCount - previous.favorerCount`
- `quantityDrop = previous.quantity - latest.quantity`
- `viewsDelta = latest.views - previous.views`

Current promotion signal rules:

- if `favorersDelta >= 1`, treat as momentum signal
- if `quantityDrop >= 1`, treat as momentum signal
- `viewsDelta` is captured but not used for tier promotion/demotion

### Tier Assignment

- If fewer than 2 snapshots are available: default to `1d`
- If a momentum signal happened within the last 5 days: `1d`
- If no momentum signal for at least 5 days but less than 14 days: `3d`
- If no momentum signal for at least 14 days: `7d`
- If no signal is found in available history:
  - if history coverage is at least 14 days: `7d`
  - else if history coverage is at least 5 days: `3d`
  - else: `1d`

### Listing Eligibility for Auto Refresh

Listings are considered by stale-dispatch only when:

- `syncState = 'idle'`
- tracking state is not `fatal`
- and either:
  - listing is digital, or
  - listing tracking state is not `paused`

### Persistence

- Tier value itself is not persisted as a dedicated column.
- Inputs used for tiering are persisted:
  - `tracked_listings.lastRefreshedAt`
  - `listing_metric_snapshots` rows (`observedAt`, `favorerCount`, `quantity`, `endingTimestamp`, `views`)
- Tier is recalculated on demand during stale selection and settings summary generation.

## Keywords Refresh Strategy

### Cadence

- Fixed daily cadence (`24h`).

### Mechanism

- After each keyword sync attempt (success or failure), `nextSyncAt` is set to `now + 24h`.
- Stale-dispatch selects keywords where:
  - `trackingState != 'paused'`
  - `syncState = 'idle'`
  - `nextSyncAt <= now`

### Persistence

- `tracked_keywords.nextSyncAt` is persisted and is the scheduling source of truth.

## Shops Refresh Strategy

### Cadence

- Fixed daily cadence (`24h`).

### Mechanism

- During shop sync, `nextSyncAt` is set to `now + 24h` on both success and failure paths.
- Stale-dispatch selects shops where:
  - `trackingState != 'paused'`
  - `syncState = 'idle'`
  - `nextSyncAt <= now`

### Persistence

- `tracked_shops.nextSyncAt` is persisted and is the scheduling source of truth.

## Where Implemented

- Listing cadence rules:
  - `apps/server/src/services/listings/listing-refresh-cadence.ts`
- Listing stale selection:
  - `apps/server/src/services/listings/find-stale-listings.ts`
- Listing refresh policy summary used by settings:
  - `apps/server/src/services/listings/get-listing-refresh-policy.ts`
- Keyword next sync calculation:
  - `apps/server/src/services/keywords/keyword-rankings-service.ts`
- Shop next sync calculation:
  - `apps/server/src/services/shops/sync-tracked-shop.ts`
