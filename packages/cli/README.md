# @etsysentry/cli

Official CLI for EtsySentry.

## Usage

```bash
export ES_STORAGE_DIR=/data/etsysentry
es help
es --version
es changelog
es auth set esk_live_xxx
es keywords list --limit 20
es listings track https://www.etsy.com/listing/1234567890/example
es listings performance <tracked_listing_id> --range 30d --mode table
```

`baseUrl` and storage settings are persisted in CLI config. API keys are stored in the secure
store on macOS Keychain, while `ES_API_KEY` remains available as a command-time override for
automation and CI.

## Development

```bash
bun run cli:build
bun run cli:test
```

## Release

- Spec: `docs/cli-spec.md`
- Canonical runbook: `docs/release-runbook.md`
