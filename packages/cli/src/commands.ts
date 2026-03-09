import { runConfigCommand } from './commands-config.js';
import { runPublicCommand } from './commands-public.js';
import { loadConfigState } from './config.js';
import type { CliCommand, CliFlags, CommandRunResult } from './types.js';

export const runCommand = async (params: {
    command: CliCommand;
    flags: CliFlags;
}): Promise<CommandRunResult> => {
    const configState = await loadConfigState();

    if (params.command.resource === 'config') {
        return runConfigCommand(params.command, configState);
    }

    return runPublicCommand({
        command: params.command,
        config: configState.config,
        flags: params.flags,
    });
};
