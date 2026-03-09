import { failWith } from './errors.js';
import { loadChangelog } from './metadata.js';
import type { CliCommand, CommandRunResult } from './types.js';

export const runMetaCommand = async (command: CliCommand): Promise<CommandRunResult> => {
    if (command.resource === 'meta' && command.verb === 'changelog') {
        return {
            text: await loadChangelog(),
            type: 'text',
        };
    }

    failWith({
        code: 'BAD_REQUEST',
        message: `Unknown metadata command: ${command.resource} ${command.verb}`,
    });

    throw new Error('Unreachable');
};
