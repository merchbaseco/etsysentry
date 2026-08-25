import type {
    accounts,
    currencyRates,
    etsyApiCallEvents,
    eventLogs,
    listingMetricSnapshots,
    listingTags,
    productKeywordRanks,
    tags,
    trackedKeywords,
    trackedListings,
    trackedShopListings,
    trackedShopSnapshots,
    trackedShops,
} from '../db/schema';

export interface DevSeedOptions {
    accountId: string;
    dayCount: number;
    keywordCount: number;
    listingCount: number;
    merchbaseUserId: string;
    now: Date;
    seed: string;
}

/** A seeded shop, shared by the listing, shop, and event builders. */
export interface SeedShop {
    etsyShopId: string;
    isOwnShop: boolean;
    shopName: string;
    shopUrl: string;
    trackedShopId: string;
}

/**
 * A seeded listing as the builders see it. `demand` is the listing's share of
 * the account's traffic, which is what gives the dataset a head and a long tail
 * instead of a flat line.
 */
export interface SeedListing {
    currencyCode: string;
    demand: number;
    etsyListingId: string;
    isTrackedShopListing: boolean;
    listingId: string;
    shop: SeedShop;
    title: string;
}

export interface DevSeedPlan {
    account: typeof accounts.$inferInsert;
    accountId: string;
    apiCallEvents: (typeof etsyApiCallEvents.$inferInsert)[];
    currencyRate: typeof currencyRates.$inferInsert;
    eventLogs: (typeof eventLogs.$inferInsert)[];
    keywordRanks: (typeof productKeywordRanks.$inferInsert)[];
    listingSnapshots: (typeof listingMetricSnapshots.$inferInsert)[];
    listings: SeedListing[];
    listingTags: (typeof listingTags.$inferInsert)[];
    shopListings: (typeof trackedShopListings.$inferInsert)[];
    shopSnapshots: (typeof trackedShopSnapshots.$inferInsert)[];
    summary: Record<string, number>;
    tags: (typeof tags.$inferInsert)[];
    trackedKeywords: (typeof trackedKeywords.$inferInsert)[];
    trackedListings: (typeof trackedListings.$inferInsert)[];
    trackedShops: (typeof trackedShops.$inferInsert)[];
}
