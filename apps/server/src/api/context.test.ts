import { describe, expect, test } from 'bun:test';
import { isAdminEmail } from './context';

describe('context admin email matching', () => {
    test('matches configured admin email case-insensitively', () => {
        expect(isAdminEmail('ADMIN@EXAMPLE.COM')).toBe(true);
    });

    test('matches configured admin email with surrounding whitespace', () => {
        expect(isAdminEmail('  admin@example.com  ')).toBe(true);
    });

    test('returns false for different email', () => {
        expect(isAdminEmail('user@example.com')).toBe(false);
    });

    test('returns false when email claim is missing', () => {
        expect(isAdminEmail(undefined)).toBe(false);
    });
});
