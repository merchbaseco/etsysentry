import { describe, expect, test } from 'bun:test';
import { resolveApiKey, resolveAuthStatus, storeApiKeyFromCommand } from './auth.js';
import type { CliSecureStore } from './secure-store.js';
import type { CliFlags } from './types.js';

const defaultFlags: CliFlags = {
    help: false,
    showDigital: false,
    version: false,
};

const withApiKeyEnv = async (
    apiKey: string | undefined,
    callback: () => Promise<void>
): Promise<void> => {
    const previousApiKey = process.env.ES_API_KEY;
    process.env.ES_API_KEY = apiKey;

    try {
        await callback();
    } finally {
        if (previousApiKey === undefined) {
            process.env.ES_API_KEY = undefined;
        } else {
            process.env.ES_API_KEY = previousApiKey;
        }
    }
};

const createStore = (params?: {
    available?: boolean;
    kind?: 'macos-keychain' | 'unsupported';
    storedApiKey?: string | null;
    writeApiKey?: (apiKey: string) => Promise<void>;
}): CliSecureStore => {
    return {
        clearApiKey: async (): Promise<boolean> => true,
        getStatus: async () => ({
            available: params?.available ?? true,
            kind: params?.kind ?? 'macos-keychain',
        }),
        readApiKey: async () => params?.storedApiKey ?? null,
        writeApiKey: params?.writeApiKey ?? (() => Promise.resolve()),
    };
};

describe('resolveApiKey', () => {
    test('prefers the flag over env and secure storage', async () => {
        await withApiKeyEnv('esk_live_env', async () => {
            const auth = await resolveApiKey(
                {
                    flags: {
                        ...defaultFlags,
                        apiKey: 'esk_live_flag',
                    },
                },
                createStore({
                    storedApiKey: 'esk_live_store',
                })
            );

            expect(auth).toEqual({
                apiKey: 'esk_live_flag',
                source: 'flag',
                store: {
                    available: true,
                    kind: 'macos-keychain',
                },
            });
        });
    });

    test('falls back to secure storage when no overrides are set', async () => {
        await withApiKeyEnv(undefined, async () => {
            const auth = await resolveApiKey(
                {
                    flags: defaultFlags,
                },
                createStore({
                    storedApiKey: 'esk_live_store',
                })
            );

            expect(auth?.apiKey).toBe('esk_live_store');
            expect(auth?.source).toBe('secure-store');
        });
    });
});

describe('resolveAuthStatus', () => {
    test('reports env overrides while a stored key also exists', async () => {
        await withApiKeyEnv('esk_live_env', async () => {
            const status = await resolveAuthStatus(
                {
                    flags: defaultFlags,
                },
                createStore({
                    storedApiKey: 'esk_live_store',
                })
            );

            expect(status).toEqual({
                activeSource: 'env',
                authenticated: true,
                hasEnvOverride: true,
                hasStoredApiKey: true,
                store: {
                    available: true,
                    kind: 'macos-keychain',
                },
            });
        });
    });
});

describe('storeApiKeyFromCommand', () => {
    test('stores the provided positional API key', async () => {
        let storedApiKey: string | null = null;

        const result = await storeApiKeyFromCommand(
            {
                command: {
                    args: ['esk_live_positional'],
                    resource: 'auth',
                    verb: 'set',
                },
                flags: defaultFlags,
            },
            createStore({
                writeApiKey: (apiKey: string): Promise<void> => {
                    storedApiKey = apiKey;
                    return Promise.resolve();
                },
            })
        );

        expect(result).toEqual({
            source: 'arg',
        });
        expect(storedApiKey).toBe('esk_live_positional');
    });
});
