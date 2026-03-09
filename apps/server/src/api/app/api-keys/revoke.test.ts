import { describe, expect, mock, test } from 'bun:test';
import type { ApiKeyRecord } from '../../../services/auth/api-keys-service';
import type { TrpcContext } from '../../context';

const createApiKey = mock(() => {
    throw new Error('not implemented');
});
const deleteApiKeyById = mock<
    (params: { accountId: string; apiKeyId: string }) => Promise<ApiKeyRecord | null>
>(() => {
    return Promise.resolve(null);
});
const listApiKeysByAccountId = mock(() => {
    return Promise.resolve({
        items: [],
    });
});

mock.module('../../../services/auth/api-keys-service', () => ({
    createApiKey,
    deleteApiKeyById,
    listApiKeysByAccountId,
}));

const { appRouter } = await import('../router');

const createContext = (): TrpcContext => {
    return {
        authType: 'clerk',
        isAdmin: false,
        reply: {} as never,
        request: {} as never,
        requestId: 'request-1',
        accountId: 'account-1',
        apiKey: null,
        apiKeyError: undefined,
        user: {
            email: 'user@example.com',
            issuer: 'https://clerk.example',
            orgId: null,
            sub: 'user-1',
        },
    };
};

describe('apiKeys.revoke', () => {
    test('deletes the API key for the account', async () => {
        deleteApiKeyById.mockResolvedValueOnce({
            accountId: 'account-1',
            createdAt: '2026-03-09T19:20:55.090Z',
            id: '66aa9836-72be-41e4-b852-5114db23ccc8',
            keyPrefix: 'api-key-prefix-1',
            lastUsedAt: null,
            name: 'API key',
            ownerClerkUserId: 'user-1',
            updatedAt: '2026-03-09T19:20:55.090Z',
        });

        const caller = appRouter.createCaller(createContext());
        const result = await caller.apiKeys.revoke({
            apiKeyId: '66aa9836-72be-41e4-b852-5114db23ccc8',
        });

        expect(result.id).toBe('66aa9836-72be-41e4-b852-5114db23ccc8');
        expect(deleteApiKeyById).toHaveBeenCalledWith({
            accountId: 'account-1',
            apiKeyId: '66aa9836-72be-41e4-b852-5114db23ccc8',
        });
    });

    test('returns not found when the API key does not exist', async () => {
        deleteApiKeyById.mockResolvedValueOnce(null);

        const caller = appRouter.createCaller(createContext());

        await expect(
            caller.apiKeys.revoke({
                apiKeyId: '66aa9836-72be-41e4-b852-5114db23ccc8',
            })
        ).rejects.toMatchObject({
            code: 'NOT_FOUND',
            message: 'API key not found for this account.',
        });
    });
});
