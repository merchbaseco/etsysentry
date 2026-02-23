import { describe, expect, test } from 'bun:test';
import {
    buildTrackedListingUpsertValues,
    computeNextKeywordSyncAt
} from './keyword-rankings-service';

describe('computeNextKeywordSyncAt', () => {
    test('schedules next sync exactly one day later', () => {
        const now = new Date('2026-02-23T12:34:56.000Z');
        const nextSyncAt = computeNextKeywordSyncAt(now);

        expect(nextSyncAt.toISOString()).toBe('2026-02-24T12:34:56.000Z');
    });
});

describe('buildTrackedListingUpsertValues', () => {
    test('maps ranked listing fields into tracked listing upsert values', () => {
        const now = new Date('2026-02-23T12:00:00.000Z');

        const result = buildTrackedListingUpsertValues({
            clerkUserId: 'user_123',
            now,
            rankedListing: {
                listingId: '1234567890',
                price: {
                    amount: 2599,
                    currencyCode: 'USD',
                    divisor: 100
                },
                shopId: '99887766',
                title: 'Mid Century Wall Art',
                url: 'https://www.etsy.com/listing/1234567890/mid-century-wall-art'
            },
            tenantId: 'tenant_123'
        });

        expect(result).toEqual({
            etsyListingId: '1234567890',
            etsyState: 'active',
            lastRefreshError: null,
            lastRefreshedAt: now,
            numFavorers: null,
            priceAmount: 2599,
            priceCurrencyCode: 'USD',
            priceDivisor: 100,
            quantity: null,
            shopId: '99887766',
            shopName: null,
            tenantId: 'tenant_123',
            thumbnailUrl: null,
            title: 'Mid Century Wall Art',
            trackerClerkUserId: 'user_123',
            trackingState: 'active',
            updatedAt: now,
            updatedTimestamp: null,
            url: 'https://www.etsy.com/listing/1234567890/mid-century-wall-art',
            views: null
        });
    });

    test('sets nullable fields when ranked listing omits optional values', () => {
        const now = new Date('2026-02-23T12:00:00.000Z');

        const result = buildTrackedListingUpsertValues({
            clerkUserId: 'user_123',
            now,
            rankedListing: {
                listingId: '1234567890',
                price: null,
                shopId: null,
                title: 'Sample Title',
                url: null
            },
            tenantId: 'tenant_123'
        });

        expect(result.priceAmount).toBeNull();
        expect(result.priceCurrencyCode).toBeNull();
        expect(result.priceDivisor).toBeNull();
        expect(result.shopId).toBeNull();
        expect(result.url).toBeNull();
    });
});
