import { describe, expect, test } from 'bun:test';
import { isTrackedListingSyncEnqueueEligible } from './is-tracked-listing-sync-enqueue-eligible';

describe('isTrackedListingSyncEnqueueEligible', () => {
    test('returns false for in-flight sync states', () => {
        expect(
            isTrackedListingSyncEnqueueEligible({
                syncState: 'queued',
                trackingState: 'active'
            })
        ).toBe(false);

        expect(
            isTrackedListingSyncEnqueueEligible({
                syncState: 'syncing',
                trackingState: 'error'
            })
        ).toBe(false);
    });

    test('returns false for fatal tracking state', () => {
        expect(
            isTrackedListingSyncEnqueueEligible({
                syncState: 'idle',
                trackingState: 'fatal'
            })
        ).toBe(false);
    });

    test('returns true for idle non-fatal tracked listings', () => {
        expect(
            isTrackedListingSyncEnqueueEligible({
                syncState: 'idle',
                trackingState: 'active'
            })
        ).toBe(true);

        expect(
            isTrackedListingSyncEnqueueEligible({
                syncState: 'idle',
                trackingState: 'error'
            })
        ).toBe(true);
    });
});
