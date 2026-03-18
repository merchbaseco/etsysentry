import { describe, expect, test } from 'bun:test';
import { assertValidRange, normalizeBaseUrl, resolveBaseUrl, resolveRange } from './config.js';
import type { CliFlags } from './types.js';

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

describe('resolveBaseUrl', () => {
    test('falls back to hosted default when no override is set', () => {
        const previousBaseUrl = process.env.ES_BASE_URL;
        process.env.ES_BASE_URL = undefined;

        const flags: CliFlags = {
            help: false,
            showDigital: false,
        };

        try {
            expect(resolveBaseUrl({ config: {}, flags })).toBe('https://etsysentry.merchbase.co');
        } finally {
            if (previousBaseUrl === undefined) {
                process.env.ES_BASE_URL = undefined;
            } else {
                process.env.ES_BASE_URL = previousBaseUrl;
            }
        }
    });
});

describe('resolveRange', () => {
    test('defaults to 30d when no override is set', () => {
        expect(resolveRange(undefined)).toBe('30d');
    });

    test('accepts an explicit flag override', () => {
        expect(resolveRange('90d')).toBe('90d');
    });
});
