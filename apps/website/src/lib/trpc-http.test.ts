import { describe, expect, test } from 'bun:test';
import { TRPCClientError } from '@trpc/client';
import { TrpcRequestError, toTrpcRequestError } from './trpc-http';

describe('toTrpcRequestError', () => {
    test('returns the original TrpcRequestError instance unchanged', () => {
        const original = new TrpcRequestError({
            code: 'BAD_REQUEST',
            httpStatus: 400,
            message: 'Request was invalid.'
        });

        const next = toTrpcRequestError(original);

        expect(next).toBe(original);
    });

    test('maps generic Error into a TrpcRequestError', () => {
        const mapped = toTrpcRequestError(new Error('Something failed.'));

        expect(mapped).toBeInstanceOf(TrpcRequestError);
        expect(mapped.httpStatus).toBe(500);
        expect(mapped.message).toBe('Something failed.');
    });

    test('maps non-error input into a default TrpcRequestError', () => {
        const mapped = toTrpcRequestError('unexpected');

        expect(mapped).toBeInstanceOf(TrpcRequestError);
        expect(mapped.httpStatus).toBe(500);
        expect(mapped.message).toBe('Unexpected request failure.');
    });

    test('maps TRPCClientError metadata into TrpcRequestError', () => {
        const trpcError = new TRPCClientError('Procedure failed.', {
            result: {
                error: {
                    data: {
                        code: 'BAD_REQUEST',
                        httpStatus: 400
                    }
                }
            }
        });

        const mapped = toTrpcRequestError(trpcError);

        expect(mapped).toBeInstanceOf(TrpcRequestError);
        expect(mapped.code).toBe('BAD_REQUEST');
        expect(mapped.httpStatus).toBe(400);
        expect(mapped.message).toBe('Procedure failed.');
    });
});
