# Event Log Action Catalog

This document is the source-of-truth list for persisted `event_logs` actions.

Audit date: February 24, 2026.

## Purpose

- Document what the Logs tab currently shows.
- Keep action names stable and intentional.
- Make future logging gaps easy to spot during code review.

## Current Actions

### Keyword actions

- `keyword.tracked`
  - Trigger: a keyword is newly tracked.
  - Source: `apps/server/src/services/keywords/tracked-keywords-service.ts`
- `keyword.updated`
  - Trigger: an already-tracked keyword is updated via track flow.
  - Source: `apps/server/src/services/keywords/tracked-keywords-service.ts`
- `keyword.sync_queued`
  - Trigger: immediate sync job enqueue after keyword track call.
  - Source: `apps/server/src/api/app/keywords/track.ts`
- `keyword.synced`
  - Trigger: keyword sync completed and rank rows were captured.
  - Source: `apps/server/src/services/keywords/keyword-rankings-service.ts`
- `keyword.sync_failed`
  - Trigger: keyword sync failed.
  - Source: `apps/server/src/services/keywords/keyword-rankings-service.ts`

### Listing actions

- `listing.tracked`
  - Trigger: a listing is newly tracked.
  - Source: `apps/server/src/services/listings/tracked-listings-service.ts`
- `listing.updated`
  - Trigger: an already-tracked listing is updated via track flow.
  - Source: `apps/server/src/services/listings/tracked-listings-service.ts`
- `listing.discovered`
  - Trigger: keyword sync discovers a listing that is not already tracked.
  - Source: `apps/server/src/services/keywords/keyword-rankings-service.ts`
- `listing.bulk_sync_queued`
  - Trigger: bulk listing sync queue request from app/admin endpoints.
  - Source:
    - `apps/server/src/api/app/listings/refresh-many.ts`
    - `apps/server/src/api/app/admin/enqueue-sync-all-listings.ts`
- `listing.synced`
  - Trigger: listing sync succeeded in either manual refresh or background `sync-listing` job.
  - Source:
    - `apps/server/src/services/listings/tracked-listings-service.ts`
    - `apps/server/src/jobs/sync-listing.ts`
- `listing.sync_failed`
  - Trigger: listing sync failed in either manual refresh or background `sync-listing` job.
  - Source:
    - `apps/server/src/services/listings/tracked-listings-service.ts`
    - `apps/server/src/jobs/sync-listing.ts`

## Audit Notes (MB-61)

- Fixed missing listing sync event logs for the background `sync-listing` job path.
- No additional missing persisted event actions were found in currently implemented
  keyword/listing monitoring flows.
- Shop monitor actions are not listed yet because shop monitoring is not implemented in the current
  codebase.

## Update Checklist

When adding/changing event logging:

1. Update the `createEventLog`/`createEventLogs` call site.
2. Update this catalog with the new action and source file.
3. Update `docs/log-view.md` if UI filter semantics need to change.
4. Add or update focused tests for new action payload builders where practical.
