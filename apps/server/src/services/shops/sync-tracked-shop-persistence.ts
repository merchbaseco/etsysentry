import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { trackedListings, trackedShopListings } from '../../db/schema';
import { isExcludedDigitalListingType } from '../listings/is-excluded-digital-listing-type';
import type { ShopListingResult } from './sync-tracked-shop-fetch';

const DB_BATCH_SIZE = 500;

const chunkArray = <T>(items: T[], size: number): T[][] => {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }

    return chunks;
};

export const computeDelta = (current: number | null, previous: number | null): number | null => {
    if (current === null || previous === null) {
        return null;
    }

    return current - previous;
};

export const computeNextWatermark = (params: {
    changedListings: ShopListingResult[];
    previousWatermark: number | null;
}): number | null => {
    const maxUpdatedTimestamp = params.changedListings.reduce<number | null>((currentMax, listing) => {
        if (listing.updatedTimestamp === null) {
            return currentMax;
        }

        if (currentMax === null) {
            return listing.updatedTimestamp;
        }

        return Math.max(currentMax, listing.updatedTimestamp);
    }, null);

    if (maxUpdatedTimestamp === null) {
        return params.previousWatermark;
    }

    if (params.previousWatermark === null) {
        return maxUpdatedTimestamp;
    }

    return Math.max(params.previousWatermark, maxUpdatedTimestamp);
};

export const upsertTrackedShopListings = async (params: {
    now: Date;
    accountId: string;
    trackedShopId: string;
    etsyShopId: string;
    listings: ShopListingResult[];
}): Promise<number> => {
    const encounteredListingIds = params.listings.map((item) => item.listingId);

    if (encounteredListingIds.length === 0) {
        return 0;
    }

    const existingListingIds = new Set<string>();

    for (const listingIdChunk of chunkArray(encounteredListingIds, DB_BATCH_SIZE)) {
        const rows = await db
            .select({
                etsyListingId: trackedShopListings.etsyListingId
            })
            .from(trackedShopListings)
            .where(
                and(
                    eq(trackedShopListings.accountId, params.accountId),
                    eq(trackedShopListings.trackedShopId, params.trackedShopId),
                    inArray(trackedShopListings.etsyListingId, listingIdChunk)
                )
            );

        for (const row of rows) {
            existingListingIds.add(row.etsyListingId);
        }
    }

    const newListingCount = encounteredListingIds.filter((id) => !existingListingIds.has(id)).length;

    for (const listingChunk of chunkArray(params.listings, DB_BATCH_SIZE)) {
        await db
            .insert(trackedShopListings)
            .values(
                listingChunk.map((listing) => ({
                    accountId: params.accountId,
                    trackedShopId: params.trackedShopId,
                    etsyShopId: params.etsyShopId,
                    etsyListingId: listing.listingId,
                    listingUpdatedTimestamp: listing.updatedTimestamp,
                    isActive: true,
                    firstSeenAt: params.now,
                    lastSeenAt: params.now,
                    lastChangedAt: params.now,
                    createdAt: params.now,
                    updatedAt: params.now
                }))
            )
            .onConflictDoUpdate({
                set: {
                    etsyShopId: params.etsyShopId,
                    isActive: true,
                    lastSeenAt: params.now,
                    lastChangedAt: sql`CASE
                        WHEN ${trackedShopListings.isActive} = false
                            THEN ${params.now}
                        ELSE ${trackedShopListings.lastChangedAt}
                    END`,
                    listingUpdatedTimestamp: sql`excluded.listing_updated_timestamp`,
                    updatedAt: params.now
                },
                target: [
                    trackedShopListings.accountId,
                    trackedShopListings.trackedShopId,
                    trackedShopListings.etsyListingId
                ]
            });
    }

    return newListingCount;
};

export const discoverTrackedListings = async (params: {
    now: Date;
    clerkUserId: string;
    accountId: string;
    etsyShopId: string;
    listings: ShopListingResult[];
}): Promise<Array<{ listingId: string; etsyListingId: string }>> => {
    const insertedRows: Array<{ listingId: string; etsyListingId: string }> = [];
    const listingByEtsyListingId = new Map(
        params.listings.map((listing) => [listing.listingId, listing])
    );

    for (const listingChunk of chunkArray(params.listings, DB_BATCH_SIZE)) {
        const rows = await db
            .insert(trackedListings)
            .values(
                listingChunk.map((listing) => ({
                    accountId: params.accountId,
                    etsyListingId: listing.listingId,
                    etsyState: listing.etsyState ?? 'active',
                    isDigital: isExcludedDigitalListingType(listing.listingType),
                    numFavorers: listing.numFavorers,
                    priceAmount: listing.price?.amount ?? null,
                    priceCurrencyCode: listing.price?.currencyCode ?? null,
                    priceDivisor: listing.price?.divisor ?? null,
                    quantity: listing.quantity,
                    shopId: params.etsyShopId,
                    title: listing.title,
                    trackerClerkUserId: params.clerkUserId,
                    trackingState: isExcludedDigitalListingType(listing.listingType)
                        ? ('paused' as const)
                        : ('active' as const),
                    updatedAt: params.now,
                    updatedTimestamp: listing.updatedTimestamp,
                    url: listing.url
                }))
            )
            .onConflictDoNothing({
                target: [trackedListings.accountId, trackedListings.etsyListingId]
            })
            .returning({
                etsyListingId: trackedListings.etsyListingId,
                listingId: trackedListings.listingId
            });

        for (const row of rows) {
            const listing = listingByEtsyListingId.get(row.etsyListingId);

            if (!listing || isExcludedDigitalListingType(listing.listingType)) {
                continue;
            }

            insertedRows.push(row);
        }
    }

    return insertedRows;
};
