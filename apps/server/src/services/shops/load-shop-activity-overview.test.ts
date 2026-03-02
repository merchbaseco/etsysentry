import { describe, expect, test } from 'bun:test';
import {
    type ShopActivityLatestSnapshot,
    toShopActivityMetricHistory,
    toShopActivityOverviewResolution,
} from './load-shop-activity-overview';

describe('toShopActivityOverviewResolution', () => {
    test('returns untracked defaults when no tracked shop exists', () => {
        const response = toShopActivityOverviewResolution({
            derivedFavoritesPerDay: null,
            derivedSalesPerDay: null,
            metricHistory: [],
            latestSnapshot: null,
            trackedShop: null,
        });

        expect(response).toEqual({
            isTrackedShop: false,
            overview: {
                avatarUrl: null,
                derivedFavoritesPerDay: null,
                derivedSalesPerDay: null,
                lastRefreshedAt: null,
                latestSnapshot: null,
                locationLabel: null,
                metadataError: null,
                nextSyncAt: null,
                openedAt: null,
                reviewAverage: null,
                reviewCount: null,
                shopUrl: null,
                soldCount: null,
                metricHistory: [],
                syncState: null,
                trackingState: null,
            },
            shopName: null,
        });
    });

    test('uses snapshot totals for sold and review counts', () => {
        const latestSnapshot: ShopActivityLatestSnapshot = {
            activeListingCount: 120,
            favoritesDelta: 6,
            favoritesTotal: 2400,
            newListingCount: 8,
            observedAt: '2026-02-28T11:55:00.000Z',
            reviewDelta: 2,
            reviewTotal: 501,
            soldDelta: 11,
            soldTotal: 9800,
        };

        const response = toShopActivityOverviewResolution({
            derivedSalesPerDay: {
                coverageDays: 19,
                value: 1.63,
                windowDays: 30,
            },
            derivedFavoritesPerDay: {
                coverageDays: 19,
                value: 3.42,
                windowDays: 30,
            },
            metricHistory: [
                {
                    activeListingCount: 112,
                    favoritesDelta: 4,
                    favoritesTotal: 2300,
                    observedAt: '2026-02-26T11:55:00.000Z',
                    soldDelta: 5,
                    soldTotal: 9725,
                },
                {
                    activeListingCount: 120,
                    favoritesDelta: 6,
                    favoritesTotal: 2400,
                    observedAt: '2026-02-28T11:55:00.000Z',
                    soldDelta: 11,
                    soldTotal: 9800,
                },
            ],
            latestSnapshot,
            trackedShop: {
                lastRefreshedAt: '2026-02-28T12:00:00.000Z',
                nextSyncAt: '2026-03-01T12:00:00.000Z',
                shopName: 'NicePeopleTees',
                shopUrl: 'https://www.etsy.com/shop/NicePeopleTees',
                syncState: 'idle',
                trackingState: 'active',
            },
        });

        expect(response.isTrackedShop).toBe(true);
        expect(response.shopName).toBe('NicePeopleTees');
        expect(response.overview.soldCount).toBe(9800);
        expect(response.overview.reviewCount).toBe(501);
        expect(response.overview.derivedSalesPerDay).toEqual({
            coverageDays: 19,
            value: 1.63,
            windowDays: 30,
        });
        expect(response.overview.derivedFavoritesPerDay).toEqual({
            coverageDays: 19,
            value: 3.42,
            windowDays: 30,
        });
        expect(response.overview.latestSnapshot).toEqual(latestSnapshot);
        expect(response.overview.metricHistory).toHaveLength(2);
        expect(response.overview.metricHistory[1]?.activeListingCount).toBe(120);
        expect(response.overview.metricHistory[1]?.favoritesDelta).toBe(6);
        expect(response.overview.metricHistory[1]?.soldDelta).toBe(11);
    });
});

describe('toShopActivityMetricHistory', () => {
    test('always returns 30 points padded with empty days', () => {
        const history = toShopActivityMetricHistory({
            referenceDate: new Date('2026-03-04T12:00:00.000Z'),
            rows: [
                {
                    activeListingCount: 44,
                    favoritesDelta: 5,
                    favoritesTotal: 720,
                    newListingCount: 1,
                    observedAt: new Date('2026-03-04T08:00:00.000Z'),
                    reviewDelta: 0,
                    reviewTotal: 102,
                    soldDelta: 2,
                    soldTotal: 1300,
                },
                {
                    activeListingCount: 42,
                    favoritesDelta: 4,
                    favoritesTotal: 700,
                    newListingCount: 0,
                    observedAt: new Date('2026-03-03T08:00:00.000Z'),
                    reviewDelta: 1,
                    reviewTotal: 101,
                    soldDelta: 3,
                    soldTotal: 1298,
                },
                {
                    activeListingCount: 41,
                    favoritesDelta: 2,
                    favoritesTotal: 690,
                    newListingCount: 0,
                    observedAt: new Date('2026-03-01T08:00:00.000Z'),
                    reviewDelta: 1,
                    reviewTotal: 100,
                    soldDelta: 1,
                    soldTotal: 1295,
                },
            ],
        });

        expect(history).toHaveLength(30);
        expect(history[0]?.observedAt).toBe('2026-02-03T00:00:00.000Z');
        expect(history[0]?.activeListingCount).toBe(0);
        expect(history[0]?.favoritesTotal).toBeNull();
        expect(history.at(-1)?.observedAt).toBe('2026-03-04T08:00:00.000Z');
        expect(history.at(-1)?.activeListingCount).toBe(44);
        expect(history.at(-1)?.favoritesDelta).toBe(5);
        expect(history.at(-1)?.soldDelta).toBe(2);
        expect(history.at(-2)?.observedAt).toBe('2026-03-03T08:00:00.000Z');
        expect(history.at(-2)?.favoritesDelta).toBe(4);
        expect(history.at(-2)?.soldDelta).toBe(3);
        expect(history.at(-3)?.observedAt).toBe('2026-03-02T00:00:00.000Z');
        expect(history.at(-3)?.activeListingCount).toBe(0);
        expect(history.at(-3)?.favoritesDelta).toBe(0);
        expect(history.at(-3)?.soldDelta).toBe(0);
    });
});
