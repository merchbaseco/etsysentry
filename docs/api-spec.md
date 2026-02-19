# EtsySentry Public API Spec (Draft v0.1)

## Scope

This spec defines the canonical `api.public.*` contract for EtsySentry v1.

This is the same contract used by:
- CLI
- `@etsysentry/http-client`
- direct HTTP/tRPC clients

Primitives:
- `keyword`
- `listing` (CLI alias: `product`)
- `shop`

## Design Rules

- tRPC only (no parallel REST contract).
- Slash-style procedure keys (for example `keywords/track`).
- One CLI command maps to one public procedure.
- Query/mutation boundaries are explicit.
- Tenant scoping comes from API key context.

## Base Transport

Base URL:
- `<origin>/api`

Procedure key format:
- `<resource>/<verb>`
- `<resource>/<verb>/<subresource>` when needed

Examples:
- `keywords/track`
- `listings/get`
- `metrics/series/listings`

HTTP semantics (tRPC):
- query -> `GET` with URL-encoded `input`
- mutation -> `POST` with JSON body

## Authentication

Required on all `api.public.*` procedures:
- `x-api-key: <esk_...>` header

Optional equivalent:
- `authorization: Bearer <esk_...>`

API key requirements:
- key is active and not revoked
- key resolves to one tenant context
- all data access is tenant-scoped

## Response Envelope

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "listingId is required",
    "details": {
      "field": "listingId"
    }
  }
}
```

Standard error codes:
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `VALIDATION_ERROR`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

## Shared Types

Primitive status:
- `active`
- `paused`
- `archived`

Primitive source:
- `manual`
- `discovered-from-keyword`
- `discovered-from-shop`

Date range:
- `today`
- `yesterday`
- `7d`
- `30d`
- `YYYY-MM-DD..YYYY-MM-DD`

Series bucket:
- `auto`
- `day`
- `week`
- `month`

Pagination input:

```ts
{
  limit?: number; // default 20, max 200
  offset?: number; // default 0
}
```

## Primitive Resource Shapes

Keyword (output shape):

```ts
{
  id: string;
  type: 'keyword';
  value: string;
  status: 'active' | 'paused' | 'archived';
  source: 'manual' | 'discovered-from-keyword' | 'discovered-from-shop';
  createdAt: string;
  updatedAt: string;
  lastTrackedAt: string | null;
}
```

Listing (output shape):

```ts
{
  id: string; // internal primitive id
  type: 'listing';
  listingId: string; // Etsy listing id
  status: 'active' | 'paused' | 'archived';
  source: 'manual' | 'discovered-from-keyword' | 'discovered-from-shop';
  createdAt: string;
  updatedAt: string;
  lastTrackedAt: string | null;
}
```

Shop (output shape):

```ts
{
  id: string; // internal primitive id
  type: 'shop';
  shopId: string; // Etsy shop id
  shopName: string | null;
  status: 'active' | 'paused' | 'archived';
  source: 'manual' | 'discovered-from-keyword' | 'discovered-from-shop';
  createdAt: string;
  updatedAt: string;
  lastTrackedAt: string | null;
}
```

## Procedures

### Keywords

`keywords/track` (mutation)

Input:

```ts
{
  query: string;
}
```

Output:
- tracked keyword resource
- `created: boolean` (false when idempotent hit)

`keywords/list` (query)

Input:

```ts
{
  status?: 'active' | 'paused' | 'archived' | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}
