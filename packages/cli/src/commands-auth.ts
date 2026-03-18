import { resolveAuthStatus, storeApiKeyFromCommand } from './auth.js';
import { failWith } from './errors.js';
import type { CliSecureStore } from './secure-store.js';
import { secureStore } from './secure-store.js';
import type { CliCommand, CliFlags, CommandRunResult } from './types.js';

export const runAuthCommand = async (
    params: {
        command: CliCommand;
        flags: CliFlags;
    },
    store: CliSecureStore = secureStore
): Promise<CommandRunResult> => {
    if (params.command.verb === 'set') {
        const result = await storeApiKeyFromCommand(params, store);

        return {
            data: {
                source: result.source,
                stored: true,
                store: await store.getStatus(),
            },
            type: 'json',
        };
    }

    if (params.command.verb === 'status') {
        return {
            data: await resolveAuthStatus(params, store),
            type: 'json',
        };
    }

    if (params.command.verb === 'clear') {
        return {
            data: {
                cleared: await store.clearApiKey(),
                store: await store.getStatus(),
            },
            type: 'json',
        };
    }

    failWith({
        code: 'BAD_REQUEST',
        message: `Unknown auth command: ${params.command.verb}`,
    });

    throw new Error('Unreachable');
};
