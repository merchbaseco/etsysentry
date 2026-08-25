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
10. In frontend React code, all API access must go through custom hooks (`use*`) built with
    `useQuery`, `useMutation`, or `useInfiniteQuery`; use `refetch`/invalidation for refresh
    flows instead of direct client calls.
11. Each frontend hook must live in its own file under `apps/website/src/hooks` using
    `use-*.ts` naming (for example `use-tracked-shops.ts` exports `useTrackedShops`).
12. Keep business logic and data reconciliation on the server; frontend components should render
    server-shaped view models rather than joining or reconciling domain datasets client-side.

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
4. Update `.env.schema` when environment variables change; it is the committed contract and
   `bun run check:fast` fails when it drifts from the server surface, Compose, or the Dockerfile.
5. Prefer adding Etsy bridges/services over embedding Etsy HTTP calls in routers/jobs.
6. If requirements are unclear, add an explicit note in `docs/requirements.md` and ask.

## Knowledge Index

- Product requirements: `docs/requirements.md`
- Product refresh strategy: `docs/refresh-strategy.md`
- System architecture: `docs/architecture.md`
- API surface and contract details: `docs/api-spec.md`
- Realtime architecture and message contracts: `docs/realtime.md`
- CLI behavior and contract: `docs/cli-spec.md`
- HTTP client package/release contract: `docs/http-client-spec.md`
- Release and npm publish runbook: `docs/release-runbook.md`
- Etsy bridge implementation and runbook: `docs/etsy-openapi-bridges.md`
- Logging strategy: `docs/logging-strategy.md`
- Event log actions: `docs/event-log-actions.md`
- Log UX spec: `docs/log-view.md`
- Known product/implementation gaps: `docs/known-gaps.md`
- Database query runbook: `docs/database-queries.md`
- Synthetic development data and its local-only guard: `docs/dev-data-seed.md`
- Docs vs AGENTS placement guide: `docs/agent-doc-placement.md`
- Deployment and the environment contract: `docs/deployment.md` (deploys are manual —
  `workflow_dispatch` only; pushing to `main` does not deploy)
- Server operations: `apps/server/README.md`
- Typed client package: `packages/http-client/README.md`

## Cursor Cloud Specific Instructions

The Cloud Agent environment is repo-managed via `.cursor/environment.json`: `install.sh` installs
Bun 1.3.5, PostgreSQL, and workspace dependencies; `start.sh` provisions the local database, seeds
it with synthetic development data, and launches the server (`:8080`) and website (`:3100`) under
`varlock run`.

- There is no `.env` step anywhere. `.env.schema` is the contract and values resolve from 1Password
  through the fleet-wide Development identity Cursor injects as a Runtime Secret.
- `bun install --frozen-lockfile` needs `MERCHBASE_GITHUB_NPM_TOKEN` to fetch the private
  `@merchbaseco/access` package. It is an `@internal` schema item, so `varlock run` does not export
  it; `install.sh` fetches it explicitly with `varlock printenv` under
  `ETSYSENTRY_RESOLVE_INSTALL_TOKENS=true`. Without it the install fails with a `401`/`403` from
  `npm.pkg.github.com`.
- The schema's development arm points `ETSYSENTRY_DATABASE_HOST` at the Mac mini over Tailscale,
  which is how local development reaches the live database. A cloud VM has no Tailscale, so
  `start.sh` runs its own PostgreSQL on `5435` and overrides that one public value for the session.
  The password still resolves from the Development vault, so the local cluster and the server agree.
- Do not run the root `bun run dev` expecting the Tailscale database in the cloud VM; use the
  `start.sh` path.
- Cloud sessions boot on synthetic data: `start.sh` runs `bun run db:seed:dev` against the local
  cluster on every boot, which also applies pending migrations. The seed refuses any non-loopback
  database host and `NODE_ENV=production`, with no override, so it can never reach the live
  database — including from a developer machine, where local runs stay explicit-only. See
  `docs/dev-data-seed.md`.
