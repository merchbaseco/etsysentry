import { sql } from 'drizzle-orm';
import {
    index,
    integer,
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
    'error'
]);

export const trackedKeywordTrackingStateEnum = pgEnum('tracked_keyword_tracking_state', [
    'active',
    'paused',
    'error'
]);

export const trackedListingEtsyStateEnum = pgEnum('tracked_listing_etsy_state', [
    'active',
    'inactive',
    'sold_out',
    'draft',
    'expired'
]);

export const trackedListings = pgTable(
    'tracked_listings',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: text('tenant_id').notNull(),
        trackerClerkUserId: text('tracker_clerk_user_id').notNull(),
        etsyListingId: text('etsy_listing_id').notNull(),
        shopId: text('shop_id'),
        shopName: text('shop_name'),
        title: text('title').notNull(),
        url: text('url'),
        thumbnailUrl: text('thumbnail_url'),
        trackingState: trackedListingTrackingStateEnum('tracking_state').notNull().default('active'),
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
            table.tenantId,
            table.etsyListingId
        ),
        tenantIdx: index('tracked_listings_tenant_idx').on(table.tenantId),
        tenantTrackerIdx: index('tracked_listings_tenant_tracker_idx').on(
            table.tenantId,
            table.trackerClerkUserId
        ),
        trackingStateIdx: index('tracked_listings_tracking_state_idx').on(table.trackingState),
        updatedAtIdx: index('tracked_listings_updated_at_idx').on(table.updatedAt)
    })
);

export const trackedKeywords = pgTable(
    'tracked_keywords',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: text('tenant_id').notNull(),
        trackerClerkUserId: text('tracker_clerk_user_id').notNull(),
        keyword: text('keyword').notNull(),
        normalizedKeyword: text('normalized_keyword').notNull(),
        trackingState: trackedKeywordTrackingStateEnum('tracking_state').notNull().default('active'),
        lastRefreshedAt: timestamp('last_refreshed_at', { mode: 'date' }).notNull().defaultNow(),
        lastRefreshError: text('last_refresh_error'),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        tenantKeywordUnique: uniqueIndex('tracked_keywords_tenant_keyword_unique').on(
            table.tenantId,
            table.normalizedKeyword
        ),
        tenantIdx: index('tracked_keywords_tenant_idx').on(table.tenantId),
        tenantTrackerIdx: index('tracked_keywords_tenant_tracker_idx').on(
            table.tenantId,
            table.trackerClerkUserId
        ),
        trackingStateIdx: index('tracked_keywords_tracking_state_idx').on(table.trackingState),
        updatedAtIdx: index('tracked_keywords_updated_at_idx').on(table.updatedAt)
    })
);

export const productKeywordRanks = pgTable(
    'product_keyword_ranks',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: text('tenant_id').notNull(),
        trackedKeywordId: uuid('tracked_keyword_id').notNull(),
        observedAt: timestamp('observed_at', { mode: 'date' }).notNull().defaultNow(),
        rank: integer('rank').notNull(),
        etsyListingId: text('etsy_listing_id').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        tenantKeywordObservedIdx: index('product_keyword_ranks_tenant_keyword_observed_idx').on(
            table.tenantId,
            table.trackedKeywordId,
            table.observedAt
        ),
        tenantListingObservedIdx: index('product_keyword_ranks_tenant_listing_observed_idx').on(
            table.tenantId,
            table.etsyListingId,
            table.observedAt
        ),
        tenantKeywordRankIdx: index('product_keyword_ranks_tenant_keyword_rank_idx').on(
            table.tenantId,
            table.trackedKeywordId,
            table.rank
        )
    })
);

export const etsyOAuthConnections = pgTable(
    'etsy_oauth_connections',
    {
        accessToken: text('access_token').notNull(),
        clerkUserId: text('clerk_user_id').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
        expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
        refreshToken: text('refresh_token').notNull(),
        scopes: text('scopes')
            .array()
            .notNull()
            .default(sql`ARRAY[]::text[]`),
        tenantId: text('tenant_id').notNull(),
        tokenType: text('token_type').notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
    },
    (table) => ({
        clerkUserIdx: index('etsy_oauth_connections_clerk_user_idx').on(table.clerkUserId),
        tenantClerkPk: primaryKey({
            columns: [table.tenantId, table.clerkUserId],
            name: 'etsy_oauth_connections_tenant_clerk_pk'
        }),
        tenantIdx: index('etsy_oauth_connections_tenant_idx').on(table.tenantId)
    })
);
