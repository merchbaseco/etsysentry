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
  - tenant scoping comes from API key context (`accountId`)
  - Clerk remains the dashboard auth provider; it is not the public tenant key
- Current implementation status:
  - implemented for CLI v0.2 surface:
    - `public.keywords.list`
    - `public.keywords.track`
    - `public.listings.list`
    - `public.listings.track`
    - `public.listings.getPerformance`
    - `public.shops.list`
    - `public.shops.track`

## Transport Notes

- tRPC only (no parallel REST contract).
- Dashboard procedure keys follow dotted router paths:
  - `app.etsyAuth.start`
  - `app.listings.list`
- Public API contract below uses slash-style keys for the canonical CLI/http surface:
  - `keywords/track`
  - `listings/get-performance`
  - `shops/list`
- HTTP semantics (tRPC):
  - query -> `GET` with URL-encoded `input`
  - mutation -> `POST` with JSON body

## WebSocket Messages

Realtime endpoint:

- path: `/ws`
- auth: Clerk bearer token passed as `?token=<clerk_jwt>`
- server routing: account-scoped fan-out by resolved `accountId`

Message contract (server -> client):

`query.invalidate`

```ts
{
  type: 'query.invalidate';
  queries: Array<
    | 'app.keywords.list'
    | 'app.listings.list'
    | 'app.shops.list'
    | 'app.logs.list'
  >;
}
```

`sync-state.push`

```ts
{
  type: 'sync-state.push';
  entity: 'listing' | 'keyword' | 'shop';
  ids: Record<string, 'idle' | 'queued' | 'syncing'>;
}
```

`dashboard-summary.push`

```ts
{
  type: 'dashboard-summary.push';
  jobCounts: {
    inFlightJobs: number;
    queuedJobs: number;
  };
}
```

Notes:

