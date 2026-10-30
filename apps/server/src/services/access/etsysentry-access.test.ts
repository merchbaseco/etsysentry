import { describe, expect, mock, test } from 'bun:test';
import { ServiceAccessError } from '@merchbaseco/access';
import {
    createEtsySentryRequestAuthorizer,
    ETSYSENTRY_API_HOST,
    ETSYSENTRY_UI_HOST,
    type ServiceAccessAdapter,
} from './etsysentry-access';

const createAdapter = (credentialKind: 'api_key' | 'oauth' | 'session'): ServiceAccessAdapter => ({
    authorize: mock(async (assertion: string) => ({
        credentialKind,
        expiresAt: 1_800_000_000_000,
        merchbaseUserId: `mbu_${assertion}`,
        principal: { accountId: `account_${assertion}` },
        service: 'etsysentry' as const,
    })),
    evaluateAccess: mock(async (merchbaseUserId: string) => ({
        merchbaseUserId,
        principal: { accountId: 'account_test' },
        service: 'etsysentry' as const,
    })),
    refreshAccess: mock(async (merchbaseUserId: string) => ({
        merchbaseUserId,
        principal: { accountId: 'account_test' },
        service: 'etsysentry' as const,
    })),
});

describe('EtsySentry Cloudflare host boundary', () => {
    test('selects the interactive verifier only for the exact UI host', async () => {
        const interactiveAccess = createAdapter('session');
        const apiAccess = createAdapter('oauth');
        const authorize = createEtsySentryRequestAuthorizer({
            apiAccess,
            appOrigin: 'https://etsysentry.merchbase.co',
            interactiveAccess,
        });

        await expect(
            authorize({
                assertion: 'signed-ui-assertion',
                host: ETSYSENTRY_UI_HOST,
                method: 'GET',
            })
        ).resolves.toMatchObject({
            credentialKind: 'session',
            expiresAt: 1_800_000_000_000,
            merchbaseUserId: 'mbu_signed-ui-assertion',
        });
        expect(interactiveAccess.authorize).toHaveBeenCalledWith('signed-ui-assertion');
        expect(apiAccess.authorize).not.toHaveBeenCalled();
    });

    test('selects the API verifier for the exact API host', async () => {
        const interactiveAccess = createAdapter('session');
        const apiAccess = createAdapter('oauth');
        const authorize = createEtsySentryRequestAuthorizer({
            apiAccess,
            appOrigin: 'https://etsysentry.merchbase.co',
            interactiveAccess,
        });

        await expect(
            authorize({ assertion: 'signed-api-assertion', host: ETSYSENTRY_API_HOST })
        ).resolves.toMatchObject({ credentialKind: 'oauth' });
        expect(apiAccess.authorize).toHaveBeenCalledWith('signed-api-assertion');
        expect(interactiveAccess.authorize).not.toHaveBeenCalled();
    });

    test('rejects unknown hosts and customer-supplied user identity headers', async () => {
        const interactiveAccess = createAdapter('session');
        const apiAccess = createAdapter('api_key');
        const authorize = createEtsySentryRequestAuthorizer({
            apiAccess,
            appOrigin: 'https://etsysentry.merchbase.co',
            interactiveAccess,
        });

        await expect(
            authorize({ assertion: 'assertion', host: 'etsysentry.merchbase.co.evil.invalid' })
        ).rejects.toMatchObject({ code: 'unauthenticated' });
        await expect(
            authorize({
                assertion: 'assertion',
                host: ETSYSENTRY_API_HOST,
                userIdHeader: 'mbu_forged',
            })
        ).rejects.toMatchObject({ code: 'unauthenticated' });
        expect(apiAccess.authorize).not.toHaveBeenCalled();
    });

    test('requires the trusted origin when an interactive request supplies Origin', async () => {
        const interactiveAccess = createAdapter('session');
        const authorize = createEtsySentryRequestAuthorizer({
            apiAccess: createAdapter('api_key'),
            appOrigin: 'https://etsysentry.merchbase.co',
            interactiveAccess,
        });

        await expect(
            authorize({
                assertion: 'signed-ui-assertion',
                host: ETSYSENTRY_UI_HOST,
                method: 'POST',
                origin: 'https://attacker.invalid',
            })
        ).rejects.toBeInstanceOf(ServiceAccessError);
        expect(interactiveAccess.authorize).not.toHaveBeenCalled();
    });

    test('requires Origin on interactive mutations and upgrades, while allowing native API callers', async () => {
        const authorize = createEtsySentryRequestAuthorizer({
            apiAccess: createAdapter('oauth'),
            appOrigin: 'https://etsysentry.merchbase.co',
            interactiveAccess: createAdapter('session'),
        });
        for (const request of [{ method: 'POST' }, { method: 'GET', upgrade: true }]) {
            await expect(
                authorize({ assertion: 'signed', host: ETSYSENTRY_UI_HOST, ...request })
            ).rejects.toMatchObject({ code: 'unauthenticated' });
            await expect(
                authorize({
                    assertion: 'signed',
                    host: ETSYSENTRY_UI_HOST,
                    ...request,
                    origin: 'https://etsysentry.merchbase.co',
                })
            ).resolves.toMatchObject({ credentialKind: 'session' });
            await expect(
                authorize({ assertion: 'signed', host: ETSYSENTRY_API_HOST, ...request })
            ).resolves.toMatchObject({ credentialKind: 'oauth' });
        }
    });

    test('allows only the exact dashboard origin on API-host browser requests', async () => {
        const apiAccess = createAdapter('oauth');
        const authorize = createEtsySentryRequestAuthorizer({
            apiAccess,
            appOrigin: 'https://etsysentry.merchbase.co',
            interactiveAccess: createAdapter('session'),
        });

        await expect(
            authorize({
                assertion: 'signed-api-assertion',
                host: ETSYSENTRY_API_HOST,
                origin: 'https://attacker.invalid',
            })
        ).rejects.toMatchObject({ code: 'unauthenticated' });
        await expect(
            authorize({
                assertion: 'signed-api-assertion',
                host: ETSYSENTRY_API_HOST,
                origin: '',
            })
        ).rejects.toMatchObject({ code: 'unauthenticated' });
        await expect(
            authorize({
                assertion: 'signed-api-assertion',
                host: ETSYSENTRY_API_HOST,
                origin: ['https://etsysentry.merchbase.co', 'https://attacker.invalid'],
            })
        ).rejects.toMatchObject({ code: 'unauthenticated' });
        await expect(
            authorize({
                assertion: 'signed-api-assertion',
                host: ETSYSENTRY_API_HOST,
                origin: 'https://etsysentry.merchbase.co',
            })
        ).resolves.toMatchObject({ credentialKind: 'oauth' });
        expect(apiAccess.authorize).toHaveBeenCalledTimes(1);
    });

    test('uses the guarded fixed development identity without an Access assertion', async () => {
        const interactiveAccess = createAdapter('session');
        const authorize = createEtsySentryRequestAuthorizer({
            apiAccess: createAdapter('oauth'),
            appOrigin: 'http://localhost:3100',
            development: true,
            interactiveAccess,
        });

        await expect(authorize({ host: 'localhost:8080' })).resolves.toMatchObject({
            credentialKind: 'session',
        });
        expect(interactiveAccess.authorize).toHaveBeenCalledWith('');
    });

    test('does not accept a missing assertion on production hosts', async () => {
        const authorize = createEtsySentryRequestAuthorizer({
            apiAccess: createAdapter('api_key'),
            appOrigin: 'https://etsysentry.merchbase.co',
            interactiveAccess: createAdapter('session'),
        });

        await expect(authorize({ host: ETSYSENTRY_API_HOST })).rejects.toMatchObject({
            code: 'unauthenticated',
        });
    });
});
