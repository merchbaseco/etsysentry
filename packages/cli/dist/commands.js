import { runConfigCommand } from './commands-config.js';
import { runPublicCommand } from './commands-public.js';
import { loadConfig } from './config.js';
export const runCommand = async (params) => {
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
