import { describe, expect, mock, test } from 'bun:test';
import { ServiceAccessError } from '@merchbaseco/access';
import { createTrpcContext, isAdminMerchbaseUser } from './context';

const createContextOptions = (credential: string) =>
    ({
        req: {
            headers: {
                authorization: `Bearer ${credential}`,
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
    test('uses the unified access boundary and preserves OAuth credential kind', async () => {
        const authorize = mock(async () => ({
            credentialKind: 'oauth' as const,
            merchbaseUserId: 'mbu_test',
            principal: {
                accountId: 'account-test',
                merchbaseUserId: 'mbu_test',
            },
        }));

        const context = await createTrpcContext(createContextOptions('oat_test'), {
            authorize,
        } as never);

        expect(authorize).toHaveBeenCalledWith('oat_test');
        expect(context).toMatchObject({
            accessError: null,
            accountId: 'account-test',
            authType: 'access',
            credentialKind: 'oauth',
            isAdmin: false,
            merchbaseUserId: 'mbu_test',
            user: {
                credentialKind: 'oauth',
                merchbaseUserId: 'mbu_test',
            },
        });
    });

    test('preserves unavailable access without a second authorization attempt', async () => {
        const authorize = mock(() => Promise.reject(new ServiceAccessError('access_unavailable')));

        const context = await createTrpcContext(createContextOptions('one.two.three'), {
            authorize,
        } as never);

        expect(authorize).toHaveBeenCalledTimes(1);
        expect(context).toMatchObject({
            accessError: 'access_unavailable',
            accountId: null,
            authType: 'none',
            credentialKind: null,
        });
    });
});
