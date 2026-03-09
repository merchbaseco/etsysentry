import { runConfigCommand } from './commands-config.js';
import { runMetaCommand } from './commands-meta.js';
import { runPublicCommand } from './commands-public.js';
import { loadConfigState } from './config.js';
export const runCommand = async (params) => {
    if (params.command.resource === 'meta') {
        return runMetaCommand(params.command);
    }
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
