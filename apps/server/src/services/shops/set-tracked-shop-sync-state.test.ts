import { describe, expect, test } from 'bun:test';
import { isTrackedShopSyncInFlight } from './set-tracked-shop-sync-state';

describe('isTrackedShopSyncInFlight', () => {
    test('returns true for queued and syncing states', () => {
        expect(isTrackedShopSyncInFlight('queued')).toBe(true);
        expect(isTrackedShopSyncInFlight('syncing')).toBe(true);
    });

    test('returns false for idle state', () => {
        expect(isTrackedShopSyncInFlight('idle')).toBe(false);
    });
});
