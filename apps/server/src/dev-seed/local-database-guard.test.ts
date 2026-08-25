import { describe, expect, test } from 'bun:test';
import { assertLocalSeedTarget, SeedTargetRefusedError } from './local-database-guard';

const LOCAL = {
    name: 'etsysentry',
    port: 5435,
} as const;

const NOT_LOOPBACK = /is not loopback/;
const NODE_ENV_PRODUCTION = /NODE_ENV is production/;
const NAMED_TARGET = /db\.internal:5432\/etsysentry/;

describe('assertLocalSeedTarget', () => {
    test('accepts loopback hosts', () => {
        for (const host of ['127.0.0.1', 'localhost', '::1', '[::1]', ' 127.0.0.1 ']) {
            expect(assertLocalSeedTarget({ ...LOCAL, host }).port).toBe(5435);
        }
    });

    test('refuses the live database reached over Tailscale', () => {
        expect(() =>
            assertLocalSeedTarget({
                ...LOCAL,
                host: 'zachs-mac-mini.taila0b849.ts.net',
            })
        ).toThrow(NOT_LOOPBACK);
    });

    test('refuses the production compose host', () => {
        expect(() => assertLocalSeedTarget({ ...LOCAL, host: 'postgres', port: 5432 })).toThrow(
            SeedTargetRefusedError
        );
    });

    test('refuses a loopback host when NODE_ENV is production', () => {
        expect(() =>
            assertLocalSeedTarget({
                ...LOCAL,
                host: '127.0.0.1',
                nodeEnv: 'production',
            })
        ).toThrow(NODE_ENV_PRODUCTION);
    });

    test('names the refused target so the message is actionable', () => {
        expect(() =>
            assertLocalSeedTarget({
                ...LOCAL,
                host: 'db.internal',
                port: 5432,
            })
        ).toThrow(NAMED_TARGET);
    });

    test('describes the target without a credential', () => {
        let message = '';

        try {
            assertLocalSeedTarget({ ...LOCAL, host: 'db.internal' });
        } catch (error) {
            message = error instanceof Error ? error.message : '';
        }

        expect(message).toContain('db.internal');
        expect(message).not.toContain('password');
        expect(message).not.toContain('://');
    });
});
