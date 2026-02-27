# EtsySentry CLI Spec (Draft v0.2)

## Scope

This spec defines the CLI contract to build now for EtsySentry.

Canonical release process: `docs/release-runbook.md`.

Goals:
- match implemented EtsySentry behavior as of February 24, 2026
- keep CLI and public API aligned (`api.public.*`)
- prioritize commands that map to existing tracking/sync/rank/history capabilities

Covered primitives:
- `keyword`
- `listing` (user-facing alias: `product`)
- `shop`

Covered operations:
- local config for API key auth and base URL
- local default time-range config
- track/list for all primitives
- listing performance retrieval

## Current Backend Alignment

Current server status:
- `api.public.*` now implements CLI v0.2 primitives:
  - `public.keywords.list`
  - `public.keywords.track`
  - `public.listings.list`
  - `public.listings.track`
  - `public.listings.getPerformance`
  - `public.shops.list`
  - `public.shops.track`
- dashboard website remains on `api.app.*` (Clerk auth)

Current CLI package status:
- implemented in `packages/cli`
- uses `packages/http-client` (`createEtsySentryClient`) with tRPC QueryClient + options proxy

This CLI spec is the canonical target for `api.public.*` implementation and should mirror the
current app capability set first, before adding broader v1 features.

## Principles

- Config-only state. No interactive prompts.
- Resource-first, verb-second command shape.
- JSON-first output, with command-scoped table rendering where explicitly supported.
- One CLI command maps to one API capability.
- CLI maps to `api.public.*` only (not `api.app.*`).
- Prefer explicit tracked IDs for deterministic retrieval commands.
- Commands that support one-or-many targets must use one command shape.
- Do not create parallel `*-many` commands; accept a single id or multiple ids in one command.
- CLI must use the tRPC React Query client pattern (same stack as dashboard).

## Authentication and Preconditions

- All non-config commands require an API key.
- CLI authenticates against `api.public.*` using API key auth:
  - primary header: `x-api-key: <esk_...>`
  - optional equivalent: `authorization: Bearer <esk_...>`

API key lookup precedence:
- `--api-key` flag
- `ETSYSENTRY_API_KEY` env var
- `~/.etsysentry/config.json` (`apiKey`)

Base URL precedence:
- `--base-url` flag
- `ETSYSENTRY_API_BASE_URL` env var
- `~/.etsysentry/config.json` (`baseUrl`, default `https://etsysentry.merchbase.co`)

Etsy precondition:
- Etsy-backed commands require the API key tenant to have an active Etsy OAuth connection.
- If Etsy is not connected, command fails with a precondition error.

## Binary and Output

- Binary: `es`
- Default output is JSON success/error envelopes.
- `es listings performance` additionally supports `--mode table` for human-readable terminal output.
- Graph-ready output is provided by `es listings performance --mode metrics`.

Success envelope:

```json
{"ok": true, "data": {}}
```

Error envelope:

```json
{
  "ok": false,
  "error": {
    "code": "MISSING_CONFIG",
    "message": "config.apiKey is required",
    "details": {}
  }
}
```

## Config

Config file:
- `~/.etsysentry/config.json`

Commands:
- `es config show`
- `es config clear`
- `es config set api-key <value>`
- `es config set base-url <value>`
- `es config set range <7d|30d|90d|YYYY-MM-DD..YYYY-MM-DD>`

## Shared Concepts

Tracking states:
- `active`
- `paused`
- `error`

Sync states:
- `idle`
- `queued`
- `syncing`

Listing Etsy states:
- `active`
- `inactive`
- `sold_out`
- `draft`
- `expired`

Identifier semantics:
- `trackedKeywordId`: UUID
- `trackedListingId`: UUID
- `trackedShopId`: UUID
- `etsyListingId`: numeric string
- `etsyShopId`: numeric string

Time-range syntax:
- relative: `7d`, `30d`, `90d`
- absolute: `YYYY-MM-DD..YYYY-MM-DD` (UTC day boundaries)

