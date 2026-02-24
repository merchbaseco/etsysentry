import { trackedShopSnapshots, trackedShops } from '../../db/schema';

export const DAILY_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type TrackedShopLatestSnapshot = {
    activeListingCount: number;
    favoritesDelta: number | null;
    favoritesTotal: number | null;
    newListingCount: number;
    observedAt: string;
    reviewDelta: number | null;
    reviewTotal: number | null;
    soldDelta: number | null;
    soldTotal: number | null;
};

export type TrackedShopRecord = {
    id: string;
    accountId: string;
    etsyShopId: string;
    shopName: string;
    shopUrl: string | null;
    trackingState: (typeof trackedShops.$inferSelect)['trackingState'];
    syncState: (typeof trackedShops.$inferSelect)['syncState'];
    lastRefreshedAt: string;
    nextSyncAt: string;
    lastRefreshError: string | null;
    lastSyncedListingUpdatedTimestamp: number | null;
    updatedAt: string;
    latestSnapshot: TrackedShopLatestSnapshot | null;
};

const toLatestSnapshot = (
    row: typeof trackedShopSnapshots.$inferSelect
): TrackedShopLatestSnapshot => {
    return {
        activeListingCount: row.activeListingCount,
        favoritesDelta: row.favoritesDelta,
        favoritesTotal: row.favoritesTotal,
        newListingCount: row.newListingCount,
        observedAt: row.observedAt.toISOString(),
        reviewDelta: row.reviewDelta,
        reviewTotal: row.reviewTotal,
        soldDelta: row.soldDelta,
        soldTotal: row.soldTotal
    };
};

export const toTrackedShopRecord = (params: {
    row: typeof trackedShops.$inferSelect;
    latestSnapshot: typeof trackedShopSnapshots.$inferSelect | null;
}): TrackedShopRecord => {
    return {
        id: params.row.trackedShopId,
        accountId: params.row.accountId,
        etsyShopId: params.row.etsyShopId,
        shopName: params.row.shopName,
        shopUrl: params.row.shopUrl,
        trackingState: params.row.trackingState,
        syncState: params.row.syncState,
        lastRefreshedAt: params.row.lastRefreshedAt.toISOString(),
        nextSyncAt: params.row.nextSyncAt.toISOString(),
        lastRefreshError: params.row.lastRefreshError,
        lastSyncedListingUpdatedTimestamp: params.row.lastSyncedListingUpdatedTimestamp,
        updatedAt: params.row.updatedAt.toISOString(),
        latestSnapshot: params.latestSnapshot ? toLatestSnapshot(params.latestSnapshot) : null
    };
};
