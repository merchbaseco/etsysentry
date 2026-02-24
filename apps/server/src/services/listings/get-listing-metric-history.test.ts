import { describe, expect, test } from 'bun:test';
import {
    normalizeHistoryDays,
    toEarliestObservedDate
} from './get-listing-metric-history';

describe('normalizeHistoryDays', () => {
    test('uses the default window for missing or invalid input', () => {
        expect(normalizeHistoryDays(undefined)).toBe(30);
        expect(normalizeHistoryDays(0)).toBe(30);
        expect(normalizeHistoryDays(-4)).toBe(30);
    });

    test('normalizes valid input to an integer', () => {
        expect(normalizeHistoryDays(7)).toBe(7);
        expect(normalizeHistoryDays(7.9)).toBe(7);
    });
});

describe('toEarliestObservedDate', () => {
    test('builds an inclusive UTC boundary date key', () => {
        const boundary = toEarliestObservedDate({
            now: new Date('2026-03-03T23:15:00.000Z'),
            days: 7
        });

        expect(boundary).toBe('2026-02-25');
    });

    test('uses UTC day boundaries regardless of local timezone input', () => {
        const boundary = toEarliestObservedDate({
            now: new Date('2026-03-03T00:30:00.000-08:00'),
            days: 2
        });

        expect(boundary).toBe('2026-03-02');
    });
});
