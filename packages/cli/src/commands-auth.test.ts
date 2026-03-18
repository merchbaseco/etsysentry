import { describe, expect, test } from 'bun:test';
import { runAuthCommand } from './commands-auth.js';
import type { CliSecureStore } from './secure-store.js';
import type { CliFlags } from './types.js';

const defaultFlags: CliFlags = {
    help: false,
    showDigital: false,
    version: false,
};

const createStore = (): CliSecureStore => {
    return {
        clearApiKey: async (): Promise<boolean> => true,
        getStatus: async () => ({
            available: true,
            kind: 'macos-keychain',
        }),
        readApiKey: async (): Promise<string | null> => 'esk_live_store',
        writeApiKey: (): Promise<void> => Promise.resolve(),
    };
};

describe('runAuthCommand', () => {
    test('returns auth status metadata', async () => {
        const result = await runAuthCommand(
            {
                command: {
                    args: [],
                    resource: 'auth',
                    verb: 'status',
                },
                flags: defaultFlags,
            },
            createStore()
        );

        expect(result).toEqual({
            data: {
                activeSource: 'secure-store',
                authenticated: true,
                hasEnvOverride: false,
                hasStoredApiKey: true,
                store: {
                    available: true,
                    kind: 'macos-keychain',
                },
            },
            type: 'json',
        });
    });

    test('returns whether auth clear removed a stored key', async () => {
        const result = await runAuthCommand(
            {
                command: {
                    args: [],
                    resource: 'auth',
                    verb: 'clear',
                },
                flags: defaultFlags,
            },
            createStore()
        );

        expect(result).toEqual({
            data: {
                cleared: true,
                store: {
                    available: true,
                    kind: 'macos-keychain',
                },
            },
            type: 'json',
        });
    });
});
