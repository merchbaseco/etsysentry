import { runConfigCommand } from './commands-config.js';
import { runPublicCommand } from './commands-public.js';
import { loadConfig } from './config.js';
import type { CliCommand, CliFlags, CommandRunResult } from './types.js';

export const runCommand = async (params: {
    command: CliCommand;
    flags: CliFlags;
}): Promise<CommandRunResult> => {
    const config = await loadConfig();

    if (params.command.resource === 'config') {
        return runConfigCommand(params.command, config);
    }

    return runPublicCommand({
        command: params.command,
        config,
        flags: params.flags,
    });
};
