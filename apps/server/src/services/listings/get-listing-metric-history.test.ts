import { describe, expect, test } from 'bun:test';
import { TRPCError } from '@trpc/server';
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
