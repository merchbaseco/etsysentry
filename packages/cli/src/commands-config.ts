import { CONFIG_PATH, clearConfig, saveConfig, updateConfigFromSet } from './config.js';
import { failWith } from './errors.js';
import type { CliCommand, CliConfig, CommandRunResult } from './types.js';

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
    command: CliCommand,
    config: CliConfig
): Promise<CommandRunResult> => {
    if (command.verb === 'show') {
        return {
            data: {
                config,
                path: CONFIG_PATH,
            },
            type: 'json',
        };
    }

    if (command.verb === 'clear') {
        await clearConfig();

        return {
            data: {
                cleared: true,
                path: CONFIG_PATH,
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

        const nextConfig = updateConfigFromSet({
            config,
            key,
            value,
        });

        await saveConfig(nextConfig);

        return {
            data: {
                config: nextConfig,
                path: CONFIG_PATH,
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
