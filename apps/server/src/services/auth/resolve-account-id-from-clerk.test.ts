import { describe, expect, test } from 'bun:test';
import { resolvePreferredAccountId } from './resolve-account-id-from-clerk';

describe('resolvePreferredAccountId', () => {
    test('prefers account linked by email', () => {
        const accountId = resolvePreferredAccountId({
            accountIdFromEmail: 'account_email',
            accountIdFromIdentity: 'account_identity',
        });

        expect(accountId).toBe('account_email');
    });

    test('falls back to identity-linked account when email is missing', () => {
        const accountId = resolvePreferredAccountId({
            accountIdFromEmail: null,
            accountIdFromIdentity: 'account_identity',
        });

        expect(accountId).toBe('account_identity');
    });

    test('returns null when neither identity nor email is linked', () => {
        const accountId = resolvePreferredAccountId({
            accountIdFromEmail: null,
            accountIdFromIdentity: null,
        });

        expect(accountId).toBeNull();
    });
});
