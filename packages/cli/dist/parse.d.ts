import type { CliCommand, CliFlags } from './types.js';
export declare const parseCliInput: () => {
    flags: CliFlags;
    positionals: string[];
};
export declare const resolveCommand: (positionals: string[]) => CliCommand | null;
