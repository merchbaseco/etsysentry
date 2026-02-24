import { describe, expect, test } from 'bun:test';
import { isTrackedListingSyncInFlight } from './set-tracked-listing-sync-state';

describe('isTrackedListingSyncInFlight', () => {
    test('returns true for queued and syncing states', () => {
        expect(isTrackedListingSyncInFlight('queued')).toBe(true);
        expect(isTrackedListingSyncInFlight('syncing')).toBe(true);
    });

    test('returns false for idle state', () => {
        expect(isTrackedListingSyncInFlight('idle')).toBe(false);
    });
});
