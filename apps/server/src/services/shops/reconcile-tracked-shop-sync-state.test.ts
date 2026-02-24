import { describe, expect, test } from 'bun:test';
import { isLiveSyncShopJobState } from './reconcile-tracked-shop-sync-state';

describe('isLiveSyncShopJobState', () => {
    test('returns true for active sync job states', () => {
        expect(isLiveSyncShopJobState('created')).toBe(true);
        expect(isLiveSyncShopJobState('retry')).toBe(true);
        expect(isLiveSyncShopJobState('active')).toBe(true);
    });

    test('returns false for terminal job states', () => {
        expect(isLiveSyncShopJobState('completed')).toBe(false);
        expect(isLiveSyncShopJobState('failed')).toBe(false);
        expect(isLiveSyncShopJobState('cancelled')).toBe(false);
    });
});
