import { describe, expect, test } from 'bun:test';
import {
    formatSparklineObservedDate,
    toSparklineChartData,
} from '@/components/dashboard/shop-metric-sparkline';

const yearRegex = /[0-9]{4}/;

describe('toSparklineChartData', () => {
    test('maps nullable values to resolved chart values', () => {
        expect(
            toSparklineChartData([
                {
                    observedAt: '2026-03-01T00:00:00.000Z',
                    value: 3,
                },
                {
                    observedAt: '2026-03-02T00:00:00.000Z',
                    value: null,
                },
            ])
        ).toEqual([
            {
                observedAt: '2026-03-01T00:00:00.000Z',
                resolvedValue: 3,
                value: 3,
            },
            {
                observedAt: '2026-03-02T00:00:00.000Z',
                resolvedValue: 0,
                value: null,
            },
        ]);
    });
});

describe('formatSparklineObservedDate', () => {
    test('formats valid ISO dates for tooltip labels', () => {
        const formatted = formatSparklineObservedDate('2026-03-03T00:00:00.000Z');

        expect(formatted).toMatch(yearRegex);
        expect(formatted).not.toBe('2026-03-03T00:00:00.000Z');
    });

    test('falls back to raw input for invalid values', () => {
        expect(formatSparklineObservedDate('not-a-date')).toBe('not-a-date');
    });
});
