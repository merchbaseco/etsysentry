import { describe, expect, test } from 'bun:test';
import { computeListingStaleBefore } from './find-stale-listings';

describe('computeListingStaleBefore', () => {
    test('returns a timestamp exactly 24 hours before now', () => {
        const now = new Date('2026-02-24T12:34:56.000Z');
        const result = computeListingStaleBefore(now);

        expect(result.toISOString()).toBe('2026-02-23T12:34:56.000Z');
    });
});
