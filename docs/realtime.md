# Realtime Architecture

## Purpose

EtsySentry uses WebSocket messages to reduce dashboard staleness and avoid unnecessary
HTTP refetches during high-frequency sync transitions.

The realtime subsystem supports:

- targeted cache patching for small payloads (`sync-state.push`, `dashboard-summary.push`)
- query invalidation for larger or variable payload changes (`query.invalidate`)
- tenant-safe routing by `accountId` on the server

## Connection Lifecycle

1. The website creates a WebSocket URL at `/ws?token=<clerk_jwt>`.
2. Server upgrade handling validates:
   - path is `/ws`
   - request origin matches `APP_ORIGIN` (when present)
   - token can be verified by Clerk
3. The server resolves `accountId` from Clerk identity and stores connection identity:
   - `accountId`
   - `clerkUserId` (for future per-user routing)
4. Realtime messages are emitted through the in-process event bus.
5. The runtime fan-outs only to connections whose `accountId` matches event `accountId`.
6. Client reconnect behavior uses exponential backoff up to 10 seconds.

## Message Types

Wire payloads do not include `accountId`. The server strips it before sending.

### `query.invalidate`

Use when a list/detail shape may have changed and client should refetch.

```json
{
  "type": "query.invalidate",
  "queries": ["app.listings.list", "app.logs.list"]
}
```

### `sync-state.push`

Use for frequent sync state transitions where only `syncState` is changing.

```json
{
  "type": "sync-state.push",
  "entity": "listing",
  "ids": {
    "listing_123": "syncing",
    "listing_456": "queued"
  }
}
```

### `dashboard-summary.push`

Use for lightweight dashboard job counter updates.

```json
{
  "type": "dashboard-summary.push",
  "jobCounts": {
    "inFlightJobs": 3,
    "queuedJobs": 9
  }
}
```

## Push vs Invalidate Policy

Use **data push** when:

- payload is small
- updates are frequent
- cache patching is deterministic and idempotent

Use **query invalidation** when:

- data shape is broad or expensive to model as a patch
- change impact crosses multiple fields/resources
- the client should run existing fetch + merge behavior

Current guidance:

- sync state transitions: `sync-state.push`
- dashboard job counters: `dashboard-summary.push`
- listings/keywords/shops/logs structural changes: `query.invalidate`

## Server Modules

- `emit-event.ts`: in-process event bus (`sendRealtimeEvent`, `onRealtimeEvent`)
- `realtime-event-types.ts`: Zod schemas + discriminated union for event contracts
- `serialize-realtime-event.ts`: strips `accountId` and serializes for wire
- `start-websocket-runtime.ts`: auth, connection identity, account-scoped fan-out

## Client Modules

- `realtime-message-types.ts`: wire message schemas + `parseRealtimeMessage()`
- `use-realtime-query-invalidations.ts`: socket lifecycle + dispatcher switch
- `handle-query-invalidation.ts`: queued invalidation/refetch handler
- `handle-sync-state-push.ts`: in-place cache patch for list sync states
- `handle-dashboard-summary-push.ts`: in-place cache patch for job counts

## Adding New Event Types

1. Add server schema/type in `realtime-event-types.ts`.
2. Extend `serialize-realtime-event.ts` to strip `accountId`.
3. Emit new event via `sendRealtimeEvent(...)`.
4. Add client message schema in `realtime-message-types.ts`.
5. Add client handler and wire it in dispatcher switch.
6. Prefer push over invalidation only when patch semantics are safe.
7. Add focused tests for event validation/serialization/handler behavior.
