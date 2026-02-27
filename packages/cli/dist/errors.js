import { TRPCClientError } from '@trpc/client';
export class CliError extends Error {
    code;
    details;
    constructor(params) {
        super(params.message);
        this.name = 'CliError';
        this.code = params.code;
        this.details = params.details;
    }
}
const TRPC_CODE_TO_CLI_CODE = {
    BAD_REQUEST: 'BAD_REQUEST',
    CONFLICT: 'CONFLICT',
    FORBIDDEN: 'FORBIDDEN',
    INTERNAL_SERVER_ERROR: 'INTERNAL_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    PRECONDITION_FAILED: 'PRECONDITION_FAILED',
    TOO_MANY_REQUESTS: 'RATE_LIMITED',
    UNAUTHORIZED: 'UNAUTHORIZED',
};
const toTrpcCliCode = (code) => {
    if (!code) {
        return 'INTERNAL_ERROR';
    }
    return TRPC_CODE_TO_CLI_CODE[code] ?? 'INTERNAL_ERROR';
};
export const toCliError = (error) => {
    if (error instanceof CliError) {
        return error;
    }
    if (error instanceof TRPCClientError) {
        return new CliError({
            code: toTrpcCliCode(error.data?.code),
            details: typeof error.data?.httpStatus === 'number'
                ? { httpStatus: error.data.httpStatus }
                : undefined,
            message: error.message || 'tRPC request failed.',
        });
    }
    if (error instanceof Error) {
        return new CliError({
            code: 'INTERNAL_ERROR',
            message: error.message || 'Unexpected request failure.',
        });
    }
    return new CliError({
        code: 'INTERNAL_ERROR',
        message: 'Unexpected request failure.',
    });
};
export const failWith = (params) => {
    throw new CliError(params);
};
