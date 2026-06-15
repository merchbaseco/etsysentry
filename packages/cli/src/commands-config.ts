import { resolveAuthStatus } from './auth.js';
import {
    getConfigValue,
    resetConfig,
    saveConfig,
    switchStorageDir,
    unsetStorageDir,
    updateConfigFromSet,
    updateConfigFromUnset,
} from './config.js';
import { failWith } from './errors.js';
import type { CliSecureStore } from './secure-store.js';
import { secureStore } from './secure-store.js';
import { normalizeStorageDir } from './storage.js';
import type { CliCommand, CliFlags, CommandRunResult, LoadedCliConfig } from './types.js';

const CONFIG_KEYS = ['base-url', 'storage-dir'] as const;

type ConfigKey = (typeof CONFIG_KEYS)[number];

const requireArg = (params: { args: string[]; index?: number; message: string }): string => {
    const value = params.args[params.index ?? 0]?.trim();

    if (!value) {
        failWith({
            code: 'BAD_REQUEST',
            message: params.message,
        });
    }

    return value;
};

export const runConfigCommand = async (
    params: {
        command: CliCommand;
        configState: LoadedCliConfig;
        flags: CliFlags;
    },
    store: CliSecureStore = secureStore
): Promise<CommandRunResult> => {
    if (params.command.verb === 'show') {
        return {
            data: await buildConfigResponse(params.configState, params.flags, store),
            type: 'json',
        };
    }

    if (params.command.verb === 'get') {
        const key = requireConfigKey(params.command.args[0], 'config get');

        return {
            data: {
                key,
                value: getConfigValue({
                    config: params.configState.config,
                    key,
                    paths: params.configState.paths,
                }),
            },
            type: 'json',
        };
    }

    if (params.command.verb === 'unset') {
        const key = requireConfigKey(params.command.args[0], 'config unset');
        const nextConfigState =
            key === 'storage-dir'
                ? await unsetStorageDir()
                : await unsetConfigValue(key, params.configState);

        return {
            data: {
                ...(await buildConfigResponse(nextConfigState, params.flags, store)),
                unset: key,
            },
            type: 'json',
        };
    }

    if (params.command.verb === 'reset') {
        const nextConfigState = await resetConfig(params.configState.paths);

        return {
            data: {
                ...(await buildConfigResponse(nextConfigState, params.flags, store)),
                reset: true,
            },
            type: 'json',
        };
    }

    if (params.command.verb === 'set') {
        const key = requireArg({
            args: params.command.args,
            index: 0,
            message: 'config set requires <key> <value>.',
        });
        const value = params.command.args.slice(1).join(' ').trim();

        if (!value) {
            failWith({
                code: 'BAD_REQUEST',
                message: 'config set value cannot be empty.',
            });
        }

        if (key === 'storage-dir') {
            const nextConfigState = await switchStorageDir({
                config: params.configState.config,
                currentPaths: params.configState.paths,
                nextStorageDir: normalizeStorageDir(value),
            });

            return {
                data: await buildConfigResponse(nextConfigState, params.flags, store),
                type: 'json',
            };
        }

        const nextConfig = updateConfigFromSet({
            config: params.configState.config,
            key,
            value,
        });

        await saveConfig({
            config: nextConfig,
            configPath: params.configState.paths.configPath,
        });

        return {
            data: await buildConfigResponse(
                {
                    config: nextConfig,
                    paths: params.configState.paths,
                },
                params.flags,
                store
            ),
            type: 'json',
        };
    }

    failWith({
        code: 'BAD_REQUEST',
        message: `Unknown config command: ${params.command.verb}`,
    });

    throw new Error('Unreachable');
};

const buildConfigResponse = async (
    configState: LoadedCliConfig,
    flags: CliFlags,
    store: CliSecureStore
) => {
    return {
        auth: await resolveAuthStatus({ flags }, store),
        config: configState.config,
        path: configState.paths.configPath,
        storageDir: configState.paths.storageDir,
    };
};

const requireConfigKey = (key: string | undefined, commandName: string): ConfigKey => {
    if (!key) {
        failWith({
            code: 'BAD_REQUEST',
            message: `${commandName} requires <key>.`,
            details: {
                supportedKeys: CONFIG_KEYS,
            },
        });
    }

    if (typeof key === 'string' && isConfigKey(key)) {
        return key;
    }

    failWith({
        code: 'BAD_REQUEST',
        message: 'Unsupported config key.',
        details: {
            key,
            supportedKeys: CONFIG_KEYS,
        },
    });

    throw new Error('Unreachable');
};

const isConfigKey = (key: string): key is ConfigKey => {
    return CONFIG_KEYS.includes(key as ConfigKey);
};

const unsetConfigValue = async (
    key: ConfigKey,
    configState: LoadedCliConfig
): Promise<LoadedCliConfig> => {
    const nextConfig = updateConfigFromUnset({
        config: configState.config,
        key,
    });

    await saveConfig({
        config: nextConfig,
        configPath: configState.paths.configPath,
    });

    return {
        config: nextConfig,
        paths: configState.paths,
    };
};
