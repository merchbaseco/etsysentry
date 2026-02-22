import { describe, expect, test } from 'bun:test';
import { normalizeTrackedKeywordInput } from './tracked-keywords-service';

describe('normalizeTrackedKeywordInput', () => {
    test('returns null for empty keyword input', () => {
        expect(normalizeTrackedKeywordInput('   \n\t  ')).toBeNull();
    });

    test('trims and collapses whitespace in keyword text', () => {
        expect(normalizeTrackedKeywordInput('  Mid   Century   Wall Art  ')).toEqual({
            keyword: 'Mid Century Wall Art',
            normalizedKeyword: 'mid century wall art'
        });
    });

    test('builds case-insensitive normalized keyword for dedupe', () => {
        expect(normalizeTrackedKeywordInput('WOODEN Sign')).toEqual({
            keyword: 'WOODEN Sign',
            normalizedKeyword: 'wooden sign'
        });
    });
});
