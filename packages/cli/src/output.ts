import { DEFAULT_PRETTY_JSON } from './constants.js';
import type { CliError } from './errors.js';

interface CliSuccess<T> {
    data: T;
    ok: true;
}

interface CliFailure {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
    ok: false;
}

const outputPretty = DEFAULT_PRETTY_JSON;

export const printSuccess = <T>(data: T): void => {
    const envelope: CliSuccess<T> = {
        ok: true,
        data,
    };

    console.log(JSON.stringify(envelope, null, outputPretty ? 2 : undefined));
};

export const printFailure = (error: CliError): never => {
    const envelope: CliFailure = {
        ok: false,
        error: {
            code: error.code,
            message: error.message,
            ...(error.details !== undefined ? { details: error.details } : {}),
        },
    };

    console.error(JSON.stringify(envelope, null, outputPretty ? 2 : undefined));
    process.exit(1);
};
