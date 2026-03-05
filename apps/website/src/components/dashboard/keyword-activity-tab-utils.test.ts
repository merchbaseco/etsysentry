import { describe, expect, test } from 'bun:test';
import {
    isKeywordActivityTabState,
    toKeywordActivityTitle,
} from '@/components/dashboard/keyword-activity-tab-utils';

describe('isKeywordActivityTabState', () => {
    test('accepts state objects with optional string fields', () => {
        expect(isKeywordActivityTabState({})).toBe(true);
        expect(
            isKeywordActivityTabState({
                keyword: 'wall art',
                trackedKeywordId: 'keyword-1',
            })
        ).toBe(true);
    });

    test('rejects non-string keyword fields', () => {
        expect(
            isKeywordActivityTabState({
                keyword: 42,
                trackedKeywordId: 'keyword-1',
            })
        ).toBe(false);
    });
});

describe('toKeywordActivityTitle', () => {
    test('falls back to path-derived label when location keyword is empty', () => {
        expect(
            toKeywordActivityTitle({
                activityKeyword: null,
                locationKeyword: '   ',
                trackedKeywordId: 'abc123456789',
            })
        ).toBe('Keyword abc12345');
    });
});
