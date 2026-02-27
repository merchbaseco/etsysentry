import { describe, expect, test } from 'bun:test';
import {
    computeListingRefreshStaleBefore,
    getListingRefreshCadenceTier,
    isListingAutoRefreshEligible,
    resolveListingRefreshCadenceTierFromSnapshots,
    toListingMomentumSignals,
} from './listing-refresh-cadence';

describe('getListingRefreshCadenceTier', () => {
    test('uses daily cadence for quantity drops', () => {
        const tier = getListingRefreshCadenceTier({
            favorersDelta: 0,
            quantityDrop: 1,
            viewsDelta: 0,
        });

        expect(tier).toBe('1d');
    });

    test('uses daily cadence for favorer growth', () => {
        const tier = getListingRefreshCadenceTier({
            favorersDelta: 1,
            quantityDrop: 0,
            viewsDelta: 0,
        });

        expect(tier).toBe('1d');
    });

    test('uses 3d cadence when there are no sales/favorites signals', () => {
        const tier = getListingRefreshCadenceTier({
            favorersDelta: 0,
            quantityDrop: 0,
            viewsDelta: 5,
        });

        expect(tier).toBe('3d');
    });
});

describe('computeListingRefreshStaleBefore', () => {
    test('computes a 24 hour stale threshold for daily cadence', () => {
        const staleBefore = computeListingRefreshStaleBefore({
            cadenceTier: '1d',
            now: new Date('2026-02-27T12:34:56.000Z'),
        });

        expect(staleBefore.toISOString()).toBe('2026-02-26T12:34:56.000Z');
    });
});

describe('toListingMomentumSignals', () => {
    test('computes non-negative deltas and quantity drop', () => {
        const signals = toListingMomentumSignals({
            latest: {
                observedAt: new Date('2026-02-27T00:00:00.000Z'),
                favorerCount: 10,
                quantity: 8,
                views: 150,
            },
            previous: {
                observedAt: new Date('2026-02-26T00:00:00.000Z'),
                favorerCount: 7,
                quantity: 12,
                views: 100,
            },
        });

        expect(signals).toEqual({
            favorersDelta: 3,
            quantityDrop: 4,
            viewsDelta: 50,
        });
    });
});

describe('resolveListingRefreshCadenceTierFromSnapshots', () => {
    test('defaults to 1d when there is no snapshot baseline yet', () => {
        const tier = resolveListingRefreshCadenceTierFromSnapshots({
            now: new Date('2026-02-27T00:00:00.000Z'),
            snapshots: [],
        });

        expect(tier).toBe('1d');
    });

    test('returns 1d when a sales/favorites signal is within 5 days', () => {
        const tier = resolveListingRefreshCadenceTierFromSnapshots({
            now: new Date('2026-02-27T00:00:00.000Z'),
            snapshots: [
                {
                    observedAt: new Date('2026-02-24T00:00:00.000Z'),
                    favorerCount: 11,
                    quantity: 10,
                    views: 100,
                },
                {
                    observedAt: new Date('2026-02-23T00:00:00.000Z'),
                    favorerCount: 10,
                    quantity: 10,
                    views: 90,
                },
            ],
        });

        expect(tier).toBe('1d');
    });

    test('returns 3d when last sales/favorites signal is 5-14 days old', () => {
        const tier = resolveListingRefreshCadenceTierFromSnapshots({
            now: new Date('2026-02-27T00:00:00.000Z'),
            snapshots: [
                {
                    observedAt: new Date('2026-02-21T00:00:00.000Z'),
                    favorerCount: 11,
                    quantity: 10,
                    views: 100,
                },
                {
                    observedAt: new Date('2026-02-20T00:00:00.000Z'),
                    favorerCount: 11,
                    quantity: 10,
                    views: 95,
                },
                {
                    observedAt: new Date('2026-02-19T00:00:00.000Z'),
                    favorerCount: 10,
                    quantity: 10,
                    views: 80,
                },
            ],
        });

        expect(tier).toBe('3d');
    });

    test('returns 7d when no signal has occurred for 14 or more days', () => {
        const tier = resolveListingRefreshCadenceTierFromSnapshots({
            now: new Date('2026-02-27T00:00:00.000Z'),
            snapshots: [
                {
                    observedAt: new Date('2026-02-10T00:00:00.000Z'),
                    favorerCount: 12,
                    quantity: 10,
                    views: 100,
                },
                {
                    observedAt: new Date('2026-02-09T00:00:00.000Z'),
                    favorerCount: 12,
                    quantity: 10,
                    views: 90,
                },
                {
                    observedAt: new Date('2026-02-08T00:00:00.000Z'),
                    favorerCount: 11,
                    quantity: 10,
                    views: 80,
                },
            ],
        });

        expect(tier).toBe('7d');
    });
});

describe('isListingAutoRefreshEligible', () => {
    test('excludes fatal listings from automatic refresh', () => {
        expect(
            isListingAutoRefreshEligible({
                isDigital: false,
                trackingState: 'fatal',
            })
        ).toBe(false);
    });

    test('includes paused digital listings to preserve current behavior', () => {
        expect(
            isListingAutoRefreshEligible({
                isDigital: true,
                trackingState: 'paused',
            })
        ).toBe(true);
    });
});
