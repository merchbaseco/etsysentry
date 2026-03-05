import { describe, expect, test } from 'bun:test';
import {
    filterPublicKeywordItems,
    filterPublicListingItems,
    filterPublicShopItems,
    filterPublicShopListingItems,
    publicKeywordsListInputSchema,
    publicListingsListInputSchema,
    publicShopListingsFilterInputSchema,
    publicShopsListInputSchema,
} from './list-filters';

describe('public list filter schemas', () => {
    test('parses shared pagination values from query-like input', () => {
        expect(
            publicKeywordsListInputSchema.parse({
                limit: '2',
                offset: '1',
            })
        ).toEqual({
            limit: 2,
            offset: 1,
        });
    });
});

describe('filterPublicKeywordItems', () => {
    test('applies search/state filters before pagination', () => {
        const input = publicKeywordsListInputSchema.parse({
            limit: 1,
            offset: 1,
            search: 'wall',
            syncState: 'queued',
            trackingState: 'active',
        });

        const items = filterPublicKeywordItems(
            [
                {
                    accountId: 'a',
                    id: '1',
                    keyword: 'wall art print',
                    lastRefreshError: null,
                    lastRefreshedAt: '2026-01-01T00:00:00.000Z',
                    nextSyncAt: '2026-01-02T00:00:00.000Z',
                    normalizedKeyword: 'wall art print',
                    syncState: 'queued',
                    trackerClerkUserId: 'u',
                    trackingState: 'active',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                },
                {
                    accountId: 'a',
                    id: '2',
                    keyword: 'wall mirror',
                    lastRefreshError: null,
                    lastRefreshedAt: '2026-01-01T00:00:00.000Z',
                    nextSyncAt: '2026-01-02T00:00:00.000Z',
                    normalizedKeyword: 'wall mirror',
                    syncState: 'queued',
                    trackerClerkUserId: 'u',
                    trackingState: 'active',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                },
            ],
            input
        );

        expect(items).toHaveLength(1);
        expect(items[0]?.id).toBe('2');
    });
});

describe('filterPublicListingItems', () => {
    test('hides digital listings when showDigital is false', () => {
        const input = publicListingsListInputSchema.parse({
            showDigital: false,
            trackingState: 'active',
        });

        const items = filterPublicListingItems(
            [
                {
                    etsyListingId: '100',
                    isDigital: true,
                    shopName: 'Shop A',
                    syncState: 'idle',
                    title: 'Digital Pattern',
                    trackingState: 'active',
                },
                {
                    etsyListingId: '200',
                    isDigital: false,
                    shopName: 'Shop B',
                    syncState: 'idle',
                    title: 'Physical Print',
                    trackingState: 'active',
                },
            ],
            input
        );

        expect(items).toHaveLength(1);
        expect(items[0]?.etsyListingId).toBe('200');
    });
});

describe('filterPublicShopItems', () => {
    test('matches shop search against name and etsy shop id', () => {
        const input = publicShopsListInputSchema.parse({
            search: 'studio',
        });

        const items = filterPublicShopItems(
            [
                {
                    accountId: 'a',
                    etsyShopId: '101',
                    id: 's1',
                    lastRefreshError: null,
                    lastRefreshedAt: '2026-01-01T00:00:00.000Z',
                    lastSyncedListingUpdatedTimestamp: null,
                    latestSnapshot: null,
                    nextSyncAt: '2026-01-02T00:00:00.000Z',
                    shopName: 'La Paz Studio',
                    shopUrl: null,
                    syncState: 'idle',
                    trackingState: 'active',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                },
                {
                    accountId: 'a',
                    etsyShopId: '202',
                    id: 's2',
                    lastRefreshError: null,
                    lastRefreshedAt: '2026-01-01T00:00:00.000Z',
                    lastSyncedListingUpdatedTimestamp: null,
                    latestSnapshot: null,
                    nextSyncAt: '2026-01-02T00:00:00.000Z',
                    shopName: 'North Market',
                    shopUrl: null,
                    syncState: 'idle',
                    trackingState: 'active',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                },
            ],
            input
        );

        expect(items).toHaveLength(1);
        expect(items[0]?.id).toBe('s1');
    });
});

describe('filterPublicShopListingItems', () => {
    test('applies listing filters and pagination for shop listing responses', () => {
        const input = publicShopListingsFilterInputSchema.parse({
            limit: 1,
            offset: 0,
            syncState: 'queued',
            trackingState: 'active',
        });

        const items = filterPublicShopListingItems(
            [
                {
                    etsyListingId: '10',
                    isDigital: false,
                    shopName: 'La Paz Studio',
                    syncState: 'queued',
                    title: 'Listing A',
                    trackingState: 'active',
                },
                {
                    etsyListingId: '11',
                    isDigital: false,
                    shopName: 'La Paz Studio',
                    syncState: 'queued',
                    title: 'Listing B',
                    trackingState: 'active',
                },
            ],
            input
        );

        expect(items).toHaveLength(1);
        expect(items[0]?.etsyListingId).toBe('10');
    });
});
