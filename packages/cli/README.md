# @etsysentry/cli

Official CLI for EtsySentry.

## Usage

```bash
es help
es config set api-key esk_live_xxx
es keywords list --limit 20
es listings track https://www.etsy.com/listing/1234567890/example
es listings performance <tracked_listing_id> --range 30d --mode table
```

## Development

```bash
bun run cli:build
bun run cli:test
```

## Release

- Spec: `docs/cli-spec.md`
- Canonical runbook: `docs/release-runbook.md`
