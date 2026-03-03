import { describe, expect, test } from 'bun:test';
import { deriveShopFavoritesPerDay } from './derive-shop-favorites-per-day';

describe('deriveShopFavoritesPerDay', () => {
    test('computes favorites per day from shop favorites delta history', () => {
        const result = deriveShopFavoritesPerDay({
            snapshots: [
                {
                    favoritesDelta: 6,
                    observedAt: new Date('2026-03-05T10:00:00.000Z'),
                },
                {
                    favoritesDelta: 2,
                    observedAt: new Date('2026-03-04T10:00:00.000Z'),
                },
                {
                    favoritesDelta: 0,
                    observedAt: new Date('2026-03-03T10:00:00.000Z'),
                },
                {
                    favoritesDelta: null,
                    observedAt: new Date('2026-03-02T10:00:00.000Z'),
                },
            ],
        });

        expect(result).toEqual({
            coverageDays: 2,
            value: 4,
            windowDays: 30,
        });
    });

    test('uses one snapshot per day and clamps negative favorites deltas to zero', () => {
        const result = deriveShopFavoritesPerDay({
            snapshots: [
                {
                    favoritesDelta: -4,
                    observedAt: new Date('2026-03-05T12:00:00.000Z'),
                },
                {
                    favoritesDelta: 9,
                    observedAt: new Date('2026-03-05T08:00:00.000Z'),
                },
                {
                    favoritesDelta: 3,
                    observedAt: new Date('2026-03-04T08:00:00.000Z'),
                },
            ],
        });

        expect(result).toEqual({
            coverageDays: 1,
            value: 3,
            windowDays: 30,
        });
    });

    test('returns a null estimate when no positive favorites deltas are available', () => {
        const result = deriveShopFavoritesPerDay({
            snapshots: [
                {
                    favoritesDelta: 0,
                    observedAt: new Date('2026-03-05T10:00:00.000Z'),
                },
                {
                    favoritesDelta: null,
                    observedAt: new Date('2026-03-04T10:00:00.000Z'),
                },
            ],
        });

        expect(result).toEqual({
            coverageDays: 0,
            value: null,
            windowDays: 30,
        });
    });
});
