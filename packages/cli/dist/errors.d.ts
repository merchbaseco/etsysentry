interface CliErrorParams {
    code: string;
    details?: unknown;
    message: string;
}
export declare class CliError extends Error {
    readonly code: string;
    readonly details?: unknown;
    constructor(params: CliErrorParams);
}
export declare const toCliError: (error: unknown) => CliError;
export declare const failWith: (params: CliErrorParams) => never;
export {};
