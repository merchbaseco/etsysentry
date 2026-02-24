import { describe, expect, test } from 'bun:test';
import {
    buildDigitalListingTrackingErrorMessage,
    isExcludedDigitalListingType
} from './is-excluded-digital-listing-type';

describe('isExcludedDigitalListingType', () => {
    test('returns true for digital listing types', () => {
        expect(isExcludedDigitalListingType('download')).toBe(true);
        expect(isExcludedDigitalListingType('both')).toBe(true);
    });

    test('returns false for physical and missing listing types', () => {
        expect(isExcludedDigitalListingType('physical')).toBe(false);
        expect(isExcludedDigitalListingType(null)).toBe(false);
    });

    test('normalizes mixed-case listing types', () => {
        expect(isExcludedDigitalListingType('Download')).toBe(true);
        expect(isExcludedDigitalListingType('PHYSICAL')).toBe(false);
    });
});

describe('buildDigitalListingTrackingErrorMessage', () => {
    test('returns a stable user-facing message', () => {
        expect(buildDigitalListingTrackingErrorMessage()).toBe(
            'Digital listings are not eligible for tracking.'
        );
    });
});
