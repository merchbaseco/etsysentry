import { describe, expect, test } from 'bun:test';
import { computeNextKeywordSyncAt } from './keyword-rankings-service';

describe('computeNextKeywordSyncAt', () => {
    test('schedules next sync exactly one day later', () => {
        const now = new Date('2026-02-23T12:34:56.000Z');
        const nextSyncAt = computeNextKeywordSyncAt(now);

        expect(nextSyncAt.toISOString()).toBe('2026-02-24T12:34:56.000Z');
    });
});
