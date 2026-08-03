import { describe, expect, test } from 'bun:test';
import type { TrpcContext } from './context';
import { appProcedure, publicProcedure, router } from './trpc';

const testRouter = router({
    appViewer: appProcedure.query(({ ctx }) => ctx.credentialKind),
    publicViewer: publicProcedure.query(({ ctx }) => ctx.credentialKind),
});

const createContext = (
    credentialKind: 'api_key' | 'oauth' | 'session',
    accessError: TrpcContext['accessError'] = null
): TrpcContext =>
    ({
        accessError,
        accountId: 'account-test',
        authType: accessError ? 'none' : 'access',
        credentialKind: accessError ? null : credentialKind,
        isAdmin: false,
        merchbaseUserId: 'mbu_test',
        reply: {} as never,
        request: {} as never,
        requestId: 'request-test',
        user: accessError
            ? null
            : {
                  credentialKind,
                  merchbaseUserId: 'mbu_test',
              },
    }) as TrpcContext;

describe('tRPC credential boundaries', () => {
    test('allows shared OAuth credentials on the public API', async () => {
        const caller = testRouter.createCaller(createContext('oauth'));

        await expect(caller.publicViewer()).resolves.toBe('oauth');
    });

    test('keeps the app API session-only', async () => {
        const caller = testRouter.createCaller(createContext('oauth'));

        await expect(caller.appViewer()).rejects.toMatchObject({
            code: 'UNAUTHORIZED',
        });
    });

    test('preserves unavailable access at the procedure boundary', async () => {
        const caller = testRouter.createCaller(createContext('session', 'access_unavailable'));

        await expect(caller.publicViewer()).rejects.toMatchObject({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Merchbase access is temporarily unavailable.',
        });
    });
});
