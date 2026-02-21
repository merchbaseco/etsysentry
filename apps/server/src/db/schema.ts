import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const trackedListingTrackingStateEnum = pgEnum('tracked_listing_tracking_state', [
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
        title: text('title').notNull(),
        url: text('url'),
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
