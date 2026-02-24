import { describe, expect, test } from 'bun:test';
import { isLiveSyncListingJobState } from './reconcile-tracked-listing-sync-state';

describe('isLiveSyncListingJobState', () => {
    test('returns true for active sync job states', () => {
        expect(isLiveSyncListingJobState('created')).toBe(true);
        expect(isLiveSyncListingJobState('retry')).toBe(true);
        expect(isLiveSyncListingJobState('active')).toBe(true);
    });

    test('returns false for terminal job states', () => {
        expect(isLiveSyncListingJobState('completed')).toBe(false);
        expect(isLiveSyncListingJobState('failed')).toBe(false);
        expect(isLiveSyncListingJobState('cancelled')).toBe(false);
    });
});
