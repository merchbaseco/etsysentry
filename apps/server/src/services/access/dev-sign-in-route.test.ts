import { describe, expect, it } from 'bun:test';
import { isDevSignInArmed } from './dev-sign-in-route';

const DEV_USER = 'user_38Q9fcwOarmNP41Hb4P9TPUt8rS';

const conditions = (overrides: Partial<Parameters<typeof isDevSignInArmed>[0]> = {}) => ({
    databaseHost: '127.0.0.1',
    devSignInUserId: DEV_USER,
    nodeEnv: 'development',
    ...overrides,
});

describe('isDevSignInArmed', () => {
    it('arms a development process pointed at a loopback database', () => {
        expect(isDevSignInArmed(conditions())).toBe(true);
    });

    it.each([
        '127.0.0.1',
        'localhost',
        'LOCALHOST',
        '::1',
        '[::1]',
        ' 127.0.0.1 ',
    ])('accepts the loopback host %p', (databaseHost) => {
        expect(isDevSignInArmed(conditions({ databaseHost }))).toBe(true);
    });

    // The live EtsySentry database, which local development reaches over
    // Tailscale. Signing in there would swap a developer's own identity for the
    // shared development one against real data.
    it('refuses the live database host', () => {
        expect(
            isDevSignInArmed(conditions({ databaseHost: 'zachs-mac-mini.taila0b849.ts.net' }))
        ).toBe(false);
    });

    it('refuses the production compose database host', () => {
        expect(isDevSignInArmed(conditions({ databaseHost: 'postgres' }))).toBe(false);
    });

    it('refuses production even against a loopback database', () => {
        expect(isDevSignInArmed(conditions({ nodeEnv: 'production' }))).toBe(false);
    });

    it.each([undefined, ''])('refuses when no development user is configured (%p)', (userId) => {
        expect(isDevSignInArmed(conditions({ devSignInUserId: userId }))).toBe(false);
    });
});
