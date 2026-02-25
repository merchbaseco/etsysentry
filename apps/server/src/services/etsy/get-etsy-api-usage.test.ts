import { describe, expect, test } from 'bun:test';
import { parseDbTimestamp } from './get-etsy-api-usage';

describe('parseDbTimestamp', () => {
    test('returns null for null input', () => {
        expect(parseDbTimestamp(null)).toBeNull();
    });

    test('returns Date when input is already a Date', () => {
        const value = new Date('2026-02-25T12:34:56.000Z');
        const parsed = parseDbTimestamp(value);

        expect(parsed).toBeInstanceOf(Date);
        expect(parsed?.toISOString()).toBe('2026-02-25T12:34:56.000Z');
    });

    test('parses ISO strings into Date instances', () => {
        const parsed = parseDbTimestamp('2026-02-25T12:34:56.000Z');

        expect(parsed).toBeInstanceOf(Date);
        expect(parsed?.toISOString()).toBe('2026-02-25T12:34:56.000Z');
    });

    test('throws for invalid timestamp strings', () => {
        expect(() => {
            parseDbTimestamp('not-a-timestamp');
        }).toThrow('Received invalid timestamp string for Etsy API usage');
    });
});
