# AGENTS.md

This document guides AI coding assistants working in the EtsySentry repository.

## Overview

- **Repo layout**: Monorepo. The server lives in `apps/server`.
- **Purpose**: Etsy listing intelligence platform for tracking keyword/search, listing, and shop performance over time.
- **Primary primitives**:
  - `keyword` - Etsy search keyword that is monitored daily.
  - `listing` - Etsy listing that is tracked daily.
  - `shop` - Etsy shop that is monitored daily for listing changes.
- **Core behavior**:
  - Keyword monitors fetch Etsy search results daily for pages 1-3.
  - Listing monitors store daily snapshots (sales, reviews, pricing, visibility signals).
  - Shop monitors discover/refresh listings and feed them into listing tracking.
- **Integration model**: Etsy API v3 only, wrapped via bridge files (one Etsy endpoint per bridge file).

## Documentation Map

- Product requirements: `docs/requirements.md`
- System architecture: `docs/architecture.md`
- Etsy OpenAPI bridge guide: `docs/etsy-openapi-bridges.md`
- Rich log UX spec: `docs/log-view.md`
- Database query runbook: `docs/database-queries.md`
- Server operations: `apps/server/README.md`
- Typed client: `packages/http-client/README.md`

## Website Architecture Decision

- The website stack is **Vite + React + React Router** (not Next.js).
- Frontend source-of-truth lives under `apps/website/src`.
- Dashboard routes are path-based (`/`, `/keywords`, `/shops`, `/logs`) via React Router.
- Do not add or reintroduce Next.js runtime/config files (`next.config.*`, `next-env.d.ts`, App Router dirs).

## API Design Principles

- All first-party APIs should be tRPC (no REST surface unless explicitly required).
- Public surface:
  - `api.public.*` - agent/CLI-safe endpoints.
- App surface:
  - `api.app.*` - authenticated dashboard/admin endpoints.
- `api.app.*` identity/tenant scope must come from server auth context:
  - validate Clerk bearer token in server context
  - derive `tenantId` + `clerkUserId` server-side
  - do not accept auth identity fields from client procedure input
- CLI should map to `api.public.*` so there is a single canonical public contract.
- Shared business logic belongs in utilities/services, not duplicated across routers.
- Each tRPC procedure should live in its own file under `apps/server/src/api/public` or `apps/server/src/api/app`.

## Auth and OAuth Storage Rules

- Website app requests to `api.app.*` must send Clerk bearer auth in `Authorization: Bearer <token>`.
- Etsy OAuth tokens/connections are server-managed persistence, not browser-managed state.
- Do not store Etsy OAuth session identifiers/tokens in `localStorage`, `sessionStorage`, or client cookies.
- Etsy OAuth connection identity is keyed by `(tenantId, clerkUserId)` and persisted in DB.
- If auth/session architecture needs to change, ask for clarification before broad refactors.

## Etsy Bridge Pattern (Required)

- Store Etsy API wrappers under `apps/server/src/services/etsy/bridges`.
- OpenAPI source-of-truth for Etsy endpoints:
  - `https://www.etsy.com/openapi/generated/oas/3.0.0.json`
- Each Etsy API endpoint gets exactly one bridge file that:
  - Calls one Etsy endpoint.
  - Defines request/response types for that endpoint.
  - Performs thin transport mapping only (no business logic).
- Example structure:
  - `apps/server/src/services/etsy/bridges/get-shop.ts`
  - `apps/server/src/services/etsy/bridges/get-shop-listings.ts`
  - `apps/server/src/services/etsy/bridges/search-listings.ts`
  - `apps/server/src/services/etsy/bridges/get-listing.ts`
- Orchestration, retries, batching, and persistence belong in higher-level services/jobs.

## Etsy Bridge Runbook

Use this checklist whenever adding or updating an Etsy bridge:

1. Open Etsy OpenAPI spec (`3.0.0.json`) and locate the `operationId`.
2. Create/update exactly one bridge file for that operation in `apps/server/src/services/etsy/bridges`.
3. Copy path/query parameter names exactly as defined in OpenAPI.
4. Add explicit input validation for bridge inputs.
5. Add response parsing for the operation schema and normalize output fields for service use.
6. Add bridge-scoped error handling that preserves HTTP status and raw body.
7. Add/update focused bridge tests:
   - success mapping
   - query param serialization (if applicable)
   - non-2xx behavior
   - invalid input handling
8. Keep business logic out of bridges:
   - no DB reads/writes
   - no orchestration/retries/scheduling
9. Update docs when bridge surface changes:
   - `docs/etsy-openapi-bridges.md`
   - `apps/server/README.md` (if operational behavior changed)

## Monitoring and Data Expectations

- Daily monitoring is the baseline cadence for all primitives.
- Preserve raw snapshots and derived metrics separately when practical.
- Track ranking positions by keyword + page + position + listing.
- Track listing timeseries records as append-only daily snapshots.
- Track shop discovery state so listing additions/removals are auditable.
- Avoid destructive historical rewrites.

## Code Style and Quality Standards

1. Keep TypeScript strictness enabled.
2. Biome formatting and linting standards:
   - 4-space indentation
   - single quotes
   - semicolons
   - 100-character line width
3. Build types first: function signatures and data models before implementation details.
4. Make illegal states unrepresentable (discriminated unions, branded types, `const` assertions).
5. Keep modules focused and small; split files when responsibilities diverge.
6. Prefer immutable patterns and explicit runtime validation at boundaries.
7. Handle edge cases and external API failures explicitly; do not swallow errors.
8. Add or update focused tests when behavior changes.

## Database and Migration Expectations

- Use Drizzle ORM for schema and queries.
- Never hand-write migration SQL.
- Update schema source first, then generate migrations with tooling.
- Keep `init.sql` or equivalent bootstrap SQL in sync with schema evolution.

## Editing Expectations

1. Keep docs current when API shape, jobs, or storage models change.
2. Preserve startup status logging in the server entrypoint as features/jobs are added.
3. Keep secrets out of version control; update `.env.example` when env vars change.
4. Prefer adding bridges/services over embedding Etsy HTTP calls directly in routers/jobs.
5. Ask for clarification before changing auth model, billing model, or production deployment behavior.
6. Prefer the simplest change that solves the reported issue end-to-end.
7. Do not add new abstractions, parameters, or extension points unless at least two current call
   sites need them right now.
8. For bug fixes, first patch the narrow failing path; generalize only when a concrete follow-up
   requirement exists.

If requirements are ambiguous, prefer adding an explicit note in `docs/requirements.md` and ask.
