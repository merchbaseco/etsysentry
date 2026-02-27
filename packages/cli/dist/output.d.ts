import type { CliError } from './errors.js';
export declare const printSuccess: <T>(data: T) => void;
export declare const printFailure: (error: CliError) => never;
