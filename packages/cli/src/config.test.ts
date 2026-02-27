import { describe, expect, test } from 'bun:test';
import { assertValidRange, normalizeBaseUrl } from './config.js';

describe('assertValidRange', () => {
    test('accepts supported relative ranges', () => {
        expect(assertValidRange('7d')).toBe('7d');
        expect(assertValidRange('30d')).toBe('30d');
        expect(assertValidRange('90d')).toBe('90d');
    });

    test('accepts absolute date ranges', () => {
        expect(assertValidRange('2026-01-01..2026-01-31')).toBe('2026-01-01..2026-01-31');
    });

    test('throws on unsupported range', () => {
        expect(() => assertValidRange('14d')).toThrow('Range must be 7d, 30d, 90d');
    });
});

describe('normalizeBaseUrl', () => {
    test('removes trailing slashes', () => {
        expect(normalizeBaseUrl('http://localhost:8080///')).toBe('http://localhost:8080');
    });
});
