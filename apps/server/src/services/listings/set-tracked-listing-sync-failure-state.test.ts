import { describe, expect, test } from 'bun:test';
import { computeNextTrackedListingFailureState } from './set-tracked-listing-sync-failure-state';

describe('computeNextTrackedListingFailureState', () => {
    test('marks first sync failure as error', () => {
        expect(computeNextTrackedListingFailureState('active')).toBe('error');
        expect(computeNextTrackedListingFailureState('paused')).toBe('error');
    });

    test('escalates consecutive failures to fatal', () => {
        expect(computeNextTrackedListingFailureState('error')).toBe('fatal');
        expect(computeNextTrackedListingFailureState('fatal')).toBe('fatal');
    });
});
