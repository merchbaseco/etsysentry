import { describe, expect, test } from 'bun:test';
import {
    getInitialListingsRenderCount,
    getNextListingsRenderCount,
    LISTINGS_INITIAL_RENDER_COUNT
} from './listings-tab-utils';

describe('getInitialListingsRenderCount', () => {
    test('returns all items when total count is below initial render size', () => {
        expect(getInitialListingsRenderCount(42)).toBe(42);
    });

    test('caps initial render size for large datasets', () => {
        expect(getInitialListingsRenderCount(2_000)).toBe(LISTINGS_INITIAL_RENDER_COUNT);
    });
});

describe('getNextListingsRenderCount', () => {
    test('increments render count by default batch size', () => {
        expect(
            getNextListingsRenderCount({
                currentCount: 200,
                totalCount: 1_000
            })
        ).toBe(400);
    });

    test('clamps to total item count when increment exceeds remaining items', () => {
        expect(
            getNextListingsRenderCount({
                currentCount: 950,
                totalCount: 1_000
            })
        ).toBe(1_000);
    });

    test('supports explicit increment sizes', () => {
        expect(
            getNextListingsRenderCount({
                currentCount: 300,
                totalCount: 1_000,
                incrementSize: 150
            })
        ).toBe(450);
    });
});
