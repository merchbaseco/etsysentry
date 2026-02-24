import { describe, expect, test } from 'bun:test';
import {
    buildTrackedListingDiscoveryValues,
    computeNextKeywordSyncAt
} from './keyword-rankings-service';

describe('computeNextKeywordSyncAt', () => {
    test('schedules next sync exactly one day later', () => {
        const now = new Date('2026-02-23T12:34:56.000Z');
        const nextSyncAt = computeNextKeywordSyncAt(now);

        expect(nextSyncAt.toISOString()).toBe('2026-02-24T12:34:56.000Z');
    });
});

describe('buildTrackedListingDiscoveryValues', () => {
    test('maps ranked listing fields into tracked listing discovery values', () => {
        const now = new Date('2026-02-23T12:00:00.000Z');

        const result = buildTrackedListingDiscoveryValues({
            clerkUserId: 'user_123',
            now,
            rankedListing: {
                listingId: '1234567890',
                price: {
                    amount: 2599,
                    currencyCode: 'USD',
                    divisor: 100
                },
                listingType: 'physical',
                shopId: '99887766',
                thumbnailUrl: 'https://i.etsystatic.com/123/il/abc123/1234567890/il_170x135.jpg',
                title: 'Mid Century Wall Art',
                url: 'https://www.etsy.com/listing/1234567890/mid-century-wall-art'
            },
            accountId: 'tenant_123'
        });

        expect(result).toEqual({
            etsyListingId: '1234567890',
            etsyState: 'active',
            isDigital: false,
            shopId: '99887766',
            accountId: 'tenant_123',
            thumbnailUrl: 'https://i.etsystatic.com/123/il/abc123/1234567890/il_170x135.jpg',
            title: 'Mid Century Wall Art',
            trackerClerkUserId: 'user_123',
            trackingState: 'active',
            updatedAt: now,
            url: 'https://www.etsy.com/listing/1234567890/mid-century-wall-art'
        });
    });

    test('sets nullable discovery fields when ranked listing omits optional values', () => {
        const now = new Date('2026-02-23T12:00:00.000Z');

        const result = buildTrackedListingDiscoveryValues({
            clerkUserId: 'user_123',
            now,
            rankedListing: {
                listingId: '1234567890',
                listingType: null,
                price: null,
                shopId: null,
                thumbnailUrl: null,
                title: 'Sample Title',
                url: null
            },
            accountId: 'tenant_123'
        });

        expect(result.shopId).toBeNull();
        expect(result.thumbnailUrl).toBeNull();
        expect(result.url).toBeNull();
        expect(result.isDigital).toBe(false);
    });

    test('keeps active tracking state for digital listings', () => {
        const now = new Date('2026-02-23T12:00:00.000Z');

        const result = buildTrackedListingDiscoveryValues({
            clerkUserId: 'user_123',
            now,
            rankedListing: {
                listingId: '1234567890',
                listingType: 'download',
                price: null,
                shopId: null,
                thumbnailUrl: null,
                title: 'Sample Title',
                url: null
            },
            accountId: 'tenant_123'
        });

        expect(result.trackingState).toBe('active');
        expect(result.isDigital).toBe(true);
    });
});
