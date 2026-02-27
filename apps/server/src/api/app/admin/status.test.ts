import { describe, expect, test } from 'bun:test';
import type { TrpcContext } from '../../context';
import { appRouter } from '../router';

const createContext = (params: { email?: string; isAdmin: boolean }): TrpcContext => {
    return {
        authType: 'clerk',
        isAdmin: params.isAdmin,
        reply: {} as never,
        request: {} as never,
        requestId: 'request-1',
        accountId: 'tenant-1',
        user: {
            email: params.email,
            issuer: 'https://clerk.example',
            orgId: null,
            sub: 'user-1',
        },
    };
};

describe('admin status procedure', () => {
    test('allows admin user', async () => {
        const caller = appRouter.createCaller(
            createContext({
                email: 'admin@example.com',
                isAdmin: true,
            })
        );

        const result = await caller.admin.status({});

        expect(result).toEqual({
            email: 'admin@example.com',
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