- `accountId` is included server-side for routing but stripped from wire payloads.
- high-frequency sync transitions should use push payloads over full invalidation.
- invalidation remains the default for broad or structural data changes.

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
  fetchedAt: string; // ISO timestamp
  rateLimit: {
    blockedForMs: number;
    blockedUntil: string | null; // ISO timestamp
    headersObservedAt: string | null; // ISO timestamp for latest x-limit/x-remaining header read
    perDayLimit: number;
    perSecondLimit: number;
    remainingThisSecond: number | null;
    remainingToday: number | null;
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

### API Keys

`app.apiKeys.list` (query)

Input:

```ts
{}
```

Output:

```ts
{
  items: Array<{
    id: string; // uuid
    accountId: string;
    ownerClerkUserId: string;
    name: string;
    keyPrefix: string;
    lastUsedAt: string | null; // ISO timestamp
    revokedAt: string | null; // ISO timestamp
    createdAt: string; // ISO timestamp
    updatedAt: string; // ISO timestamp
  }>;
}
```

`app.apiKeys.create` (mutation)

Input:

```ts
{
  name?: string; // optional; default "API key"
}
```

Output:

```ts
{
  item: {
    id: string; // uuid
    accountId: string;
    ownerClerkUserId: string;
    name: string;
    keyPrefix: string;
    lastUsedAt: string | null; // ISO timestamp
    revokedAt: string | null; // ISO timestamp
    createdAt: string; // ISO timestamp
    updatedAt: string; // ISO timestamp
  };
  rawApiKey: string; // returned only on create
}
```

`app.apiKeys.revoke` (mutation)

Input:

```ts
{
  apiKeyId: string; // uuid
}
```

Output:
- same item shape as entries in `app.apiKeys.list` output

### Dashboard

`app.dashboard.getSummary` (query)

Input:

```ts
{}
```

Output:

```ts
{
  etsyApiCallsPast24Hours: number;
  etsyApiCallsPastHour: number;
  totalTrackedListings: number;
  queuedJobs: number;
  inFlightJobs: number;
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

### Keywords

`app.keywords.list` (query)

Input:

```ts
{}
```

Output:

```ts
{
  items: Array<{
    id: string; // tracked keyword id (uuid)
    accountId: string;
    keyword: string;
    normalizedKeyword: string;
    trackingState: 'active' | 'paused' | 'error';
    syncState: 'idle' | 'queued' | 'syncing';
    lastRefreshedAt: string; // ISO timestamp
    nextSyncAt: string; // ISO timestamp
    lastRefreshError: string | null;
    trackerClerkUserId: string;
    updatedAt: string; // ISO timestamp
  }>;
}
```

`app.keywords.track` (mutation)

Input:

```ts
{
  keyword: string;
}
```

Output:

```ts
{
  created: boolean;
  item: {
    // same item shape as entries in app.keywords.list output
  };
}
```

`app.keywords.refresh` (mutation)

Input:

```ts
{
  trackedKeywordId: string; // uuid
}
```

Output:
- same item shape as entries in `app.keywords.list` output

`app.keywords.getDailyProductRanksForKeyword` (query)

Input:

```ts
{
  trackedKeywordId: string; // uuid
}
```

Output:

```ts
{
  trackedKeywordId: string; // uuid
  keyword: string;
  normalizedKeyword: string;
  observedAt: string | null; // ISO timestamp for latest capture
  items: Array<{
    trackedKeywordId: string; // uuid
    listingId: string; // tracked listing id (uuid)
    etsyListingId: string;
    observedAt: string; // ISO timestamp
    rank: number;
  }>;
}
```

`app.keywords.getActivity` (query)

Input:

```ts
{
  trackedKeywordId: string; // uuid
  days?: number; // optional, 1..30 lookback days from latest capture (default 14)
}
```

Output:

```ts
{
  keyword: {
    id: string; // tracked keyword id (uuid)
    keyword: string;
    normalizedKeyword: string;
    trackingState: 'active' | 'paused' | 'error';
    syncState: 'idle' | 'queued' | 'syncing';
    lastRefreshedAt: string; // ISO timestamp
    nextSyncAt: string; // ISO timestamp
  };
  capturedAt: string | null; // ISO timestamp for latest capture
  previousCapturedAt: string | null; // ISO timestamp for previous capture in lookback window
  historyWindowDays: number;
  items: Array<{
    currentRank: number;
    rankChanges: {
      change1d: number; // 0 when no baseline capture exists
      change7d: number; // 0 when no baseline capture exists
      change30d: number; // 0 when no baseline capture exists
      bestRank: number | null;
    };
    listing: {
      // same shape as entries in app.listings.list output
    };
    history: Array<{
      observedAt: string; // ISO timestamp
      rank: number;
    }>;
  }>;
}
```

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
    tags: string[]; // normalized (lowercase) Etsy tags currently attached to the listing
    price: {
      amount: number;
      divisor: number;
      currencyCode: string;
      value: number;
    } | null;
    quantity: number | null;
    endingTimestamp: number | null;
    shouldAutoRenew: boolean | null;
    views: number | null;
    numFavorers: number | null;
    updatedTimestamp: number | null;
    lastRefreshedAt: string; // ISO timestamp
    lastRefreshError: string | null;
    updatedAt: string; // ISO timestamp
  }>;
}
```

`app.listings.getRefreshPolicy` (query)

Input:

```ts
{}
```

Output:

```ts
{
  queuedCount: number;
  autoEnqueueCount: number;
  buckets: Array<{
    bucketId: 'daily_signal' | 'cooldown_3d' | 'cooldown_7d';
    bucket: string;
    cadence: '1d' | '3d' | '7d';
    policy: string;
    count: number;
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
  fromObservedDate: string; // YYYY-MM-DD (UTC day key)
  toObservedDate: string; // YYYY-MM-DD (UTC day key)
  items: Array<{
    observedDate: string; // YYYY-MM-DD (UTC day key)
    observedAt: string; // ISO timestamp for most recent run captured that day
    views: number | null;
    favorerCount: number | null;
    quantity: number | null;
    endingTimestamp: number | null;
    estimatedSoldDelta: number; // inferred from quantity drop + renewal signals
    estimatedSoldCount: number; // running cumulative inferred sold count in range
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

`app.shops.listListings` (query)

Input:

```ts
{
  etsyShopId: string;
  sortOrder?: 'most_recently_sold' | 'most_recently_favorited' | 'newest_listings';
}
```

Output:

```ts
{
  etsyShopId: string;
  shopName: string | null;
  isTrackedShop: boolean;
  sortOrder: 'most_recently_sold' | 'most_recently_favorited' | 'newest_listings';
  items: Array<{
    // same item shape as entries in app.listings.list output
  }>;
}
```

`app.shops.getOverview` (query)

Input:

```ts
{
  etsyShopId: string;
}
```

Output:

```ts
{
  isTrackedShop: boolean;
  shopName: string | null;
  overview: {
    avatarUrl: string | null;
    locationLabel: string | null;
    shopUrl: string | null;
    openedAt: string | null; // ISO timestamp
    soldCount: number | null;
    reviewCount: number | null;
    reviewAverage: number | null;
    metadataError: string | null;
    trackingState: 'active' | 'paused' | 'error' | null;
    syncState: 'idle' | 'queued' | 'syncing' | null;
    lastRefreshedAt: string | null; // ISO timestamp
    nextSyncAt: string | null; // ISO timestamp
    derivedSalesPerDay: {
      value: number | null; // average soldDelta/day across positive soldDelta days in window
      coverageDays: number; // number of days with a positive soldDelta used in the estimate
      windowDays: 30;
    } | null;
    derivedFavoritesPerDay: {
      value: number | null; // average favoritesDelta/day across positive favoritesDelta days
      coverageDays: number; // number of days with a positive favoritesDelta in the estimate
      windowDays: 30;
    } | null;
    metricHistory: Array<{
      observedAt: string; // ISO timestamp
      activeListingCount: number;
      favoritesDelta: number; // padded to 0 for days without a snapshot
      favoritesTotal: number | null;
      soldDelta: number; // padded to 0 for days without a snapshot
      soldTotal: number | null;
    }>; // 30 points; missing days are padded
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

## Public API (`api.public.*`) Current Contract (v0.2)

This section documents the procedures currently implemented for CLI/http consumers.

### Authentication

Required on all `api.public.*` procedures:
- `x-api-key: <esk_...>` header

Optional equivalent:
- `authorization: Bearer <esk_...>`

Auth notes:
- API key resolves the tenant `accountId`; all access is account-scoped.
- Public procedures do not accept tenant identity input fields.
- For tracking mutations, server resolves an actor Clerk identity from the account mapping.

### Procedure Keys

tRPC dotted keys:
- `public.keywords.list`
- `public.keywords.track`
- `public.listings.list`
- `public.listings.track`
- `public.listings.getPerformance`
- `public.shops.list`
- `public.shops.track`

Canonical slash mapping (CLI/http naming):
- `keywords/list` -> `public.keywords.list`
- `keywords/track` -> `public.keywords.track`
- `listings/list` -> `public.listings.list`
- `listings/track` -> `public.listings.track`
- `listings/get-performance` -> `public.listings.getPerformance`
- `shops/list` -> `public.shops.list`
- `shops/track` -> `public.shops.track`

### Implemented Procedures

`keywords/list` (query)
- Input: `{}`
- Output: same shape as `app.keywords.list`

`keywords/track` (mutation)

Input:

```ts
{
  keyword: string;
}
```

Output:
- same shape/behavior as `app.keywords.track`

`listings/list` (query)
- Input: `{}`
- Output: same shape as `app.listings.list` (includes USD decoration fields)

`listings/track` (mutation)

Input:

```ts
{
  listing: string; // Etsy listing id or Etsy listing URL
}
```

Output:
- same shape as `app.listings.track`

`listings/get-performance` (query)

Input:

```ts
{
  trackedListingId: string; // uuid
  range?: '7d' | '30d' | '90d' | string; // absolute format: YYYY-MM-DD..YYYY-MM-DD
  metrics?: Array<'views' | 'favorites' | 'quantity' | 'price'>;
}
```

Output:

```ts
{
  listing: {
    id: string;
    etsyListingId: string;
    title: string;
  };
  range: {
    label: string;
    from: string; // YYYY-MM-DD
    to: string; // YYYY-MM-DD
  };
  views?: {
    latest: number | null;
    points: Array<{ ts: string; value: number | null }>;
  };
  favorites?: {
    latest: number | null;
    points: Array<{ ts: string; value: number | null }>;
  };
  quantity?: {
    latest: number | null;
    points: Array<{ ts: string; value: number | null }>;
  };
  price?: {
    latest: { value: number; currencyCode: string } | null;
    points: Array<{
      ts: string;
      value: number | null;
      currencyCode: string | null;
    }>;
  };
}
```

`shops/list` (query)
- Input: `{}`
- Output: same shape as `app.shops.list`

`shops/track` (mutation)

Input:

```ts
{
  shop: string; // Etsy shop id, Etsy shop URL, or shop name
}
```

Output:
- same shape as `app.shops.track`

### Error Behavior

Common tRPC error codes returned by public procedures:
- `UNAUTHORIZED`
- `BAD_REQUEST`
- `NOT_FOUND`
- `PRECONDITION_FAILED`
- `INTERNAL_SERVER_ERROR`

Notes:
- `PRECONDITION_FAILED` is returned for tracking mutations when account-to-Clerk mapping is missing.
- CLI envelope mapping (`ok/data/error`) is a CLI concern, not the raw tRPC response format.

### Deferred Public Surface

The following remain deferred and are not implemented in `api.public.*` yet:
- `get/pause/resume/archive` verbs across primitives
- metrics series endpoints (`metrics/series/*`)
- dedicated refresh endpoints
