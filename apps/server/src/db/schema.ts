import { sql } from 'drizzle-orm';
import {
    boolean,
    date,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';

export const trackedListingTrackingStateEnum = pgEnum('tracked_listing_tracking_state', [
    'active',
    'paused',
    'error',
    'fatal'
]);

export const trackedListingSyncStateEnum = pgEnum('tracked_listing_sync_state', [
    'idle',
    'queued',
    'syncing'
]);

export const trackedKeywordTrackingStateEnum = pgEnum('tracked_keyword_tracking_state', [
    'active',
    'paused',
    'error'
]);

export const trackedKeywordSyncStateEnum = pgEnum('tracked_keyword_sync_state', [
    'idle',
    'queued',
    'syncing'
]);

export const trackedShopTrackingStateEnum = pgEnum('tracked_shop_tracking_state', [
    'active',
    'paused',
    'error'
]);

export const trackedShopSyncStateEnum = pgEnum('tracked_shop_sync_state', [
    'idle',
    'queued',
    'syncing'
]);

export const trackedListingEtsyStateEnum = pgEnum('tracked_listing_etsy_state', [
    'active',
    'inactive',
    'sold_out',
    'draft',
    'expired'
]);

export const eventLogLevelEnum = pgEnum('event_log_level', ['info', 'warn', 'error', 'debug']);

export const eventLogStatusEnum = pgEnum('event_log_status', [
    'success',
    'failed',
    'pending',
    'retrying',
    'partial'
]);

export const eventLogPrimitiveTypeEnum = pgEnum('event_log_primitive_type', [
    'keyword',
    'listing',
    'shop',
    'system'
]);

export const accounts = pgTable('accounts', {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
});

export const clerkIdentities = pgTable(
    'clerk_identities',
    {
        accountId: text('account_id')
            .notNull()
            .references(() => accounts.id),
        clerkIssuer: text('clerk_issuer').notNull(),
        clerkOrgId: text('clerk_org_id'),
        clerkSubject: text('clerk_subject').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
        email: text('email'),
        lastSeenAt: timestamp('last_seen_at', { mode: 'date' }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        accountIdx: index('clerk_identities_account_idx').on(table.accountId),
        issuerSubjectPk: primaryKey({
            columns: [table.clerkIssuer, table.clerkSubject],
            name: 'clerk_identities_issuer_subject_pk'
        })
    })
);

export const trackedListings = pgTable(
    'tracked_listings',
    {
        listingId: uuid('listing_id').primaryKey().defaultRandom(),
        accountId: text('account_id').notNull(),
        trackerClerkUserId: text('tracker_clerk_user_id').notNull(),
        etsyListingId: text('etsy_listing_id').notNull(),
        isDigital: boolean('is_digital').notNull().default(false),
        shopId: text('shop_id'),
        shopName: text('shop_name'),
        title: text('title').notNull(),
        url: text('url'),
        thumbnailUrl: text('thumbnail_url'),
        trackingState: trackedListingTrackingStateEnum('tracking_state').notNull().default('active'),
        syncState: trackedListingSyncStateEnum('sync_state').notNull().default('idle'),
        etsyState: trackedListingEtsyStateEnum('etsy_state').notNull().default('inactive'),
        priceAmount: integer('price_amount'),
        priceDivisor: integer('price_divisor'),
        priceCurrencyCode: text('price_currency_code'),
        quantity: integer('quantity'),
        views: integer('views'),
        numFavorers: integer('num_favorers'),
        updatedTimestamp: integer('updated_timestamp'),
        lastRefreshedAt: timestamp('last_refreshed_at', { mode: 'date' }).notNull().defaultNow(),
        lastRefreshError: text('last_refresh_error'),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        tenantListingUnique: uniqueIndex('tracked_listings_tenant_listing_unique').on(
            table.accountId,
            table.etsyListingId
        ),
        accountIdx: index('tracked_listings_account_idx').on(table.accountId),
        tenantTrackerIdx: index('tracked_listings_tenant_tracker_idx').on(
            table.accountId,
            table.trackerClerkUserId
        ),
        trackingStateIdx: index('tracked_listings_tracking_state_idx').on(table.trackingState),
        syncStateIdx: index('tracked_listings_sync_state_idx').on(table.syncState),
        updatedAtIdx: index('tracked_listings_updated_at_idx').on(table.updatedAt)
    })
);