```

Output:

```ts
{
  items: Array<Keyword>;
  total: number;
  limit: number;
  offset: number;
}
```

`keywords/get` (query)

Input:

```ts
{
  keywordId: string;
}
```

Output:
- keyword resource

`keywords/pause` (mutation)

Input:

```ts
{ keywordId: string }
```

Output:
- keyword resource with `status: 'paused'`

`keywords/resume` (mutation)

Input:

```ts
{ keywordId: string }
```

Output:
- keyword resource with `status: 'active'`

`keywords/archive` (mutation)

Input:

```ts
{ keywordId: string }
```

Output:
- keyword resource with `status: 'archived'`

### Listings

`listings/track` (mutation)

Input:

```ts
{
  listing: string; // Etsy listing id or listing URL
}
```

Output:
- tracked listing resource
- `created: boolean`

`listings/list` (query)

Input:

```ts
{
  status?: 'active' | 'paused' | 'archived' | 'all';
  shopId?: string;
  source?: 'manual' | 'discovered-from-keyword' | 'discovered-from-shop';
  limit?: number;
  offset?: number;
}
```

Output:

```ts
{
  items: Array<Listing>;
  total: number;
  limit: number;
  offset: number;
}
```

`listings/get` (query)

Input:

```ts
{
  listingId: string;
}
```

Output:
- listing resource

`listings/pause` (mutation)

Input:

```ts
{ listingId: string }
```

Output:
- listing resource with `status: 'paused'`

`listings/resume` (mutation)

Input:

```ts
{ listingId: string }
```

Output:
- listing resource with `status: 'active'`

`listings/archive` (mutation)

Input:

```ts
{ listingId: string }
```

Output:
- listing resource with `status: 'archived'`

### Shops

`shops/track` (mutation)

Input:

```ts
{
  shop: string; // Etsy shop id, shop URL, or shop name
}
```

Output:
- tracked shop resource
- `created: boolean`

`shops/list` (query)

Input:

```ts
{
  status?: 'active' | 'paused' | 'archived' | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}
```

Output:

```ts
{
  items: Array<Shop>;
  total: number;
  limit: number;
  offset: number;
}
```

`shops/get` (query)

Input:

```ts
{
  shopId: string;
}
```

Output:
- shop resource

`shops/pause` (mutation)

Input:

```ts
{ shopId: string }
```

Output:
- shop resource with `status: 'paused'`

`shops/resume` (mutation)

Input:

```ts
{ shopId: string }
```

Output:
- shop resource with `status: 'active'`

`shops/archive` (mutation)

Input:

```ts
{ shopId: string }
```

Output:
- shop resource with `status: 'archived'`

### Metrics Series

`metrics/series/keywords` (query)

Input:

```ts
{
  ids?: string[]; // keyword primitive ids
  range?: string;
  bucket?: 'auto' | 'day' | 'week' | 'month';
  metrics?: Array<'bestRank' | 'avgRank' | 'visibilityScore' | 'resultCount'>;
}
```

`metrics/series/listings` (query)

Input:

```ts
{
  ids?: string[]; // Etsy listing ids or listing primitive ids
  range?: string;
  bucket?: 'auto' | 'day' | 'week' | 'month';
  metrics?: Array<'reviewCount' | 'reviewAverage' | 'favorerCount' | 'price' | 'views' | 'quantity' | 'estimatedSales'>;
}
```

`metrics/series/shops` (query)

Input:

```ts
{
  ids?: string[]; // Etsy shop ids or shop primitive ids
  range?: string;
  bucket?: 'auto' | 'day' | 'week' | 'month';
  metrics?: Array<'activeListings' | 'newListings' | 'removedListings' | 'totalFavorers' | 'avgPrice'>;
}
```

Series output (all three procedures):

```ts
{
  range: {
    from: string;
    to: string;
  };
  bucket: 'day' | 'week' | 'month';
  metrics: string[];
  series: Array<{
    id: string;
    points: Array<{
      ts: string;
      values: Record<string, number | null>;
    }>;
  }>;
}
```

## CLI Mapping

Canonical mapping (`es`):
- `es keywords track` -> `keywords/track`
- `es keywords list` -> `keywords/list`
- `es keywords get` -> `keywords/get`
- `es listings track` -> `listings/track`
- `es listings list` -> `listings/list`
- `es listings get` -> `listings/get`
- `es shops track` -> `shops/track`
- `es shops list` -> `shops/list`
- `es shops get` -> `shops/get`
- `es metrics series keywords` -> `metrics/series/keywords`
- `es metrics series listings` -> `metrics/series/listings`
- `es metrics series shops` -> `metrics/series/shops`

Alias mapping:
- `es track keyword` -> `keywords/track`
- `es track listing` -> `listings/track`
- `es track product` -> `listings/track`
- `es track shop` -> `shops/track`
- `es products ...` -> `listings/...`

## Implementation Notes

- Procedure files should follow repository convention:
  - `apps/server/src/api/public/<resource>-<verb>.ts`
- Shared business logic should live in services/utilities, not routers.
- `@etsysentry/http-client` should expose this exact slash-style public surface.
