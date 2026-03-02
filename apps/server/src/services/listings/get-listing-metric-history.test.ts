import { describe, expect, test } from 'bun:test';
import { TRPCError } from '@trpc/server';
import {
    deriveListingHistorySales,
    toQuantityDrop,
    toRenewalCount,
} from './derive-listing-history-sales';
import { resolveHistoryWindow } from './get-listing-metric-history';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

describe('resolveHistoryWindow', () => {
    test('uses default 30-day window when no input is provided', () => {
        const result = resolveHistoryWindow({});

        expect(result.days).toBe(30);
        expect(result.fromObservedDate).toMatch(ISO_DATE_REGEX);
        expect(result.toObservedDate).toMatch(ISO_DATE_REGEX);
    });

    test('uses inclusive day count for absolute date ranges', () => {
        const result = resolveHistoryWindow({
            fromObservedDate: '2026-01-01',
            toObservedDate: '2026-01-31',
        });

        expect(result.days).toBe(31);
        expect(result.fromObservedDate).toBe('2026-01-01');
        expect(result.toObservedDate).toBe('2026-01-31');
    });

    test('throws BAD_REQUEST when only one range boundary is provided', () => {
        expect(() =>
            resolveHistoryWindow({
                fromObservedDate: '2026-01-01',
            })
        ).toThrow(TRPCError);
    });

    test('throws BAD_REQUEST when range start is after range end', () => {
        expect(() =>
            resolveHistoryWindow({
                fromObservedDate: '2026-02-01',
                toObservedDate: '2026-01-01',
            })
        ).toThrow(TRPCError);
    });
});

describe('toQuantityDrop', () => {
    test('returns zero when previous or current quantity is missing', () => {
        expect(
            toQuantityDrop({
                previousQuantity: null,
                currentQuantity: 4,
            })
        ).toBe(0);
        expect(
            toQuantityDrop({
                previousQuantity: 7,
                currentQuantity: null,
            })
        ).toBe(0);
    });

    test('returns non-negative quantity drop', () => {
        expect(
            toQuantityDrop({
                previousQuantity: 7,
                currentQuantity: 4,
            })
        ).toBe(3);
        expect(
            toQuantityDrop({
                previousQuantity: 4,
                currentQuantity: 7,
            })
        ).toBe(0);
    });
});

describe('toRenewalCount', () => {
    test('returns zero when ending timestamps are missing or non-increasing', () => {
        expect(
            toRenewalCount({
                previousEndingTimestamp: null,
                currentEndingTimestamp: 1_741_000_000,
            })
        ).toBe(0);
        expect(
            toRenewalCount({
                previousEndingTimestamp: 1_741_000_000,
                currentEndingTimestamp: null,
            })
        ).toBe(0);
        expect(
            toRenewalCount({
                previousEndingTimestamp: 1_741_000_000,
                currentEndingTimestamp: 1_741_000_000,
            })
        ).toBe(0);
    });

    test('infers renewal count from ending timestamp jumps', () => {
        expect(
            toRenewalCount({
                previousEndingTimestamp: 1_700_000_000,
                currentEndingTimestamp: 1_710_368_000,
            })
        ).toBe(1);
        expect(
            toRenewalCount({
                previousEndingTimestamp: 1_700_000_000,
                currentEndingTimestamp: 1_720_736_000,
            })
        ).toBe(2);
    });
});

describe('deriveListingHistorySales', () => {
    test('adds renewal-based sold deltas when quantity does not drop', () => {
        const metrics = deriveListingHistorySales([
            {
                endingTimestamp: 1_700_000_000,
                quantity: 3,
            },
            {
                endingTimestamp: 1_710_368_000,
                quantity: 3,
            },
            {
                endingTimestamp: 1_710_368_000,
                quantity: 2,
            },
        ]);

        expect(metrics).toEqual([
            { estimatedSoldCount: 0, estimatedSoldDelta: 0 },
            { estimatedSoldCount: 1, estimatedSoldDelta: 1 },
            { estimatedSoldCount: 2, estimatedSoldDelta: 1 },
        ]);
    });
});
