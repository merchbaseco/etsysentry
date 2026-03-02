import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { trackedShopSnapshots, trackedShops } from '../../db/schema';
import { deriveShopFavoritesPerDay } from './derive-shop-favorites-per-day';
import { deriveShopSalesPerDay } from './derive-shop-sales-per-day';

const shopMetricHistoryPointLimit = 30;
const oneDayMs = 86_400_000;

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

export interface ShopActivityMetricHistoryPoint {
    activeListingCount: number;
    favoritesDelta: number;
    favoritesTotal: number | null;
    observedAt: string;
    soldDelta: number;
    soldTotal: number | null;
}

export interface ShopActivityDerivedSalesPerDay {
    coverageDays: number;
    value: number | null;
    windowDays: number;
}

export interface ShopActivityDerivedFavoritesPerDay {
    coverageDays: number;
    value: number | null;
    windowDays: number;
}

export interface ShopActivityOverview {
    avatarUrl: string | null;
    derivedFavoritesPerDay: ShopActivityDerivedFavoritesPerDay | null;
    derivedSalesPerDay: ShopActivityDerivedSalesPerDay | null;
    lastRefreshedAt: string | null;
    latestSnapshot: ShopActivityLatestSnapshot | null;
    locationLabel: string | null;
    metadataError: string | null;
    metricHistory: ShopActivityMetricHistoryPoint[];
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

interface ShopActivitySnapshotRow {
    activeListingCount: number;
    favoritesDelta: number | null;
    favoritesTotal: number | null;
    newListingCount: number;
    observedAt: Date;
    reviewDelta: number | null;
    reviewTotal: number | null;
    soldDelta: number | null;
    soldTotal: number | null;
}

const toUtcDayKey = (value: Date): string => {
    return value.toISOString().slice(0, 10);
};

const toUtcDayStart = (value: Date): Date => {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
};

const toShopActivityLatestSnapshot = (
    row: ShopActivitySnapshotRow | null
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

export const toShopActivityMetricHistory = (params: {
    referenceDate: Date;
    rows: ShopActivitySnapshotRow[];
}): ShopActivityMetricHistoryPoint[] => {
    const rowByDay = new Map<string, ShopActivitySnapshotRow>();

    for (const row of params.rows) {
        const dayKey = toUtcDayKey(row.observedAt);

        if (!rowByDay.has(dayKey)) {
            rowByDay.set(dayKey, row);
        }
    }

    const history: ShopActivityMetricHistoryPoint[] = [];
    const endDay = toUtcDayStart(params.referenceDate);

    for (let index = shopMetricHistoryPointLimit - 1; index >= 0; index -= 1) {
        const day = new Date(endDay.getTime() - index * oneDayMs);
        const dayKey = toUtcDayKey(day);
        const row = rowByDay.get(dayKey);

        history.push({
            activeListingCount: row?.activeListingCount ?? 0,
            favoritesDelta: row?.favoritesDelta ?? 0,
            favoritesTotal: row?.favoritesTotal ?? null,
            observedAt: (row?.observedAt ?? day).toISOString(),
            soldDelta: row?.soldDelta ?? 0,
            soldTotal: row?.soldTotal ?? null,
        });
    }

    return history;
};

export const toShopActivityOverviewResolution = (params: {
    derivedFavoritesPerDay: ShopActivityDerivedFavoritesPerDay | null;
    derivedSalesPerDay: ShopActivityDerivedSalesPerDay | null;
    metricHistory: ShopActivityMetricHistoryPoint[];
    latestSnapshot: ShopActivityLatestSnapshot | null;
    trackedShop: ShopActivityOverviewTrackedShop | null;
}): ShopActivityOverviewResolution => {
    return {
        isTrackedShop: Boolean(params.trackedShop),
        overview: {
            avatarUrl: null,
            derivedFavoritesPerDay: params.derivedFavoritesPerDay,
            derivedSalesPerDay: params.derivedSalesPerDay,
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
            metricHistory: params.metricHistory,
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
    let metricHistory: ShopActivityMetricHistoryPoint[] = [];
    let derivedFavoritesPerDay: ShopActivityDerivedFavoritesPerDay | null = null;
    let derivedSalesPerDay: ShopActivityDerivedSalesPerDay | null = null;

    if (trackedShop) {
        const snapshotRows = await db
            .select()
            .from(trackedShopSnapshots)
            .where(
                and(
                    eq(trackedShopSnapshots.accountId, params.accountId),
                    eq(trackedShopSnapshots.trackedShopId, trackedShop.id)
                )
            )
            .orderBy(desc(trackedShopSnapshots.observedAt))
            .limit(shopMetricHistoryPointLimit * 3);

        const referenceDate = snapshotRows[0]?.observedAt ?? trackedShop.lastRefreshedAt;

        latestSnapshot = toShopActivityLatestSnapshot(snapshotRows[0] ?? null);
        metricHistory = toShopActivityMetricHistory({
            referenceDate,
            rows: snapshotRows,
        });
        derivedSalesPerDay = deriveShopSalesPerDay({
            snapshots: snapshotRows.map((row) => ({
                observedAt: row.observedAt,
                soldDelta: row.soldDelta,
            })),
        });
        derivedFavoritesPerDay = deriveShopFavoritesPerDay({
            snapshots: snapshotRows.map((row) => ({
                favoritesDelta: row.favoritesDelta,
                observedAt: row.observedAt,
            })),
        });
    }

    return toShopActivityOverviewResolution({
        derivedFavoritesPerDay,
        derivedSalesPerDay,
        metricHistory,
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
