#!/usr/bin/env node

import { runCommand } from './commands.js';
import { failWith, toCliError } from './errors.js';
import { printUsage } from './help.js';
import { printFailure, printSuccess } from './output.js';
import { parseCliInput, resolveCommand } from './parse.js';

const main = async (): Promise<void> => {
    const { flags, positionals } = parseCliInput();

    if (flags.help || positionals.length === 0 || positionals[0] === 'help') {
        printUsage();
        return;
    }

    const command = resolveCommand(positionals);

    if (!command) {
        failWith({
            code: 'BAD_REQUEST',
            message: `Unknown command: ${positionals.join(' ')}`,
        });

        throw new Error('Unreachable');
    }

    const result = await runCommand({
        command,
        flags,
    });

    if (result.type === 'table') {
        console.log(result.table);
        return;
    }

    printSuccess(result.data);
};

await main().catch((error: unknown) => {
    const cliError = toCliError(error);
    printFailure(cliError);
});
