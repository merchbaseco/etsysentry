import { describe, expect, test } from 'bun:test';
import { trackedListingSyncIncludes } from './tracked-listing-sync-includes';

describe('tracked-listing-sync-includes', () => {
    test('includes Shop so listing sync captures shop names', () => {
        expect(trackedListingSyncIncludes).toEqual(['Images', 'Shop']);
    });
});
