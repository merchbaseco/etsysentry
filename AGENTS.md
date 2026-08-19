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
4. Update `.env.example` when environment variables change.
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
- Docs vs AGENTS placement guide: `docs/agent-doc-placement.md`
- Server operations: `apps/server/README.md`
- Typed client package: `packages/http-client/README.md`

## Cursor Cloud specific instructions

The Cloud Agent environment is repo-managed via `.cursor/environment.json` (`install.sh`
installs Bun 1.3.5 + PostgreSQL 16 + JS deps; `start.sh` starts Postgres). Two terminals run the
stack: `server` (Fastify/tRPC on `:8080`, runs Drizzle migrations on boot) and `website`
(Vite on `:3100`, proxying `/api` → `:8080`).

- `bun install --frozen-lockfile` needs the `MERCHBASE_GITHUB_NPM_TOKEN` secret (a token with
  `read:packages` on the `merchbaseco` org) to fetch the private `@merchbaseco/access` package;
  without it the install fails with a `401`/`403` from `npm.pkg.github.com`.
- Do not run the root `bun run dev` in the cloud VM: it pins `DATABASE_HOST` to a Tailscale host
  (`zachs-mac-mini.taila0b849.ts.net`) that is unreachable here. Run the server against the local
  DB instead, as the `server` terminal does:
  `DATABASE_HOST=127.0.0.1 DATABASE_PORT=5435 DATABASE_PASSWORD=etsysentry_local_dev_password`.
  These inline vars are required because Bun's `--env-file` is overridden by process env, and
  committed `.env`/`.env.example` ship `DATABASE_PASSWORD=replace_me`, which does not match the
  local cluster password.
- Local Postgres lives at `~/etsysentry-pgdata` (port `5435`, socket dir `~/pgsock`, log
  `~/etsysentry-pg.log`); database `etsysentry`, user/password `etsysentry` /
  `etsysentry_local_dev_password`.
- The server boots on `.env.example` placeholders (copied to `.env` by `install.sh`). Real
  Clerk/Etsy values injected as environment secrets override `.env` and are required for auth and
  live Etsy calls. The website renders a "misconfigured" screen until `VITE_CLERK_PUBLISHABLE_KEY`
  is set.
