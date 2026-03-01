import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { trackedShopSnapshots, trackedShops } from '../../db/schema';

export interface ShopActivityLatestSnapshot {
    activeListingCount: number;
    favoritesDelta: number | null;
    favoritesTotal: number | null;
    newListingCount: number;
    observedAt: string;
    reviewDelta: number | null;
    reviewTotal: number | null;
    soldDelta: number | null;
    soldTotal: number | null;
}

export interface ShopActivityOverview {
    avatarUrl: string | null;
    lastRefreshedAt: string | null;
    latestSnapshot: ShopActivityLatestSnapshot | null;
    locationLabel: string | null;
    metadataError: string | null;
    nextSyncAt: string | null;
    openedAt: string | null;
    reviewAverage: number | null;
    reviewCount: number | null;
    shopUrl: string | null;
    soldCount: number | null;
    syncState: (typeof trackedShops.$inferSelect)['syncState'] | null;
    trackingState: (typeof trackedShops.$inferSelect)['trackingState'] | null;
}

export interface ShopActivityOverviewResolution {
    isTrackedShop: boolean;
    overview: ShopActivityOverview;
    shopName: string | null;
}

interface ShopActivityOverviewTrackedShop {
    lastRefreshedAt: string;
    nextSyncAt: string;
    shopName: string;
    shopUrl: string | null;
    syncState: (typeof trackedShops.$inferSelect)['syncState'];
    trackingState: (typeof trackedShops.$inferSelect)['trackingState'];
}

const toShopActivityLatestSnapshot = (
    row: typeof trackedShopSnapshots.$inferSelect | null
): ShopActivityLatestSnapshot | null => {
    if (!row) {
        return null;
    }

    return {
        activeListingCount: row.activeListingCount,
        favoritesDelta: row.favoritesDelta,
        favoritesTotal: row.favoritesTotal,
        newListingCount: row.newListingCount,
        observedAt: row.observedAt.toISOString(),
        reviewDelta: row.reviewDelta,
        reviewTotal: row.reviewTotal,
        soldDelta: row.soldDelta,
        soldTotal: row.soldTotal,
    };
};

export const toShopActivityOverviewResolution = (params: {
    latestSnapshot: ShopActivityLatestSnapshot | null;
    trackedShop: ShopActivityOverviewTrackedShop | null;
}): ShopActivityOverviewResolution => {
    return {
        isTrackedShop: Boolean(params.trackedShop),
        overview: {
            avatarUrl: null,
            lastRefreshedAt: params.trackedShop?.lastRefreshedAt ?? null,
            latestSnapshot: params.latestSnapshot,
            locationLabel: null,
            metadataError: null,
            nextSyncAt: params.trackedShop?.nextSyncAt ?? null,
            openedAt: null,
            reviewAverage: null,
            reviewCount: params.latestSnapshot?.reviewTotal ?? null,
            shopUrl: params.trackedShop?.shopUrl ?? null,
            soldCount: params.latestSnapshot?.soldTotal ?? null,
            syncState: params.trackedShop?.syncState ?? null,
            trackingState: params.trackedShop?.trackingState ?? null,
        },
        shopName: params.trackedShop?.shopName ?? null,
    };
};

export const loadShopActivityOverview = async (params: {
    accountId: string;
    etsyShopId: string;
}): Promise<ShopActivityOverviewResolution> => {
    const [trackedShop] = await db
        .select({
            id: trackedShops.trackedShopId,
            lastRefreshedAt: trackedShops.lastRefreshedAt,
            nextSyncAt: trackedShops.nextSyncAt,
            shopName: trackedShops.shopName,
            shopUrl: trackedShops.shopUrl,
            syncState: trackedShops.syncState,
            trackingState: trackedShops.trackingState,
        })
        .from(trackedShops)
        .where(
            and(
                eq(trackedShops.accountId, params.accountId),
                eq(trackedShops.etsyShopId, params.etsyShopId)
            )
        )
        .limit(1);

    let latestSnapshot: ShopActivityLatestSnapshot | null = null;

    if (trackedShop) {
        const [snapshotRow] = await db
            .select()
            .from(trackedShopSnapshots)
            .where(
                and(
                    eq(trackedShopSnapshots.accountId, params.accountId),
                    eq(trackedShopSnapshots.trackedShopId, trackedShop.id)
                )
            )
            .orderBy(desc(trackedShopSnapshots.observedAt))
            .limit(1);

        latestSnapshot = toShopActivityLatestSnapshot(snapshotRow ?? null);
    }

    return toShopActivityOverviewResolution({
        latestSnapshot,
        trackedShop: trackedShop
            ? {
                  lastRefreshedAt: trackedShop.lastRefreshedAt.toISOString(),
                  nextSyncAt: trackedShop.nextSyncAt.toISOString(),
                  shopName: trackedShop.shopName,
                  shopUrl: trackedShop.shopUrl,
                  syncState: trackedShop.syncState,
                  trackingState: trackedShop.trackingState,
              }
            : null,
    });
};
