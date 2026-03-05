import { describe, expect, test } from 'bun:test';
import { toKeywordRankChanges } from './keyword-rank-changes';

describe('toKeywordRankChanges', () => {
    test('computes 1d, 7d, and 30d rank changes from baseline snapshots', () => {
        const result = toKeywordRankChanges({
            bestRank: 4,
            currentRank: 8,
            latestObservedAt: '2026-03-04T12:00:00.000Z',
            trendHistory: [
                { observedAt: '2026-02-01T12:00:00.000Z', rank: 16 },
                { observedAt: '2026-02-25T12:00:00.000Z', rank: 14 },
                { observedAt: '2026-02-27T12:00:00.000Z', rank: 11 },
                { observedAt: '2026-03-03T12:00:00.000Z', rank: 10 },
                { observedAt: '2026-03-04T12:00:00.000Z', rank: 8 },
            ],
        });

        expect(result).toEqual({
            bestRank: 4,
            change1d: 2,
            change7d: 6,
            change30d: 8,
        });
    });

    test('returns zero deltas when no baseline snapshot exists for a window', () => {
        const result = toKeywordRankChanges({
            bestRank: null,
            currentRank: 6,
            latestObservedAt: '2026-03-04T12:00:00.000Z',
            trendHistory: [{ observedAt: '2026-03-04T12:00:00.000Z', rank: 6 }],
        });

        expect(result).toEqual({
            bestRank: 6,
            change1d: 0,
            change7d: 0,
            change30d: 0,
        });
    });
});
