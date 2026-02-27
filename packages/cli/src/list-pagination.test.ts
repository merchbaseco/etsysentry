import { describe, expect, test } from 'bun:test';
import { paginateListItems, resolveListPagination } from './list-pagination.js';

describe('resolveListPagination', () => {
    test('defaults to offset zero with no limit', () => {
        expect(
            resolveListPagination({
                help: false,
                showDigital: false,
            })
        ).toEqual({
            limit: undefined,
            offset: 0,
        });
    });

    test('parses numeric limit and offset flags', () => {
        expect(
            resolveListPagination({
                help: false,
                limit: '5',
                offset: '2',
                showDigital: false,
            })
        ).toEqual({
            limit: 5,
            offset: 2,
        });
    });

    test('rejects non-integer limit', () => {
        expect(() =>
            resolveListPagination({
                help: false,
                limit: '2.5',
                showDigital: false,
            })
        ).toThrow('--limit must be an integer >= 1.');
    });

    test('rejects negative offset', () => {
        expect(() =>
            resolveListPagination({
                help: false,
                offset: '-1',
                showDigital: false,
            })
        ).toThrow('--offset must be an integer >= 0.');
    });
});

describe('paginateListItems', () => {
    test('returns all items when no limit and zero offset', () => {
        expect(paginateListItems(['a', 'b', 'c'], { offset: 0 })).toEqual(['a', 'b', 'c']);
    });

    test('applies offset and limit in order', () => {
        expect(
            paginateListItems(['a', 'b', 'c', 'd', 'e'], {
                limit: 2,
                offset: 1,
            })
        ).toEqual(['b', 'c']);
    });

    test('returns empty array when offset is beyond list length', () => {
        expect(
            paginateListItems(['a', 'b'], {
                limit: 5,
                offset: 9,
            })
        ).toEqual([]);
    });
});
