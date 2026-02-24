import { describe, expect, test } from 'bun:test';
import { isTrackedKeywordSyncInFlight } from './set-tracked-keyword-sync-state';

describe('isTrackedKeywordSyncInFlight', () => {
    test('returns true for queued and syncing states', () => {
        expect(isTrackedKeywordSyncInFlight('queued')).toBe(true);
        expect(isTrackedKeywordSyncInFlight('syncing')).toBe(true);
    });

    test('returns false for idle state', () => {
        expect(isTrackedKeywordSyncInFlight('idle')).toBe(false);
    });
});
