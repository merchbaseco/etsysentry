import { describe, expect, test } from 'bun:test';
import { resolveDisableServerJobRunner } from './env';

describe('resolveDisableServerJobRunner', () => {
    test('returns false by default when env var is unset', () => {
        expect(resolveDisableServerJobRunner(undefined)).toBe(false);
    });

    test('returns true when explicitly disabled', () => {
        expect(resolveDisableServerJobRunner('true')).toBe(true);
    });

    test('returns false when explicitly enabled', () => {
        expect(resolveDisableServerJobRunner('false')).toBe(false);
    });
});
