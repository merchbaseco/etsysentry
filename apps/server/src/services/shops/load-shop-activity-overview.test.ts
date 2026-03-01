import { describe, expect, test } from 'bun:test';
import {
    type ShopActivityLatestSnapshot,
    toShopActivityOverviewResolution,
} from './load-shop-activity-overview';

describe('toShopActivityOverviewResolution', () => {
    test('returns untracked defaults when no tracked shop exists', () => {
        const response = toShopActivityOverviewResolution({
            latestSnapshot: null,
            trackedShop: null,
        });

        expect(response).toEqual({
            isTrackedShop: false,
            overview: {
                avatarUrl: null,
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
        expect(response.overview.latestSnapshot).toEqual(latestSnapshot);
    });
});