export const trackedKeywords = pgTable(
    'tracked_keywords',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        accountId: text('account_id').notNull(),
        trackerClerkUserId: text('tracker_clerk_user_id').notNull(),
        keyword: text('keyword').notNull(),
        normalizedKeyword: text('normalized_keyword').notNull(),
        trackingState: trackedKeywordTrackingStateEnum('tracking_state').notNull().default('active'),
        syncState: trackedKeywordSyncStateEnum('sync_state').notNull().default('idle'),
        lastRefreshedAt: timestamp('last_refreshed_at', { mode: 'date' }).notNull().defaultNow(),
        nextSyncAt: timestamp('next_sync_at', { mode: 'date' }).notNull().defaultNow(),
        lastRefreshError: text('last_refresh_error'),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        tenantKeywordUnique: uniqueIndex('tracked_keywords_tenant_keyword_unique').on(
            table.accountId,
            table.normalizedKeyword
        ),
        accountIdx: index('tracked_keywords_account_idx').on(table.accountId),
        tenantTrackerIdx: index('tracked_keywords_tenant_tracker_idx').on(
            table.accountId,
            table.trackerClerkUserId
        ),
        trackingStateIdx: index('tracked_keywords_tracking_state_idx').on(table.trackingState),
        syncStateIdx: index('tracked_keywords_sync_state_idx').on(table.syncState),
        nextSyncAtIdx: index('tracked_keywords_next_sync_at_idx').on(table.nextSyncAt),
        updatedAtIdx: index('tracked_keywords_updated_at_idx').on(table.updatedAt)
    })
);

export const productKeywordRanks = pgTable(
    'product_keyword_ranks',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        accountId: text('account_id').notNull(),
        trackedKeywordId: uuid('tracked_keyword_id').notNull(),
        listingId: uuid('listing_id')
            .notNull()
            .references(() => trackedListings.listingId),
        observedAt: timestamp('observed_at', { mode: 'date' }).notNull().defaultNow(),
        rank: integer('rank').notNull(),
        etsyListingId: text('etsy_listing_id').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        tenantKeywordObservedIdx: index('product_keyword_ranks_tenant_keyword_observed_idx').on(
            table.accountId,
            table.trackedKeywordId,
            table.observedAt
        ),
        tenantListingObservedIdx: index('product_keyword_ranks_tenant_listing_observed_idx').on(
            table.accountId,
            table.listingId,
            table.observedAt
        ),
        tenantEtsyListingObservedIdx: index(
            'product_keyword_ranks_tenant_etsy_listing_observed_idx'
        ).on(
            table.accountId,
            table.etsyListingId,
            table.observedAt
        ),
        tenantKeywordRankIdx: index('product_keyword_ranks_tenant_keyword_rank_idx').on(
            table.accountId,
            table.trackedKeywordId,
            table.rank
        )
    })
);

export const listingMetricSnapshots = pgTable(
    'listing_metric_snapshots',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        accountId: text('account_id').notNull(),
        listingId: uuid('listing_id')
            .notNull()
            .references(() => trackedListings.listingId),
        observedDate: date('observed_date', { mode: 'string' }).notNull(),
        observedAt: timestamp('observed_at', { mode: 'date' }).notNull().defaultNow(),
        views: integer('views'),
        favorerCount: integer('favorer_count'),
        quantity: integer('quantity'),
        priceAmount: integer('price_amount'),
        priceDivisor: integer('price_divisor'),
        priceCurrencyCode: text('price_currency_code'),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        tenantListingDayUnique: uniqueIndex('listing_metric_snapshots_tenant_listing_day_unique').on(
            table.accountId,
            table.listingId,
            table.observedDate
        ),
        tenantListingObservedAtIdx: index(
            'listing_metric_snapshots_tenant_listing_observed_at_idx'
        ).on(table.accountId, table.listingId, table.observedAt),
        tenantObservedDateIdx: index('listing_metric_snapshots_tenant_observed_date_idx').on(
            table.accountId,
            table.observedDate
        )
    })
);

