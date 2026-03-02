import { describe, expect, test } from 'bun:test';
import { normalizeListingTag, normalizeListingTags } from './normalize-listing-tags';

describe('normalizeListingTag', () => {
    test('normalizes casing and trims whitespace', () => {
        expect(normalizeListingTag('  Wedding  Gift  ')).toBe('wedding gift');
    });

    test('returns null for empty tags', () => {
        expect(normalizeListingTag('    ')).toBeNull();
    });
});

describe('normalizeListingTags', () => {
    test('deduplicates and sorts normalized tags', () => {
        expect(
            normalizeListingTags([
                'Gift For Mom',
                'gift for mom',
                'WEDDING',
                ' wedding ',
                '  ',
                'anniversary',
            ])
        ).toEqual(['anniversary', 'gift for mom', 'wedding']);
    });
});
