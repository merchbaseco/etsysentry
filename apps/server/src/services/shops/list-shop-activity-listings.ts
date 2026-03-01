import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { listingMetricSnapshots, trackedShops } from '../../db/schema';
import {
    listTrackedListings,
    type TrackedListingRecord,
} from '../listings/tracked-listings-service';

export const shopActivitySortOrders = [
    'most_recently_sold',
    'most_recently_favorited',
    'newest_listings',
] as const;

export type ShopActivitySortOrder = (typeof shopActivitySortOrders)[number];

interface ListingSignalSnapshotRow {
    favorerCount: number | null;
    listingId: string;
    observedAt: Date;
    quantity: number | null;
}

interface ListingSignalTimestamp {
    lastFavoritedAtMs: number | null;
    lastSoldAtMs: number | null;
}

export interface ShopActivityListingsResult {
    etsyShopId: string;
    isTrackedShop: boolean;
    items: TrackedListingRecord[];
    shopName: string | null;
    sortOrder: ShopActivitySortOrder;
}

const compareNullableNumberDesc = (left: number | null, right: number | null): number => {
    if (left === right) {
        return 0;
    }

    if (left === null) {
        return 1;
    }

    if (right === null) {
        return -1;
    }

    return right - left;
};

const compareListingsForFallbackOrder = (
    left: TrackedListingRecord,
    right: TrackedListingRecord
): number => {
    const updatedTimestampDelta = (right.updatedTimestamp ?? 0) - (left.updatedTimestamp ?? 0);

    if (updatedTimestampDelta !== 0) {
        return updatedTimestampDelta;
    }

    const updatedAtDelta = right.updatedAt.localeCompare(left.updatedAt);

    if (updatedAtDelta !== 0) {
        return updatedAtDelta;
    }

    return right.id.localeCompare(left.id);
};

export const toListingSignalTimestampsByListingId = (
    rows: ListingSignalSnapshotRow[]
): Map<string, ListingSignalTimestamp> => {
    const signalByListingId = new Map<string, ListingSignalTimestamp>();
    const previousByListingId = new Map<string, ListingSignalSnapshotRow>();

    for (const row of rows) {
        const previous = previousByListingId.get(row.listingId);
        const existing = signalByListingId.get(row.listingId) ?? {
            lastSoldAtMs: null,
            lastFavoritedAtMs: null,
        };

        if (previous) {
            if (
                existing.lastSoldAtMs === null &&
                previous.quantity !== null &&
                row.quantity !== null &&
                previous.quantity < row.quantity
            ) {
                existing.lastSoldAtMs = previous.observedAt.getTime();
            }

            if (
                existing.lastFavoritedAtMs === null &&
                previous.favorerCount !== null &&
                row.favorerCount !== null &&
                previous.favorerCount > row.favorerCount
            ) {
                existing.lastFavoritedAtMs = previous.observedAt.getTime();
            }
        }

        signalByListingId.set(row.listingId, existing);
        previousByListingId.set(row.listingId, row);
    }

    return signalByListingId;
};

const sortListingsBySignal = (params: {
    items: TrackedListingRecord[];
    signalByListingId: Map<string, ListingSignalTimestamp>;
    sortOrder: Extract<ShopActivitySortOrder, 'most_recently_favorited' | 'most_recently_sold'>;
}): TrackedListingRecord[] => {
    return [...params.items].sort((left, right) => {
        const leftSignal = params.signalByListingId.get(left.id) ?? {
            lastFavoritedAtMs: null,
            lastSoldAtMs: null,
        };
        const rightSignal = params.signalByListingId.get(right.id) ?? {
            lastFavoritedAtMs: null,
            lastSoldAtMs: null,
        };

        const signalDelta =
            params.sortOrder === 'most_recently_sold'
                ? compareNullableNumberDesc(leftSignal.lastSoldAtMs, rightSignal.lastSoldAtMs)
                : compareNullableNumberDesc(
                      leftSignal.lastFavoritedAtMs,
                      rightSignal.lastFavoritedAtMs
                  );

        if (signalDelta !== 0) {
            return signalDelta;
        }

        return compareListingsForFallbackOrder(left, right);
    });
};

export const listShopActivityListings = async (params: {
    accountId: string;
    etsyShopId: string;
    sortOrder: ShopActivitySortOrder;
}): Promise<ShopActivityListingsResult> => {
    const [trackedShop] = await db
        .select({
            shopName: trackedShops.shopName,
        })
        .from(trackedShops)
        .where(
            and(
                eq(trackedShops.accountId, params.accountId),
                eq(trackedShops.etsyShopId, params.etsyShopId)
            )
        )
        .limit(1);

    const listingsResponse = await listTrackedListings({
        accountId: params.accountId,
    });

    const shopItems = listingsResponse.items.filter((item) => item.shopId === params.etsyShopId);
    const isTrackedShop = Boolean(trackedShop);
    const resolvedShopName = trackedShop?.shopName ?? shopItems[0]?.shopName ?? null;

    let items = shopItems;

    if (params.sortOrder !== 'newest_listings' && shopItems.length > 0) {
        const snapshotRows = await db
            .select({
                favorerCount: listingMetricSnapshots.favorerCount,
                listingId: listingMetricSnapshots.listingId,
                observedAt: listingMetricSnapshots.observedAt,
                quantity: listingMetricSnapshots.quantity,
            })
            .from(listingMetricSnapshots)
            .where(
                and(
                    eq(listingMetricSnapshots.accountId, params.accountId),
                    inArray(
                        listingMetricSnapshots.listingId,
                        shopItems.map((item) => item.id)
                    )
                )
            )
            .orderBy(
                asc(listingMetricSnapshots.listingId),
                desc(listingMetricSnapshots.observedAt)
            );

        const signalByListingId = toListingSignalTimestampsByListingId(snapshotRows);
        items = sortListingsBySignal({
            items: shopItems,
            signalByListingId,
            sortOrder: params.sortOrder,
        });
    }

    return {
        etsyShopId: params.etsyShopId,
        isTrackedShop,
        items,
        shopName: resolvedShopName,
        sortOrder: params.sortOrder,
    };
};