export const trackedShops = pgTable(
    'tracked_shops',
    {
        trackedShopId: uuid('tracked_shop_id').primaryKey().defaultRandom(),
        accountId: text('account_id').notNull(),
        etsyShopId: text('etsy_shop_id').notNull(),
        shopName: text('shop_name').notNull(),
        shopUrl: text('shop_url'),
        trackingState: trackedShopTrackingStateEnum('tracking_state').notNull().default('active'),
        syncState: trackedShopSyncStateEnum('sync_state').notNull().default('idle'),
        lastRefreshedAt: timestamp('last_refreshed_at', { mode: 'date' }).notNull().defaultNow(),
        nextSyncAt: timestamp('next_sync_at', { mode: 'date' }).notNull().defaultNow(),
        lastRefreshError: text('last_refresh_error'),
        lastSyncedListingUpdatedTimestamp: integer('last_synced_listing_updated_timestamp'),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        tenantShopUnique: uniqueIndex('tracked_shops_tenant_shop_unique').on(
            table.accountId,
            table.etsyShopId
        ),
        accountIdx: index('tracked_shops_account_idx').on(table.accountId),
        trackingStateIdx: index('tracked_shops_tracking_state_idx').on(table.trackingState),
        syncStateIdx: index('tracked_shops_sync_state_idx').on(table.syncState),
        nextSyncAtIdx: index('tracked_shops_next_sync_at_idx').on(table.nextSyncAt),
        updatedAtIdx: index('tracked_shops_updated_at_idx').on(table.updatedAt)
    })
);

export const trackedShopSnapshots = pgTable(
    'tracked_shop_snapshots',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        accountId: text('account_id').notNull(),
        trackedShopId: uuid('tracked_shop_id')
            .notNull()
            .references(() => trackedShops.trackedShopId),
        etsyShopId: text('etsy_shop_id').notNull(),
        observedAt: timestamp('observed_at', { mode: 'date' }).notNull().defaultNow(),
        activeListingCount: integer('active_listing_count').notNull().default(0),
        newListingCount: integer('new_listing_count').notNull().default(0),
        favoritesTotal: integer('favorites_total'),
        favoritesDelta: integer('favorites_delta'),
        soldTotal: integer('sold_total'),
        soldDelta: integer('sold_delta'),
        reviewTotal: integer('review_total'),
        reviewDelta: integer('review_delta'),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        tenantShopObservedAtIdx: index('tracked_shop_snapshots_tenant_shop_observed_at_idx').on(
            table.accountId,
            table.trackedShopId,
            table.observedAt
        ),
        tenantEtsyShopObservedAtIdx: index(
            'tracked_shop_snapshots_tenant_etsy_shop_observed_at_idx'
        ).on(
            table.accountId,
            table.etsyShopId,
            table.observedAt
        )
    })
);

export const trackedShopListings = pgTable(
    'tracked_shop_listings',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        accountId: text('account_id').notNull(),
        trackedShopId: uuid('tracked_shop_id')
            .notNull()
            .references(() => trackedShops.trackedShopId),
        etsyShopId: text('etsy_shop_id').notNull(),
        etsyListingId: text('etsy_listing_id').notNull(),
        listingUpdatedTimestamp: integer('listing_updated_timestamp'),
        isActive: boolean('is_active').notNull().default(true),
        firstSeenAt: timestamp('first_seen_at', { mode: 'date' }).notNull().defaultNow(),
        lastSeenAt: timestamp('last_seen_at', { mode: 'date' }).notNull().defaultNow(),
        lastChangedAt: timestamp('last_changed_at', { mode: 'date' }).notNull().defaultNow(),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        tenantShopListingUnique: uniqueIndex('tracked_shop_listings_tenant_shop_listing_unique').on(
            table.accountId,
            table.trackedShopId,
            table.etsyListingId
        ),
        tenantShopActiveIdx: index('tracked_shop_listings_tenant_shop_active_idx').on(
            table.accountId,
            table.trackedShopId,
            table.isActive
        ),
        tenantListingIdx: index('tracked_shop_listings_tenant_listing_idx').on(
            table.accountId,
            table.etsyListingId
        ),
        tenantEtsyShopIdx: index('tracked_shop_listings_tenant_etsy_shop_idx').on(
            table.accountId,
            table.etsyShopId
        )
    })
);

