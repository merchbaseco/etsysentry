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
  - `listing_metric_snapshots` rows (`observedAt`, `favorerCount`, `quantity`, `views`)
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
