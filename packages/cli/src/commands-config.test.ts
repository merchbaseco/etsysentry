import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runConfigCommand } from './commands-config.js';
import type { CliSecureStore } from './secure-store.js';
import type { CliFlags, LoadedCliConfig } from './types.js';

const tempPaths: string[] = [];

const defaultFlags: CliFlags = {
    help: false,
    showDigital: false,
    stdin: false,
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

const createConfigState = async (): Promise<LoadedCliConfig> => {
    const storageDir = await mkdtemp(path.join(tmpdir(), 'etsysentry-cli-config-'));
    tempPaths.push(storageDir);

    return {
        config: {
            baseUrl: 'http://localhost:8181',
        },
        paths: {
            configPath: path.join(storageDir, 'config.json'),
            globalConfigPath: path.join(storageDir, 'settings.json'),
            storageDir,
        },
    };
};

afterEach(async () => {
    await Promise.all(
        tempPaths.splice(0).map(async (tempPath) => {
            await rm(tempPath, { force: true, recursive: true });
        })
    );
});

describe('runConfigCommand', () => {
    test('shows non-secret config with auth status metadata', async () => {
        const configState = await createConfigState();
        const result = await runConfigCommand(
            {
                command: {
                    args: [],
                    resource: 'config',
                    verb: 'show',
                },
                configState,
                flags: defaultFlags,
            },
            createStore()
        );

        expect(result).toEqual({
            data: {
                auth: {
                    activeSource: 'secure-store',
                    authenticated: true,
                    hasEnvOverride: false,
                    hasStoredApiKey: true,
                    store: {
                        available: true,
                        kind: 'macos-keychain',
                    },
                },
                config: {
                    baseUrl: 'http://localhost:8181',
                },
                path: configState.paths.configPath,
                storageDir: configState.paths.storageDir,
            },
            type: 'json',
        });
    });

    test('gets a single config value', async () => {
        const configState = await createConfigState();
        const result = await runConfigCommand(
            {
                command: {
                    args: ['base-url'],
                    resource: 'config',
                    verb: 'get',
                },
                configState,
                flags: defaultFlags,
            },
            createStore()
        );

        expect(result).toEqual({
            data: {
                key: 'base-url',
                value: 'http://localhost:8181',
            },
            type: 'json',
        });
    });

    test('unsets a single config value without clearing auth', async () => {
        const configState = await createConfigState();
        const result = await runConfigCommand(
            {
                command: {
                    args: ['base-url'],
                    resource: 'config',
                    verb: 'unset',
                },
                configState,
                flags: defaultFlags,
            },
            createStore()
        );

        expect(result.type).toBe('json');
        if (result.type !== 'json') {
            throw new Error('expected json result');
        }

        expect(result.data).toMatchObject({
            auth: {
                activeSource: 'secure-store',
            },
            config: {},
            unset: 'base-url',
        });
        expect(JSON.parse(await readFile(configState.paths.configPath, 'utf8'))).toEqual({});
    });
});
