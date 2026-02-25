# EtsySentry API Spec (Modalities Draft v0.2)

## Scope

This spec defines both first-party API modalities exposed by EtsySentry:

- Dashboard App API (`api.app.*`) authenticated by Clerk bearer tokens.
- Public API (`api.public.*`) authenticated by API keys (CLI + HTTP client).

Server transport base URL for both modalities:
- `<origin>/api`

## API Modalities

### Dashboard App API (`api.app.*`)

- Intended clients:
  - EtsySentry dashboard website (`apps/website`)
- Authentication:
  - `Authorization: Bearer <clerk_jwt>`
- Auth context behavior:
  - server validates Clerk token
  - `accountId` is resolved server-side from mapped Clerk identity `(iss, sub)` with email match
    as the preferred link when available
  - all tenant/domain ownership is keyed by `accountId` (not Clerk user ids)
  - procedures must not accept auth identity fields from client input
  - admin-only procedures require Clerk email to match `ADMIN_EMAIL`
- Current implementation status:
  - implemented and active

OAuth/session storage boundary:
- Etsy OAuth tokens/connections are persisted server-side.
- Website clients must not store Etsy OAuth tokens/session identifiers in browser storage:
  - `localStorage`
  - `sessionStorage`
  - cookies

### Public API (`api.public.*`)

- Intended clients:
  - CLI
  - `@etsysentry/http-client`
  - direct HTTP/tRPC clients
- Authentication:
  - required: `x-api-key: <esk_...>`
  - optional equivalent: `authorization: Bearer <esk_...>`
- Auth context behavior:
  - tenant scoping comes from API key context
- Current implementation status:
  - router scaffold exists; detailed v1 contract below remains canonical target surface

## Transport Notes

- tRPC only (no parallel REST contract).
- Dashboard procedure keys follow dotted router paths:
  - `app.etsyAuth.start`
  - `app.listings.list`
- Public API contract below uses slash-style keys for the canonical CLI/http surface:
  - `keywords/track`
  - `listings/get`
  - `metrics/series/listings`
- HTTP semantics (tRPC):
  - query -> `GET` with URL-encoded `input`
  - mutation -> `POST` with JSON body

## Dashboard App API (`api.app.*`) Procedures

Current implemented procedures:

### Admin

`app.admin.status` (query, admin-only)

Input:

```ts
{}
```

Output:

```ts
{
  email: string | null;
  isAdmin: true;
  accountId: string;
}
```

`app.admin.enqueueSyncAllListings` (mutation, admin-only)

Input:

```ts
{}
```

Output:

```ts
{
  enqueuedCount: number;
  skippedCount: number;
  totalCount: number;
}
```

`app.admin.getEtsyApiUsage` (query, admin-only)

Input:

```ts
{}
```

Output:

```ts
{
  rateLimit: {
    blockedForMs: number;
    blockedUntil: string | null; // ISO timestamp
    perDayLimit: number;
    perSecondLimit: number;
    requestsInCurrentSecond: number;
    secondWindowResetsInMs: number;
    secondWindowStartedAt: string | null; // ISO timestamp
  };
  stats: {
    callsPast5Minutes: number;
    callsPastHour: number;
    callsPast24Hours: number;
    lastCallAt: string | null; // ISO timestamp
  };
}
```

### Etsy OAuth

`app.etsyAuth.start` (mutation)

Input:

```ts
{}
```

Output:

```ts
{
  authorizationUrl: string;
  expiresAt: string; // ISO timestamp
}
```

`app.etsyAuth.status` (query)

Input:

```ts
{}
```

Output:

```ts
{
  connected: boolean;
  expiresAt: string | null; // ISO timestamp
  needsRefresh: boolean;
  scopes: string[];
}
```

`app.etsyAuth.refresh` (mutation)

Input:

```ts
{}
```

Output:
- same shape as `app.etsyAuth.status`

`app.etsyAuth.disconnect` (mutation)

Input:

```ts
{}
```

Output:
- same shape as `app.etsyAuth.status`

### Listings

`app.listings.list` (query)

Input:

```ts
{}
```

Output:

