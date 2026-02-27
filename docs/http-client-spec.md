# HTTP Client Spec (Typed npm)

This spec defines the public npm client package that exposes typed access to the EtsySentry API
without duplicating CLI or server logic.

Canonical release process: `docs/release-runbook.md`.

## Goals

- Provide a stable, typed JavaScript client for external codebases.
- Keep the surface area aligned with the CLI/public API so there is one canonical API surface.
- Avoid a separate REST surface that would need independent maintenance.

## Package

- Name: `@etsysentry/http-client`
- Location: `packages/http-client`
- Output: `dist/` (ESM + `.d.ts`)

## Philosophy

- The client mirrors `api.public.*` and the CLI command surface.
- Typed inputs and outputs are derived from the server router, not duplicated.
- Publish manually to npm for now.

## Client Surface

- Primary entrypoint: `createEtsySentryClient({ baseUrl, apiKey, headers, batch })`
- Usage:

```ts
import { createEtsySentryClient } from '@etsysentry/http-client';

const client = createEtsySentryClient({
    baseUrl: 'https://etsysentry.example.com',
    apiKey: 'esk_...',
});

const listings = await client.queryClient.fetchQuery(client.trpc.public.listings.list.queryOptions({}));
```

## Build + Publish

```bash
bun run http-client:build
```

```bash
cd packages/http-client
set -a
source ../../.env
set +a
npm whoami --userconfig ../../.npmrc
npm publish --access public --userconfig ../../.npmrc
```

Bump `packages/http-client/package.json` before every publish.

## Versioning Policy

EtsySentry uses synchronized versions across releases:

- App release version in `CHANGELOG.md` (for example `v0.1.0`) and
- npm package versions in:
  - `packages/http-client/package.json` (for example `0.1.0`)
  - `packages/cli/package.json` (for example `0.1.0`)

must match for the same release.

Use SemVer for `@etsysentry/http-client`:

- `MAJOR`: breaking changes to the published client contract.
- `MINOR`: backward-compatible additions to the public client surface.
- `PATCH`: backward-compatible fixes or internal improvements.

Release checklist for HTTP client changes:

1. Run `bun run http-client:build`.
2. Bump `packages/http-client/package.json` to match the target release version.
3. Update `CHANGELOG.md` in the same PR with the matching `vX.Y.Z` release heading.
4. Publish with `npm publish --access public`.
