import { describe, expect, test } from 'bun:test';
import {
    MAX_OPEN_KEYWORD_ACTIVITY_TABS,
    normalizeKeywordTabLabel,
    parseKeywordActivityPath,
    removeKeywordActivityTab,
    toKeywordActivityPath,
    upsertKeywordActivityTab,
} from '@/components/dashboard/keyword-activity-tabs-state';

describe('parseKeywordActivityPath', () => {
    test('parses valid keyword activity path', () => {
        expect(parseKeywordActivityPath('/keywords/activity/abc-123')).toEqual({
            trackedKeywordId: 'abc-123',
        });
    });

    test('returns null for unrelated paths', () => {
        expect(parseKeywordActivityPath('/keywords')).toBeNull();
    });

    test('returns null when path contains nested segments', () => {
        expect(parseKeywordActivityPath('/keywords/activity/abc-123/details')).toBeNull();
    });
});

describe('toKeywordActivityPath', () => {
    test('builds keyword activity route from tracked keyword id', () => {
        expect(toKeywordActivityPath('abc')).toBe('/keywords/activity/abc');
    });
});

describe('upsertKeywordActivityTab', () => {
    test('adds a new tab record', () => {
        expect(
            upsertKeywordActivityTab([], {
                keyword: 'st patricks shirt',
                trackedKeywordId: 'keyword-1',
            })
        ).toEqual([
            {
                keyword: 'st patricks shirt',
                trackedKeywordId: 'keyword-1',
            },
        ]);
    });

    test('updates existing labels without duplicating the tab', () => {
        expect(
            upsertKeywordActivityTab(
                [
                    {
                        keyword: 'st patricks shirt',
                        trackedKeywordId: 'keyword-1',
                    },
                ],
                {
                    keyword: 'st patricks shirt ireland',
                    trackedKeywordId: 'keyword-1',
                }
            )
        ).toEqual([
            {
                keyword: 'st patricks shirt ire...',
                trackedKeywordId: 'keyword-1',
            },
        ]);
    });

    test('keeps the tab list capped to the max open limit', () => {
        const seed = Array.from({ length: MAX_OPEN_KEYWORD_ACTIVITY_TABS }, (_, index) => ({
            keyword: `Keyword ${index}`,
            trackedKeywordId: `keyword-${index}`,
        }));

        const nextTabs = upsertKeywordActivityTab(seed, {
            keyword: 'Keyword New',
            trackedKeywordId: 'keyword-new',
        });

        expect(nextTabs).toHaveLength(MAX_OPEN_KEYWORD_ACTIVITY_TABS);
        expect(nextTabs[0]?.trackedKeywordId).toBe('keyword-1');
        expect(nextTabs.at(-1)?.trackedKeywordId).toBe('keyword-new');
    });
});

describe('removeKeywordActivityTab', () => {
    test('removes an existing tab by tracked keyword id', () => {
        expect(
            removeKeywordActivityTab(
                [
                    {
                        keyword: 'st patricks shirt',
                        trackedKeywordId: 'keyword-1',
                    },
                    {
                        keyword: 'autism shirt',
                        trackedKeywordId: 'keyword-2',
                    },
                ],
                'keyword-1'
            )
        ).toEqual([
            {
                keyword: 'autism shirt',
                trackedKeywordId: 'keyword-2',
            },
        ]);
    });
});

describe('normalizeKeywordTabLabel', () => {
    test('trims and truncates oversized labels', () => {
        expect(
            normalizeKeywordTabLabel('  this keyword label is definitely over twenty-four chars  ')
        ).toBe('this keyword label is...');
    });
});
