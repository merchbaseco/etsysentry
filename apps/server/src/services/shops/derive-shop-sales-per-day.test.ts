import { describe, expect, test } from 'bun:test';
import { deriveShopSalesPerDay } from './derive-shop-sales-per-day';

describe('deriveShopSalesPerDay', () => {
    test('computes sales per day from shop sold delta history', () => {
        const result = deriveShopSalesPerDay({
            snapshots: [
                {
                    observedAt: new Date('2026-03-05T10:00:00.000Z'),
                    soldDelta: 4,
                },
                {
                    observedAt: new Date('2026-03-04T10:00:00.000Z'),
                    soldDelta: 2,
                },
                {
                    observedAt: new Date('2026-03-03T10:00:00.000Z'),
                    soldDelta: 0,
                },
                {
                    observedAt: new Date('2026-03-02T10:00:00.000Z'),
                    soldDelta: null,
                },
            ],
        });

        expect(result).toEqual({
            coverageDays: 4,
            value: 1.5,
            windowDays: 30,
        });
    });

    test('uses one snapshot per day and clamps negative sold deltas to zero', () => {
        const result = deriveShopSalesPerDay({
            snapshots: [
                {
                    observedAt: new Date('2026-03-05T12:00:00.000Z'),
                    soldDelta: -3,
                },
                {
                    observedAt: new Date('2026-03-05T08:00:00.000Z'),
                    soldDelta: 8,
                },
                {
                    observedAt: new Date('2026-03-04T08:00:00.000Z'),
                    soldDelta: 2,
                },
            ],
        });

        expect(result).toEqual({
            coverageDays: 2,
            value: 1,
            windowDays: 30,
        });
    });
});
