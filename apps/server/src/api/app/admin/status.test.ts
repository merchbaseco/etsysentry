import { describe, expect, test } from 'bun:test';
import type { TrpcContext } from '../../context';
import { appRouter } from '../router';

const createContext = (params: { email?: string; isAdmin: boolean }): TrpcContext => {
    return {
        accessError: null,
        authType: 'access',
        credentialKind: 'session',
        isAdmin: params.isAdmin,
        reply: {} as never,
        request: {} as never,
        requestId: 'request-1',
        accountId: 'tenant-1',
        merchbaseUserId: 'mbu_test',
        user: {
            credentialKind: 'session',
            merchbaseUserId: 'mbu_test',
        },
    };
};

describe('admin status procedure', () => {
    test('allows admin user', async () => {
        const caller = appRouter.createCaller(
            createContext({
                isAdmin: true,
            })
        );

        const result = await caller.admin.status({});

        expect(result).toEqual({
            email: null,
            isAdmin: true,
            accountId: 'tenant-1',
        });
    });

    test('rejects non-admin user', async () => {
        const caller = appRouter.createCaller(
            createContext({
                email: 'user@example.com',
                isAdmin: false,
            })
        );

        await expect(caller.admin.status({})).rejects.toMatchObject({
            code: 'FORBIDDEN',
            message: 'Admin access required.',
        });
    });
});
