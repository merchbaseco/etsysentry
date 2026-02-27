import { describe, expect, test } from 'bun:test';
import { toListingMetricSnapshotInsert, toUtcObservedDate } from './upsert-listing-metric-snapshot';

describe('toUtcObservedDate', () => {
    test('builds UTC calendar day keys', () => {
        expect(toUtcObservedDate(new Date('2026-02-24T23:59:59.999Z'))).toBe('2026-02-24');
        expect(toUtcObservedDate(new Date('2026-02-24T23:59:59.999-08:00'))).toBe('2026-02-25');
    });
});

describe('toListingMetricSnapshotInsert', () => {
    test('maps listing metric values and preserves Etsy currency fields', () => {
        const observedAt = new Date('2026-02-24T10:11:12.000Z');
        const values = toListingMetricSnapshotInsert({
            accountId: 'account_123',
            listingId: 'listing_123',
            observedAt,
            views: 1500,
            favorerCount: 120,
            quantity: 8,
            priceAmount: 2499,
            priceDivisor: 100,
            priceCurrencyCode: 'EUR',
        });

        expect(values.observedDate).toBe('2026-02-24');
        expect(values.observedAt.toISOString()).toBe('2026-02-24T10:11:12.000Z');
        expect(values.views).toBe(1500);
        expect(values.favorerCount).toBe(120);
        expect(values.quantity).toBe(8);
        expect(values.priceAmount).toBe(2499);
        expect(values.priceDivisor).toBe(100);
        expect(values.priceCurrencyCode).toBe('EUR');
    });
});
