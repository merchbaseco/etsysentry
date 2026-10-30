import { describe, expect, mock, test } from 'bun:test';
import { ServiceAccessError } from '@merchbaseco/access';
import { createTrpcContext, isAdminMerchbaseUser } from './context';

const createContextOptions = (assertion: string) =>
    ({
        req: {
            headers: {
                'cf-access-jwt-assertion': assertion,
                host: 'etsysentry-api.merchbase.co',
            },
            id: 'request-test',
        },
        res: {},
    }) as never;

describe('context admin identity matching', () => {
    test('matches only the configured stable Merchbase user ID', () => {
        expect(isAdminMerchbaseUser('mbu_admin', 'mbu_admin')).toBe(true);
        expect(isAdminMerchbaseUser('mbu_other', 'mbu_admin')).toBe(false);
    });

    test('fails closed when no stable admin identity is configured', () => {
        expect(isAdminMerchbaseUser('mbu_admin', undefined)).toBe(false);
    });
});

describe('context credential authorization', () => {
    test('uses the host-selected access boundary and preserves API person kind', async () => {
        const authorizeRequest = mock(async () => ({
            credentialKind: 'oauth' as const,
            expiresAt: 1_800_000_000_000,
            merchbaseUserId: 'mbu_test',
            principal: {
                accountId: 'account-test',
                merchbaseUserId: 'mbu_test',
            },
            service: 'etsysentry' as const,
        }));

        const context = await createTrpcContext(createContextOptions('signed-api-assertion'), {
            authorizeRequest,
        } as never);

        expect(authorizeRequest).toHaveBeenCalledWith({
            assertion: 'signed-api-assertion',
            host: 'etsysentry-api.merchbase.co',
            method: undefined,
            origin: undefined,
            userIdHeader: undefined,
        });
        expect(context).toMatchObject({
            accessError: null,
            accountId: 'account-test',
            authType: 'access',
            credentialKind: 'oauth',
            expiresAt: 1_800_000_000_000,
            isAdmin: false,
            merchbaseUserId: 'mbu_test',
            user: {
                credentialKind: 'oauth',
                merchbaseUserId: 'mbu_test',
            },
        });
    });

    test('preserves unavailable access without a second authorization attempt', async () => {
        const authorizeRequest = mock(() =>
            Promise.reject(new ServiceAccessError('access_unavailable'))
        );

        const context = await createTrpcContext(createContextOptions('invalid-assertion'), {
            authorizeRequest,
        } as never);

        expect(authorizeRequest).toHaveBeenCalledTimes(1);
        expect(context).toMatchObject({
            accessError: 'access_unavailable',
            accountId: null,
            authType: 'none',
            credentialKind: null,
        });
    });
});
