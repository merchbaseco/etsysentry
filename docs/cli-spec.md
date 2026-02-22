# EtsySentry CLI Spec (Draft v0.1)

## Scope

This spec defines the public CLI shape for EtsySentry v1.

Covered primitives:
- `keyword`
- `listing` (user-facing alias: `product`)
- `shop`

Covered operations:
- local config for API-key auth
- tracking primitives
- getting/listing tracked primitives
- series metrics for all three primitives

## Principles

- Config-only state. No interactive prompts.
- Resource-first, verb-second command shape.
- JSON-only output.
- One CLI command maps to one API capability.
- Flat command structure. Flags handle filtering.
- CLI maps to `api.public.*` only (not `api.app.*`).
- CLI and HTTP API share one canonical public contract (`api.public.*`).

## Authentication

- All non-config CLI commands require an API key.
- CLI authenticates against `api.public.*` using API key auth:
  - primary header: `x-api-key: <esk_...>`
  - optional equivalent: `authorization: Bearer <esk_...>`
- API key lookup precedence:
  - `--api-key` flag
  - `ETSYSENTRY_API_KEY` env var
  - `~/.etsysentry/config.json` (`apiKey`)
- If no API key is available, command should fail with `MISSING_CONFIG`.

## Binary and Output

- Proposed binary: `es`
- Output is always JSON.
- Success envelope:

```json
{"ok": true, "data": {}}
```

- Error envelope:

```json
{"ok": false, "error": {"code": "MISSING_CONFIG", "message": "config.apiKey is required", "details": {}}}
```

## tRPC HTTP Path Shape

CLI command segments map to slash-style tRPC procedure paths.

Pattern:
- `/api/<resource>/<verb>`
- `/api/<resource>/<verb>/<subresource>` when needed

Examples:
- `es keywords track "wedding invite"` -> `POST /api/keywords/track`
- `es listings get 1234567890` -> `GET /api/listings/get`
- `es shops list --status active` -> `GET /api/shops/list`
- `es metrics series listings --ids 123,456` -> `GET /api/metrics/series/listings`

Transport behavior stays tRPC-native:
- query procedures use `GET` with URL-encoded `input`
- mutation procedures use `POST` with JSON body

## Config

Config file:
- `~/.etsysentry/config.json`

Commands:
- `es config show`
- `es config clear`
- `es config set api-key <value>`
- `es config set base-url <value>`
- `es config set range <today|yesterday|7d|30d|YYYY-MM-DD..YYYY-MM-DD>`

Config precedence:
- `--api-key` flag
- `ETSYSENTRY_API_KEY` env var
- `~/.etsysentry/config.json` (`apiKey`)

Base URL precedence:
- `--base-url` flag
- `ETSYSENTRY_API_BASE_URL` env var
- `~/.etsysentry/config.json` (`baseUrl`, default `http://localhost:8080`)

Range precedence:
- `--range` flag
- `ETSYSENTRY_DEFAULT_RANGE` env var
- `~/.etsysentry/config.json` (`range`, default `30d`)

## Common Concepts

Primitive status values:
- `active`
- `paused`
- `archived`
- `all` (list-only)

Pagination:
- `--limit <n>`
- `--offset <n>`

Range:
- `today`
- `yesterday`
- `7d`
- `30d`
- `YYYY-MM-DD..YYYY-MM-DD`

## Track Commands

Canonical resource-first commands:
- `es keywords track <query>`
- `es listings track <listing_id|listing_url>`
- `es shops track <shop_id|shop_url|shop_name>`

Convenience aliases:
- `es track keyword <query>` -> `es keywords track <query>`
- `es track listing <listing_id|listing_url>` -> `es listings track <listing_id|listing_url>`
- `es track product <listing_id|listing_url>` -> `es listings track <listing_id|listing_url>`
- `es track shop <shop_id|shop_url|shop_name>` -> `es shops track <shop_id|shop_url|shop_name>`

Tracking behavior:
- idempotent for existing active records
- returns tracked primitive plus status/source metadata

## Primitive Commands

### Keywords

- `es keywords track <query>`
- `es keywords list [--status active|paused|archived|all] [--search <text>] [--limit <n>] [--offset <n>]`
- `es keywords get <keyword_id>`
- `es keywords pause <keyword_id>`
- `es keywords resume <keyword_id>`
- `es keywords archive <keyword_id>`

### Listings (Products)

- `es listings track <listing_id|listing_url>`
- `es listings list [--status active|paused|archived|all] [--shop-id <shop_id>] [--source manual|discovered-from-keyword|discovered-from-shop] [--limit <n>] [--offset <n>]`
- `es listings get <listing_id>`
- `es listings pause <listing_id>`
- `es listings resume <listing_id>`
- `es listings archive <listing_id>`

Alias group:
- `es products ...` maps 1:1 to `es listings ...`

### Shops

- `es shops track <shop_id|shop_url|shop_name>`
- `es shops list [--status active|paused|archived|all] [--search <text>] [--limit <n>] [--offset <n>]`
- `es shops get <shop_id>`
- `es shops pause <shop_id>`
- `es shops resume <shop_id>`
- `es shops archive <shop_id>`

## Metrics Series

Series commands are chart-focused and return time buckets.

Common flags:
- `--ids <id1,id2,...>`
- `--range <today|yesterday|7d|30d|YYYY-MM-DD..YYYY-MM-DD>`
- `--bucket <auto|day|week|month>`
- `--metrics <key1,key2,...>`

Commands:
- `es metrics series keywords [--ids <id1,id2,...>] [--range <range>] [--bucket <auto|day|week|month>] [--metrics <bestRank,avgRank,visibilityScore,resultCount>]`
- `es metrics series listings [--ids <id1,id2,...>] [--range <range>] [--bucket <auto|day|week|month>] [--metrics <reviewCount,reviewAverage,favorerCount,price,views,quantity,estimatedSales>]`
- `es metrics series shops [--ids <id1,id2,...>] [--range <range>] [--bucket <auto|day|week|month>] [--metrics <activeListings,newListings,removedListings,totalFavorers,avgPrice>]`

Bucket behavior:
- `auto` resolves to `day` for `today/7d/30d`, and `week` for longer custom ranges

## Command Examples

```bash
es config set api-key esk_live_xxx
es config set base-url http://localhost:8080
es config set range 30d

es track keyword "mid century wall art"
es track product https://www.etsy.com/listing/1234567890/example
es track shop la-paz-studio

es keywords get kw_01JABCDEF
es listings get 1234567890
es shops get 99887766

es metrics series keywords --ids kw_01JABCDEF --range 30d --metrics bestRank,avgRank
es metrics series listings --ids 1234567890 --range 30d --metrics reviewCount,estimatedSales
es metrics series shops --ids 99887766 --range 30d --metrics activeListings,newListings
```

## Out of Scope (v1)

- interactive terminal UI
- non-JSON output modes
- admin-only logs and operational endpoints
