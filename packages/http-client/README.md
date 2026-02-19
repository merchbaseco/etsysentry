# @etsysentry/http-client

Typed tRPC client for EtsySentry public APIs.

## Purpose

Provide a stable client for agents/CLI without exposing tRPC internals to consumers.

## Usage (Planned)

```ts
import { createEtsySentryClient } from '@etsysentry/http-client';

const client = createEtsySentryClient({
    baseUrl: 'https://api.etsysentry.com',
    apiKey: 'esk_...'
});

await client.primitive.create.mutate({
    type: 'keyword',
    value: 'wedding invitation template'
});

const series = await client.series.keywordRank.query({
    keyword: 'wedding invitation template',
    listingId: 1234567890,
    from: '2026-01-01',
    to: '2026-02-01'
});
```

## Types (Planned)

```ts
import type { PublicRouterInputs, PublicRouterOutputs } from '@etsysentry/http-client';
```

## Maintenance

When public router shape changes, regenerate bundled router types and rebuild package.