```ts
{
  items: Array<{
    id: string;
    accountId: string;
    etsyListingId: string;
    title: string;
    url: string | null;
    trackingState: 'active' | 'paused' | 'error' | 'fatal';
    etsyState: 'active' | 'inactive' | 'sold_out' | 'draft' | 'expired';
    shopId: string | null;
    shopName: string | null;
    price: {
      amount: number;
      divisor: number;
      currencyCode: string;
      value: number;
    } | null;
    quantity: number | null;
    views: number | null;
    numFavorers: number | null;
    updatedTimestamp: number | null;
    lastRefreshedAt: string; // ISO timestamp
    lastRefreshError: string | null;
    updatedAt: string; // ISO timestamp
  }>;
}
```

`app.listings.track` (mutation)

Input:

```ts
{
  listing: string; // Etsy listing id or listing URL
}
```

Output:

```ts
{
  created: boolean;
  item: {
    // same item shape as entries in app.listings.list output
  };
}
```

`app.listings.refresh` (mutation)

Input:

```ts
{
  trackedListingId: string; // uuid
}
```

Output:
- same item shape as entries in `app.listings.list` output

`app.listings.refreshMany` (mutation)

Input:

```ts
{
  trackedListingIds: string[]; // uuid[], min 1, max 100
}
```

Output:

```ts
{
  enqueuedCount: number;
  skippedCount: number;
  totalCount: number;
}
```

`app.listings.getMetricHistory` (query)

Input:

```ts
{
  trackedListingId: string; // uuid
  days?: number; // optional window size (1..365), default 30
}
```

Output:

```ts
{
  listingId: string; // tracked listing id (uuid)
  etsyListingId: string;
  title: string;
  days: number;
  items: Array<{
    observedDate: string; // YYYY-MM-DD (UTC day key)
    observedAt: string; // ISO timestamp for most recent run captured that day
    views: number | null;
    favorerCount: number | null;
    quantity: number | null;
    price: {
      amount: number;
      divisor: number;
      currencyCode: string;
      value: number;
    } | null;
  }>;
}
```

### Shops

`app.shops.list` (query)

Input:

```ts
{}
```

Output:

```ts
{
  items: Array<{
    id: string; // tracked shop id (uuid)
    accountId: string;
    etsyShopId: string;
    shopName: string;
    shopUrl: string | null;
    trackingState: 'active' | 'paused' | 'error';
    syncState: 'idle' | 'queued' | 'syncing';
    lastRefreshedAt: string; // ISO timestamp
    nextSyncAt: string; // ISO timestamp
    lastRefreshError: string | null;
    lastSyncedListingUpdatedTimestamp: number | null;
    updatedAt: string; // ISO timestamp
    latestSnapshot: {
      observedAt: string; // ISO timestamp
      activeListingCount: number;
      newListingCount: number;
      favoritesTotal: number | null;
      favoritesDelta: number | null;
      soldTotal: number | null;
      soldDelta: number | null;
      reviewTotal: number | null;
      reviewDelta: number | null;
    } | null;
  }>;
}
```

`app.shops.track` (mutation)

Input:

```ts
{
  shop: string; // Etsy shop id, Etsy shop URL, or shop name
}
```

Output:

```ts
{
  created: boolean;
  item: {
    // same item shape as entries in app.shops.list output
  };
}
```

`app.shops.refresh` (mutation)

Input:

```ts
{
  trackedShopId: string; // uuid
}
```

Output:
- same item shape as entries in `app.shops.list` output

## Public API (`api.public.*`) Canonical Contract (v1 Target)

This section defines the canonical CLI/http contract shape used by:

- CLI
- `@etsysentry/http-client`
- direct HTTP/tRPC clients

Primitives:
- `keyword`
- `listing` (CLI alias: `product`)
- `shop`

### Public API Design Rules

- Slash-style procedure keys (for example `keywords/track`).
- One CLI command maps to one public procedure.
- Query/mutation boundaries are explicit.
- Tenant scoping comes from API key context.

### Public API Authentication

Required on all `api.public.*` procedures:
- `x-api-key: <esk_...>` header

Optional equivalent:
- `authorization: Bearer <esk_...>`

API key requirements:
- key is active and not revoked
- key resolves to one tenant context
- all data access is tenant-scoped

### Public API Response Envelope

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
  metrics?: Array<
    | 'activeListings'
    | 'newListings'
    | 'favoritesTotal'
    | 'favoritesDelta'
    | 'soldTotal'
    | 'soldDelta'
    | 'reviewTotal'
    | 'reviewDelta'
  >;
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