Range precedence (for commands that support `--range`):
- `--range` flag
- `ETSYSENTRY_DEFAULT_RANGE` env var
- `~/.etsysentry/config.json` (`range`)
- default: `30d`

Target cardinality convention:
- Commands that can operate on multiple targets must still use one command name.
- Accept either one target or many targets in a single argument shape.
- Preferred many-target shape is comma-separated ids (for example `--ids id1,id2,id3`).

Digital listings:
- listing rows include `isDigital`
- CLI listing commands should support an opt-in `--show-digital` view toggle
- default list view hides digital listings for parity with dashboard behavior

## Commands

### Track Commands

Canonical:
- `es keywords track <keyword>`
- `es listings track <listing_id|listing_url>`
- `es shops track <shop_id|shop_url|shop_name>`

Convenience aliases:
- `es track keyword <keyword>` -> `es keywords track <keyword>`
- `es track listing <listing_id|listing_url>` -> `es listings track <listing_id|listing_url>`
- `es track product <listing_id|listing_url>` -> `es listings track <listing_id|listing_url>`
- `es track shop <shop_id|shop_url|shop_name>` -> `es shops track <shop_id|shop_url|shop_name>`

### Keywords

- `es keywords list [--search <text>] [--tracking-state <active|paused|error>]`
  `[--sync-state <idle|queued|syncing>]`
- `es keywords track <keyword>`

Notes:
- `keywords list` filters are client-side in CLI for initial build.

### Listings (Products)

- `es listings list [--search <text>] [--tracking-state <active|paused|error>]`
  `[--sync-state <idle|queued|syncing>] [--show-digital]`
- `es listings track <listing_id|listing_url>`
- `es listings performance <tracked_listing_id> [--range <7d|30d|90d|YYYY-MM-DD..YYYY-MM-DD>]`
  `[--metrics <views,favorites,quantity,price>] [--mode <table|metrics>]`

Alias group:
- `es products ...` maps 1:1 to `es listings ...`

Notes:
- listing responses include `priceUsdValue` when USD conversion rates are available.

Performance command behavior:
- `--mode table` prints a compact table for terminal inspection.
- `--mode metrics` returns graph-ready metric series JSON.
- default mode is `metrics`.
- `--range` uses the shared range precedence and resolves to a bounded window for output.

Graph-ready performance shape (`--mode metrics`):

```json
{
  "ok": true,
  "data": {
    "listing": {
      "id": "tracked_listing_uuid",
      "etsyListingId": "1234567890",
      "title": "Example listing"
    },
    "range": {
      "label": "30d",
      "from": "2026-01-29",
      "to": "2026-02-27"
    },
    "views": {
      "latest": 1542,
      "points": [{ "ts": "2026-02-27", "value": 1542 }]
    },
    "favorites": {
      "latest": 219,
      "points": [{ "ts": "2026-02-27", "value": 219 }]
    },
    "quantity": {
      "latest": 8,
      "points": [{ "ts": "2026-02-27", "value": 8 }]
    },
    "price": {
      "latest": {
        "value": 24.99,
        "currencyCode": "USD"
      },
      "points": [{ "ts": "2026-02-27", "value": 24.99, "currencyCode": "USD" }]
    }
  }
}
```

### Shops

- `es shops list [--search <text>] [--tracking-state <active|paused|error>]`
  `[--sync-state <idle|queued|syncing>]`
- `es shops track <shop_id|shop_url|shop_name>`

Notes:
- shop list items include `latestSnapshot` fields:
  - `activeListingCount`, `newListingCount`
  - `favoritesTotal`, `favoritesDelta`
  - `soldTotal`, `soldDelta`
  - `reviewTotal`, `reviewDelta`

## Public Procedure Mapping

Canonical slash-style public procedures for CLI:
- `es keywords list` -> `keywords/list`
- `es keywords track` -> `keywords/track`
- `es listings list` -> `listings/list`
- `es listings track` -> `listings/track`
- `es listings performance` -> `listings/get-performance` (with CLI shaping)
- `es shops list` -> `shops/list`
- `es shops track` -> `shops/track`

