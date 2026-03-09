import type { CliCommand, CommandRunResult, LoadedCliConfig } from './types.js';
export declare const runConfigCommand: (command: CliCommand, configState: LoadedCliConfig) => Promise<CommandRunResult>;
