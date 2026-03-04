import { describe, expect, test } from 'bun:test';
import type { GetTrackedListingMetricHistoryOutput } from '@/lib/listings-api';
import { resolveListingNextRefresh } from './listing-refresh-schedule';

type ListingHistoryItem = GetTrackedListingMetricHistoryOutput['items'][number];

const toHistoryItem = (
    overrides: Partial<ListingHistoryItem> & Pick<ListingHistoryItem, 'observedDate'>
): ListingHistoryItem => {
    return {
        endingTimestamp: null,
        estimatedSoldCount: 0,
        estimatedSoldDelta: 0,
        favorerCount: null,
        observedAt: `${overrides.observedDate}T00:00:00.000Z`,
        observedDate: overrides.observedDate,
        price: null,
        quantity: null,
        views: null,
        ...overrides,
    };
};

describe('resolveListingNextRefresh', () => {
    test('returns in progress while sync is queued', () => {
        const result = resolveListingNextRefresh({
            historyItems: [],
            item: {
                isDigital: false,
                lastRefreshedAt: '2026-03-01T00:00:00.000Z',
                syncState: 'queued',
                trackingState: 'active',
            },
        });

        expect(result).toEqual({
            kind: 'in_progress',
        });
    });

    test('returns paused for paused physical listings', () => {
        const result = resolveListingNextRefresh({
            historyItems: [],
            item: {
                isDigital: false,
                lastRefreshedAt: '2026-03-01T00:00:00.000Z',
                syncState: 'idle',
                trackingState: 'paused',
            },
        });

        expect(result).toEqual({
            kind: 'paused',
        });
    });

    test('schedules 1d cadence when recent momentum exists', () => {
        const now = new Date('2026-03-04T00:00:00.000Z');
        const result = resolveListingNextRefresh({
            now,
            historyItems: [
                toHistoryItem({
                    observedDate: '2026-03-03',
                    favorerCount: 12,
                    quantity: 8,
                }),
                toHistoryItem({
                    observedDate: '2026-03-02',
                    favorerCount: 10,
                    quantity: 8,
                }),
            ],
            item: {
                isDigital: false,
                lastRefreshedAt: '2026-03-03T06:00:00.000Z',
                syncState: 'idle',
                trackingState: 'active',
            },
        });

        expect(result).toEqual({
            kind: 'scheduled',
            cadenceTier: '1d',
            at: '2026-03-04T06:00:00.000Z',
        });
    });

    test('schedules 7d cadence when history is quiet for at least fourteen days', () => {
        const now = new Date('2026-03-04T00:00:00.000Z');
        const result = resolveListingNextRefresh({
            now,
            historyItems: [
                toHistoryItem({
                    observedDate: '2026-03-03',
                    favorerCount: 10,
                    quantity: 8,
                }),
                toHistoryItem({
                    observedDate: '2026-02-17',
                    favorerCount: 10,
                    quantity: 8,
                }),
            ],
            item: {
                isDigital: false,
                lastRefreshedAt: '2026-03-03T06:00:00.000Z',
                syncState: 'idle',
                trackingState: 'active',
            },
        });

        expect(result).toEqual({
            kind: 'scheduled',
            cadenceTier: '7d',
            at: '2026-03-10T06:00:00.000Z',
        });
    });
});