Transport behavior remains tRPC-native:
- query procedures use `GET` with URL-encoded `input`
- mutation procedures use `POST` with JSON body

## Client Implementation Requirement

- CLI must use a tRPC React Query client with TanStack Query `QueryClient` orchestration.
- CLI commands should call procedure wrappers via `queryClient.fetchQuery(...)` and
  `client.<path>.mutate(...)`, consistent with dashboard usage.
- Do not add direct `fetch('/api/...')` CLI call sites for public procedures.

## Error Behavior

CLI-normalized error codes:
- `MISSING_CONFIG`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `PRECONDITION_FAILED`
- `BAD_REQUEST`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

Notes:
- map tRPC `INTERNAL_SERVER_ERROR` to CLI `INTERNAL_ERROR`
- preserve server message text for actionable Etsy/auth/validation failures

## Help Snapshot

Expected top-level help shape:

```txt
es <command> [options]

Commands:
  config show
  config clear
  config set api-key <value>
  config set base-url <value>
  config set range <7d|30d|90d|YYYY-MM-DD..YYYY-MM-DD>

  keywords list [--search <text>] [--tracking-state <state>] [--sync-state <state>]
  keywords track <keyword>

  listings list [--search <text>] [--tracking-state <state>] [--sync-state <state>] [--show-digital]
  listings track <listing_id|listing_url>
  listings performance <tracked_listing_id> [--range <7d|30d|90d|YYYY-MM-DD..YYYY-MM-DD>]
    [--metrics <views,favorites,quantity,price>] [--mode <table|metrics>]

  shops list [--search <text>] [--tracking-state <state>] [--sync-state <state>]
  shops track <shop_id|shop_url|shop_name>

Aliases:
  track keyword -> keywords track
  track listing -> listings track
  track product -> listings track
  track shop -> shops track
  products ... -> listings ...
```

## Command Examples

```bash
es config set api-key esk_live_xxx
es config set base-url https://etsysentry.merchbase.co
es config set range 30d

es track keyword "mid century wall art"
es track product https://www.etsy.com/listing/1234567890/example
es track shop la-paz-studio

es keywords list --sync-state queued

es listings list --search "gallery wall" --show-digital
es listings performance 0fdd5a64-24f5-4e75-9326-63c201f7f489 --range 30d --mode table
es listings performance 0fdd5a64-24f5-4e75-9326-63c201f7f489 --range 2026-01-01..2026-02-01 --mode metrics

es shops list --tracking-state active
```

## Build + Publish

```bash
bun run cli:build
```

```bash
cd packages/cli
set -a
source ../../.env
set +a
npm whoami --userconfig ../../.npmrc
npm publish --access public --userconfig ../../.npmrc
```

## Release Checklist

1. Bump `packages/cli/package.json` `version` to match target `vX.Y.Z` in `CHANGELOG.md`.
2. Bump `@etsysentry/http-client` dependency in `packages/cli/package.json` to `^X.Y.Z`.
3. Run `bun install` from repo root so `bun.lock` stays in sync.
4. Run `bun run cli:build` from repo root.
5. Publish from `packages/cli` using the commands above.
6. Verify package access status:

```bash
cd packages/cli
set -a
source ../../.env
set +a
npm access get status @etsysentry/cli --userconfig ../../.npmrc
```

## Troubleshooting

- `401 Unauthorized` / token errors:
  Ensure repo-root `.env` is loaded before publish so `NPM_TOKEN` is available to `.npmrc`.
- `403 You cannot publish over the previously published versions`:
  Bump patch/minor version and publish again.

## Deferred (Post Initial CLI Build)

Not part of the first CLI implementation pass:
- keyword rank read commands (`keywords daily-ranks`, `listings keyword-ranks`)
- manual refresh commands
- `pause/resume/archive` primitive commands
- generic `metrics series` command family
- admin/log/currency/ops commands
- additional non-JSON output modes beyond `listings performance --mode table`
