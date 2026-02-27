import { describe, expect, test } from 'bun:test';
import { SYNC_LISTING_WORKER_LOCAL_CONCURRENCY } from './sync-listing-shared';

describe('sync-listing shared constants', () => {
    test('uses local worker concurrency greater than 1 for listing sync throughput', () => {
        expect(SYNC_LISTING_WORKER_LOCAL_CONCURRENCY).toBeGreaterThan(1);
    });
});
