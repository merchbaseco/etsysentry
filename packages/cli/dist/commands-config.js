import { clearConfig, saveConfig, switchStorageDir, updateConfigFromSet } from './config.js';
import { failWith } from './errors.js';
import { normalizeStorageDir } from './storage.js';
const requireArg = (params) => {
    const value = params.args[params.index ?? 0]?.trim();
    if (!value) {
        failWith({
            code: 'BAD_REQUEST',
            message: params.message,
        });
    }
    return value;
};
export const runConfigCommand = async (command, configState) => {
    if (command.verb === 'show') {
        return {
            data: {
                config: configState.config,
                path: configState.paths.configPath,
                storageDir: configState.paths.storageDir,
            },
            type: 'json',
        };
    }
    if (command.verb === 'clear') {
        await clearConfig(configState.paths.configPath);
        return {
            data: {
                cleared: true,
                path: configState.paths.configPath,
                storageDir: configState.paths.storageDir,
            },
            type: 'json',
        };
    }
    if (command.verb === 'set') {
        const key = requireArg({
            args: command.args,
            index: 0,
            message: 'config set requires <key> <value>.',
        });
        const value = command.args.slice(1).join(' ').trim();
        if (!value) {
            failWith({
                code: 'BAD_REQUEST',
                message: 'config set value cannot be empty.',
            });
        }
        if (key === 'storage-dir') {
            const nextConfigState = await switchStorageDir({
                config: configState.config,
                currentPaths: configState.paths,
                nextStorageDir: normalizeStorageDir(value),
            });
            return {
                data: {
                    config: nextConfigState.config,
                    path: nextConfigState.paths.configPath,
                    storageDir: nextConfigState.paths.storageDir,
                },
                type: 'json',
            };
        }
        const nextConfig = updateConfigFromSet({
            config: configState.config,
            key,
            value,
        });
        await saveConfig({
            config: nextConfig,
            configPath: configState.paths.configPath,
        });
        return {
            data: {
                config: nextConfig,
                path: configState.paths.configPath,
                storageDir: configState.paths.storageDir,
            },
            type: 'json',
        };
    }
    failWith({
        code: 'BAD_REQUEST',
        message: `Unknown config command: ${command.verb}`,
    });
    throw new Error('Unreachable');
};
