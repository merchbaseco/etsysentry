import type { CliCommand, CliConfig, CliFlags, CommandRunResult } from './types.js';
export declare const runPublicCommand: (params: {
    command: CliCommand;
    config: CliConfig;
    flags: CliFlags;
}) => Promise<CommandRunResult>;
