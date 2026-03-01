import { describe, expect, test } from 'bun:test';
import { toListingSignalTimestampsByListingId } from './list-shop-activity-listings';

describe('toListingSignalTimestampsByListingId', () => {
    test('detects the most recent sold and favorited signals', () => {
        const rows = [
            {
                listingId: 'listing-a',
                observedAt: new Date('2026-02-04T00:00:00.000Z'),
                quantity: 8,
                favorerCount: 21,
            },
            {
                listingId: 'listing-a',
                observedAt: new Date('2026-02-03T00:00:00.000Z'),
                quantity: 10,
                favorerCount: 19,
            },
            {
                listingId: 'listing-a',
                observedAt: new Date('2026-02-02T00:00:00.000Z'),
                quantity: 10,
                favorerCount: 18,
            },
            {
                listingId: 'listing-b',
                observedAt: new Date('2026-02-04T00:00:00.000Z'),
                quantity: 12,
                favorerCount: 7,
            },
            {
                listingId: 'listing-b',
                observedAt: new Date('2026-02-03T00:00:00.000Z'),
                quantity: 12,
                favorerCount: 7,
            },
        ];

        const signalByListingId = toListingSignalTimestampsByListingId(rows);

        expect(signalByListingId.get('listing-a')).toEqual({
            lastSoldAtMs: new Date('2026-02-04T00:00:00.000Z').getTime(),
            lastFavoritedAtMs: new Date('2026-02-04T00:00:00.000Z').getTime(),
        });
        expect(signalByListingId.get('listing-b')).toEqual({
            lastSoldAtMs: null,
            lastFavoritedAtMs: null,
        });
    });
});
