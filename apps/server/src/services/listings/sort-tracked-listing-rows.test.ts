import { describe, expect, test } from 'bun:test';
import {
    compareTrackedListingRowsByCreatedAtDesc,
    sortTrackedListingRowsByCreatedAtDesc,
} from './sort-tracked-listing-rows';

describe('compareTrackedListingRowsByCreatedAtDesc', () => {
    test('orders newer tracked rows before older tracked rows', () => {
        const newer = {
            createdAt: new Date('2026-02-25T12:00:00.000Z'),
            listingId: 'listing-new',
        };
        const older = {
            createdAt: new Date('2026-02-25T11:59:59.000Z'),
            listingId: 'listing-old',
        };

        expect(compareTrackedListingRowsByCreatedAtDesc(newer, older)).toBeLessThan(0);
        expect(compareTrackedListingRowsByCreatedAtDesc(older, newer)).toBeGreaterThan(0);
    });

    test('uses listing id as a deterministic tie-breaker when createdAt matches', () => {
        const sameTimestamp = new Date('2026-02-25T12:00:00.000Z');
        const highId = {
            createdAt: sameTimestamp,
            listingId: 'listing-z',
        };
        const lowId = {
            createdAt: sameTimestamp,
            listingId: 'listing-a',
        };

        expect(compareTrackedListingRowsByCreatedAtDesc(highId, lowId)).toBeLessThan(0);
        expect(compareTrackedListingRowsByCreatedAtDesc(lowId, highId)).toBeGreaterThan(0);
    });
});

describe('sortTrackedListingRowsByCreatedAtDesc', () => {
    test('returns a sorted clone without mutating the source rows', () => {
        const sourceRows = [
            {
                createdAt: new Date('2026-02-25T10:00:00.000Z'),
                listingId: 'listing-b',
            },
            {
                createdAt: new Date('2026-02-25T12:00:00.000Z'),
                listingId: 'listing-a',
            },
            {
                createdAt: new Date('2026-02-25T12:00:00.000Z'),
                listingId: 'listing-z',
            },
        ];

        const result = sortTrackedListingRowsByCreatedAtDesc(sourceRows);

        expect(result.map((item) => item.listingId)).toEqual([
            'listing-z',
            'listing-a',
            'listing-b',
        ]);
        expect(sourceRows.map((item) => item.listingId)).toEqual([
            'listing-b',
            'listing-a',
            'listing-z',
        ]);
    });
});
