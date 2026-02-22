import { TRPCClientError } from '@trpc/client';

export class TrpcRequestError extends Error {
    readonly code?: string;
    readonly httpStatus: number;

    constructor(params: {
        code?: string;
        httpStatus: number;
        message: string;
    }) {
        super(params.message);
        this.name = 'TrpcRequestError';
        this.code = params.code;
        this.httpStatus = params.httpStatus;
    }
}

export const toTrpcRequestError = (error: unknown): TrpcRequestError => {
    if (error instanceof TrpcRequestError) {
        return error;
    }

    if (error instanceof TRPCClientError) {
        const httpStatus = error.data?.httpStatus;
        const code = error.data?.code;

        return new TrpcRequestError({
            code,
            httpStatus: typeof httpStatus === 'number' ? httpStatus : 500,
            message: error.message || 'tRPC request failed.'
        });
    }

    if (error instanceof Error) {
        return new TrpcRequestError({
            httpStatus: 500,
            message: error.message || 'Unexpected request failure.'
        });
    }

    return new TrpcRequestError({
        httpStatus: 500,
        message: 'Unexpected request failure.'
    });
};
