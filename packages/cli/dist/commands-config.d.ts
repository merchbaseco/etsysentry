import type { CliSecureStore } from './secure-store.js';
import type { CliCommand, CliFlags, CommandRunResult, LoadedCliConfig } from './types.js';
export declare const runConfigCommand: (params: {
    command: CliCommand;
    configState: LoadedCliConfig;
    flags: CliFlags;
}, store?: CliSecureStore) => Promise<CommandRunResult>;
