import { describe, expect, test } from 'bun:test';
import { isLiveSyncKeywordJobState } from './reconcile-tracked-keyword-sync-state';

describe('isLiveSyncKeywordJobState', () => {
    test('returns true for active sync job states', () => {
        expect(isLiveSyncKeywordJobState('created')).toBe(true);
        expect(isLiveSyncKeywordJobState('retry')).toBe(true);
        expect(isLiveSyncKeywordJobState('active')).toBe(true);
    });

    test('returns false for terminal job states', () => {
        expect(isLiveSyncKeywordJobState('completed')).toBe(false);
        expect(isLiveSyncKeywordJobState('failed')).toBe(false);
        expect(isLiveSyncKeywordJobState('cancelled')).toBe(false);
    });
});
