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

- Primary entrypoint: `createEtsySentryClient({ baseUrl, apiKey, accessToken, headers, batch })`
- Usage:

```ts
import { createEtsySentryClient } from '@etsysentry/http-client';

const client = createEtsySentryClient({
    baseUrl: 'https://etsysentry-api.merchbase.co',
    apiKey: 'mbk_v1.<canonical-base64url-json>',
});

const listings = await client.queryClient.fetchQuery(client.trpc.public.listings.list.queryOptions({}));
```

`apiKey` accepts only the bounded `mbk_v1.<canonical-base64url-json>` envelope containing exactly
`clientId` and `clientSecret`; the client sends these as Cloudflare Access service headers. An
opaque OAuth credential uses the distinct `accessToken` option and is sent as `Authorization:
Bearer <value>` without examining its shape. Supplying both options is rejected. Requests omit
ambient cookies and use manual redirect handling so Cloudflare service headers cannot follow a
redirect. The client reads its `accessToken` option for each request; callers that refresh opaque
OAuth tokens should update that option or recreate the client before its next request.

## Build + Publish

```bash
bun run http-client:build
```

```bash
cd packages/http-client
export NPM_TOKEN="$(security find-generic-password -a "$USER" -s rankwrangler-npm-token -w)"
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
