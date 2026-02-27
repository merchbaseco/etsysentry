import type { CliCommand, CliFlags, CommandRunResult } from './types.js';
export declare const runCommand: (params: {
    command: CliCommand;
    flags: CliFlags;
}) => Promise<CommandRunResult>;
