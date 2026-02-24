# AGENTS.md

This file is the always-on guide for AI coding assistants in EtsySentry.

## Repository Snapshot

- Monorepo; server app is in `apps/server`.
- Product scope is Etsy listing intelligence across `keyword`, `listing`, and `shop` primitives.

## Always-On Coding Rules

1. Keep TypeScript strictness enabled.
2. Follow Biome style:
   - 4-space indentation
   - single quotes
   - semicolons
   - 100-character line width
3. Build types first (function signatures and data models) before implementation details.
4. Make illegal states unrepresentable (`const` assertions, discriminated unions, branded types).
5. Keep modules focused and composable; split files when responsibilities diverge.
6. Prefer immutable patterns and explicit runtime validation at boundaries.
7. Handle edge cases and external API failures explicitly; do not swallow errors.
8. Add or update focused tests when behavior changes.
9. Enforce a `300` LoC maximum per file (excluding generated files).

## Naming Rules

1. Use concise, explicit names without filler words.
2. Use verb-first names for jobs/services/utilities (for example `sync-keyword`).
3. Avoid ambiguous orchestration names like `dispatch` when intent can be explicit.
4. Align queue names, filenames, and exported symbols semantically.
5. Keep service/utility files single-purpose.
6. Keep route/procedure names verb-first (`track`, `sync`, `refresh`, `list`, `get-*`).

## Change Scope Rules

1. Prefer the simplest end-to-end change that resolves the reported issue.
2. For bug fixes, patch the narrow failing path first.
3. Generalize only when there is a concrete follow-up requirement.
4. Do not add abstractions, parameters, or extension points unless at least two current call
   sites need them now.
5. Treat this codebase as work in progress: prefer the right aspirational implementation over
   preserving legacy code paths or compatibility layers.

## Required Maintenance

1. Keep docs current when API shape, jobs, or storage models change.
2. Keep startup status logging intact in the server entrypoint when adding features/jobs.
3. Keep secrets out of version control.
4. Update `.env.example` when environment variables change.
5. Prefer adding Etsy bridges/services over embedding Etsy HTTP calls in routers/jobs.
6. If requirements are unclear, add an explicit note in `docs/requirements.md` and ask.

## Knowledge Index

- Product requirements: `docs/requirements.md`
- System architecture: `docs/architecture.md`
- API surface and contract details: `docs/api-spec.md`
- CLI behavior and contract: `docs/cli-spec.md`
- Etsy bridge implementation and runbook: `docs/etsy-openapi-bridges.md`
- Logging strategy: `docs/logging-strategy.md`
- Event log actions: `docs/event-log-actions.md`
- Log UX spec: `docs/log-view.md`
- Database query runbook: `docs/database-queries.md`
- Docs vs AGENTS placement guide: `docs/agent-doc-placement.md`
- Server operations: `apps/server/README.md`
- Typed client package: `packages/http-client/README.md`
