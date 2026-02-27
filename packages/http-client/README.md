# @etsysentry/http-client

Typed tRPC client for EtsySentry public APIs.

## Usage

```ts
import { createEtsySentryClient } from '@etsysentry/http-client';

const client = createEtsySentryClient({
    apiKey: 'esk_live_...',
    baseUrl: 'http://localhost:8080',
});

const listings = await client.queryClient.fetchQuery(
    client.trpc.public.listings.list.queryOptions({})
);

const tracked = await client.trpcClient.public.listings.track.mutate({
    listing: '1234567890',
});
```

## Notes

- Auth is sent via `x-api-key`.
- Base URL is normalized and `/api` is appended internally.
- The client is aligned to the currently implemented `public.*` surface:
  - `keywords.list`, `keywords.track`
  - `listings.list`, `listings.track`, `listings.getPerformance`
  - `shops.list`, `shops.track`

## Release

- Spec: `docs/http-client-spec.md`
- Canonical runbook: `docs/release-runbook.md`