export const eventLogs = pgTable(
    'event_logs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        accountId: text('account_id').notNull(),
        occurredAt: timestamp('occurred_at', { mode: 'date' }).notNull().defaultNow(),
        level: eventLogLevelEnum('level').notNull(),
        category: text('category').notNull(),
        action: text('action').notNull(),
        status: eventLogStatusEnum('status').notNull(),
        primitiveType: eventLogPrimitiveTypeEnum('primitive_type').notNull(),
        primitiveId: text('primitive_id'),
        listingId: text('listing_id'),
        shopId: text('shop_id'),
        keyword: text('keyword'),
        message: text('message').notNull(),
        detailsJson: jsonb('details_json').$type<Record<string, unknown>>().notNull().default({}),
        monitorRunId: text('monitor_run_id'),
        requestId: text('request_id'),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        tenantOccurredAtIdx: index('event_logs_tenant_occurred_at_idx').on(
            table.accountId,
            table.occurredAt
        ),
        tenantPrimitiveOccurredAtIdx: index('event_logs_tenant_primitive_occurred_at_idx').on(
            table.accountId,
            table.primitiveType,
            table.occurredAt
        ),
        tenantListingOccurredAtIdx: index('event_logs_tenant_listing_occurred_at_idx').on(
            table.accountId,
            table.listingId,
            table.occurredAt
        ),
        tenantShopOccurredAtIdx: index('event_logs_tenant_shop_occurred_at_idx').on(
            table.accountId,
            table.shopId,
            table.occurredAt
        ),
        tenantMonitorRunOccurredAtIdx: index('event_logs_tenant_monitor_run_occurred_at_idx').on(
            table.accountId,
            table.monitorRunId,
            table.occurredAt
        )
    })
);

export const etsyOAuthConnections = pgTable(
    'etsy_oauth_connections',
    {
        accessToken: text('access_token').notNull(),
        accountId: text('account_id')
            .primaryKey()
            .references(() => accounts.id),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
        expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
        refreshToken: text('refresh_token').notNull(),
        scopes: text('scopes')
            .array()
            .notNull()
            .default(sql`ARRAY[]::text[]`),
        tokenType: text('token_type').notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
    },
    () => ({})
);

export const etsyApiCallEvents = pgTable(
    'etsy_api_call_events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        accountId: text('account_id').notNull(),
        clerkUserId: text('clerk_user_id').notNull(),
        endpoint: text('endpoint').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        tenantCreatedAtIdx: index('etsy_api_call_events_tenant_created_at_idx').on(
            table.accountId,
            table.createdAt
        ),
        tenantClerkCreatedAtIdx: index('etsy_api_call_events_tenant_clerk_created_at_idx').on(
            table.accountId,
            table.clerkUserId,
            table.createdAt
        )
    })
);

export const currencyRates = pgTable(
    'currency_rates',
    {
        baseCurrency: text('base_currency').primaryKey(),
        fetchedAt: timestamp('fetched_at', { mode: 'date' }),
        lastRefreshError: text('last_refresh_error'),
        nextRefreshAt: timestamp('next_refresh_at', { mode: 'date' }),
        provider: text('provider').notNull(),
        ratesJson: text('rates_json'),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        nextRefreshAtIdx: index('currency_rates_next_refresh_at_idx').on(table.nextRefreshAt),
        updatedAtIdx: index('currency_rates_updated_at_idx').on(table.updatedAt)
    })
);
