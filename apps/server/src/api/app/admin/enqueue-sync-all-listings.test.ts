import { describe, expect, test } from 'bun:test';
import { appRouter } from '../router';
import type { TrpcContext } from '../../context';

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
            sub: 'user-1'
        }
    };
};

describe('admin enqueue sync all listings procedure', () => {
    test('rejects non-admin user', async () => {
        const caller = appRouter.createCaller(
            createContext({
                email: 'user@example.com',
                isAdmin: false
            })
        );

        await expect(caller.admin.enqueueSyncAllListings({})).rejects.toMatchObject({
            code: 'FORBIDDEN',
            message: 'Admin access required.'
        });
    });
});
