# Deployment and the Environment Contract

Production is served at `https://etsysentry.merchbase.co`. Caddy serves the website bundle and
proxies `/api`, `/auth`, `/healthz`, and `/ws` to the Fastify server. The whole stack runs as Docker
Compose on the Mac mini.

## Topology

| Compose service | Container | Internal or host port |
| --- | --- | --- |
| `server` | `etsysentry-server` | Fastify `8080` inside the network |
| `website` | `etsysentry-website` | Vite preview `3000` inside the network |
| `caddy` | `etsysentry-caddy` | Host `127.0.0.1:8093` to container `80` |
| `postgres` | `etsysentry-postgres` | Host `127.0.0.1:5435` to container `5432` |

## Deploying

Deploys are **manual**. Pushing to `main` no longer deploys anything — the workflow is
`workflow_dispatch` only, and the former push trigger (and the `zknicker/etsy-sentry-start` branch
trigger) are gone. A deploy is an explicit act now that it resolves production credentials from
1Password. Run `Deploy Stack` from the Actions tab: it runs on the Mac mini's self-hosted runner,
synchronizes the long-lived deployment checkout at `/Users/zknicker/srv/etsysentry` to the
dispatched commit, and calls `bun run deploy`.

### Source to runtime

| Stage | Owner |
| --- | --- |
| Declaration | `.env.schema` — canonical names, types, sensitivity, per-lifecycle `op()` references |
| Secret store | 1Password `Production` vault (`Development` for local, `Tooling` for publishing) |
| Resolution | `scripts/deploy-with-varlock.ts`, pinned to `VARLOCK_ENV=production` |
| Delivery | `varlock run -- docker compose …`; Compose interpolates `${VAR}` from process environment |
| Runtime | The environment Docker bakes into each container at `up` time |

No `.env` file is read or written anywhere on this path. `--env-file` is deliberately absent, and
`compose.yml` declares no `${VAR:-default}` fallbacks — the schema is the only owner of defaults.

Two identities fill the same role slot, `DEPLOY_AGENT_PRODUCTION_OP_TOKEN`:

| Venue | Identity | How it arrives |
| --- | --- | --- |
| `Deploy Stack` workflow (preferred) | GitHub deploy agent | Repository secret `GH_DEPLOY_AGENT_PRODUCTION_OP_TOKEN` |
| Operator at the mini | Mac Mini production Varlock | `scripts/deploy-with-varlock.ts` re-execs under `op run` |

The GitHub deploy agent reads both lifecycle vaults, so the workflow maps that one secret into both
schema slots: the production slot for runtime values, and the development slot so the install token
resolves through the schema too. No credential is injected under a canonical name, and
`github.token` is not part of the environment contract.

The private `@merchbaseco/*` install token reaches the image build as a BuildKit secret mount —
never a build argument, image environment variable, or layer. It always comes from
`varlock printenv MERCHBASE_GITHUB_NPM_TOKEN` under the install switch, which resolves the shared
`GitHub Packages Read - Merchbase` item from the `Development` vault.

`NODE_ENV` is set by the runtime image, not by the schema: `VARLOCK_ENV` is a varlock builtin and is
never delivered to a container, so in-container lifecycle branching uses `NODE_ENV`.

### Commands

```bash
bun run deploy:dry-run   # resolve every op() ref and render Compose; touches nothing
bun run deploy           # build images, replace containers, verify the delivered names
bun run deploy:verify    # name-diff the delivered container env against the schema
```

`deploy:dry-run` is the first rung of the ladder: a missing 1Password item fails there, before
anything is built or replaced.

### Restart behavior

Compose restart policies reuse the environment Docker baked into the container spec at the last
`up`. Restarting a container — or rebooting the mini — does **not** re-resolve from 1Password; it
replays the values captured by the most recent deploy. Rotating a credential therefore requires a
redeploy, not just a restart.

## Where each value lives

| 1Password item | Vault(s) | Canonical names |
| --- | --- | --- |
| `Clerk - Merchbase` (shared) | `Development`, `Production` | `MERCHBASE_CLERK_SECRET_KEY`, `MERCHBASE_CLERK_JWT_KEY`, `MERCHBASE_CLERK_PUBLISHABLE_KEY` |
| `Etsy API - EtsySentry` | `Development`, `Production` | `ETSYSENTRY_ETSY_API_KEY`, `ETSYSENTRY_ETSY_API_SHARED_SECRET` |
| `Clerk Webhook - EtsySentry` | `Production` | `ETSYSENTRY_CLERK_WEBHOOK_SIGNING_SECRET` |
| `Admin User - EtsySentry` | `Production` | `ETSYSENTRY_ADMIN_MERCHBASE_USER_ID` |
| `Postgres - EtsySentry` | `Development`, `Production` | `ETSYSENTRY_DATABASE_PASSWORD` |
| `GitHub Packages Read - Merchbase` (shared) | `Development` | `MERCHBASE_GITHUB_NPM_TOKEN` |
| `NPM Publish - Merchbase` (shared) | `Tooling` | `MERCHBASE_NPM_PUBLISH_TOKEN` |

`Etsy API - EtsySentry` and `Postgres - EtsySentry` hold the same credential in both lifecycle
vaults: EtsySentry runs one Etsy application and one database, and local development connects to
that same database over Tailscale. Each note cross-references the other; rotate both together.

Everything else in `.env.schema` is a public literal owned by the schema — ports, origins, the OAuth
redirect and scopes, and the Etsy rate-limit tuning.

## Published-package contracts

`MERCHBASE_API_KEY`, `ES_BASE_URL`, and `ES_STORAGE_DIR` are read by `@etsysentry/cli` on end users'
machines. They are an external contract, not part of this repo's environment: they are deliberately
absent from `.env.schema` and must never be renamed.

## Continuous integration

Both workflows install the private `@merchbaseco/access` package, and **`github.token` cannot fetch
it**: a GitHub Packages package grants no other repository access by default, so Actions' own token
gets a 403. It is not used for installs anywhere in this repo.

Instead the install credential resolves through the schema like every other value. Each workflow
maps the `GH_DEPLOY_AGENT_PRODUCTION_OP_TOKEN` secret into the schema's *development* slot — the
deploy agent reads both lifecycle vaults, and install tokens live in `Development` — then fetches
`MERCHBASE_GITHUB_NPM_TOKEN` with `varlock printenv` under `ETSYSENTRY_RESOLVE_INSTALL_TOKENS`. No
credential is injected under a canonical name, and the quality gates themselves reach no vault:
`check` pins the schema's `test` lifecycle, which resolves entirely offline.

Know this failure mode: **`bun install` prints its banner and then hangs silently and indefinitely**
when it cannot authenticate to the private scope — it does not fail fast. Quality's install step is
therefore capped with `timeout-minutes`, so a credential problem surfaces as a timeout with a
message rather than as fifteen silent minutes.

## Guards

`bun run check` runs `env:check` (the schema resolves offline in the `test` lifecycle) and
`env:contract` (a name-only diff across `.env.schema`, the typed server surface, the Compose
delivery, and the Dockerfile `ARG` list). `scripts/verify-deployed-secrets.ts` runs after every real
deploy and fails when a delivered name is not a schema item or a production-required sensitive item
never reached the container.
