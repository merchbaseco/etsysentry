import { describe, expect, mock, test } from 'bun:test';
import { ServiceAccessError } from '@merchbaseco/access';
import { authorizeEtsySentryCredential } from './authorize-credential';

const createAccess = () => ({
    apiKeyAccess: {
        authorize: mock(async () => ({ credentialKind: 'api_key' as const })),
    },
    oauthAccess: {
        authorize: mock(async () => ({ credentialKind: 'oauth' as const })),
    },
    sessionAccess: {
        authorize: mock(async () => ({ credentialKind: 'session' as const })),
    },
});

describe('EtsySentry credential router', () => {
    test('routes suite API keys, OAuth tokens, and JWT-shaped sessions directly', async () => {
        const access = createAccess();

        await expect(
            authorizeEtsySentryCredential(access as never, 'ak_suite-key')
        ).resolves.toMatchObject({ credentialKind: 'api_key' });
        await expect(
            authorizeEtsySentryCredential(access as never, 'oat_oauth-token')
        ).resolves.toMatchObject({ credentialKind: 'oauth' });
        await expect(
            authorizeEtsySentryCredential(access as never, 'one.two.three')
        ).resolves.toMatchObject({ credentialKind: 'session' });

        expect(access.apiKeyAccess.authorize).toHaveBeenCalledWith('ak_suite-key');
        expect(access.oauthAccess.authorize).toHaveBeenCalledWith('oat_oauth-token');
        expect(access.sessionAccess.authorize).toHaveBeenCalledWith('one.two.three');
    });

    test('falls back from JWT session auth to OAuth only when unauthenticated', async () => {
        const access = createAccess();
        access.sessionAccess.authorize.mockRejectedValueOnce(
            new ServiceAccessError('unauthenticated')
        );

        await expect(
            authorizeEtsySentryCredential(access as never, 'one.two.three')
        ).resolves.toMatchObject({ credentialKind: 'oauth' });

        access.sessionAccess.authorize.mockRejectedValueOnce(
            new ServiceAccessError('access_unavailable')
        );

        await expect(
            authorizeEtsySentryCredential(access as never, 'four.five.six')
        ).rejects.toMatchObject({ code: 'access_unavailable' });
        expect(access.oauthAccess.authorize).toHaveBeenCalledTimes(1);
    });

    test('fails closed for retired local keys and malformed credentials', async () => {
        const access = createAccess();

        for (const credential of ['esk_retired', 'ak', 'oat', 'not-a-token', 'one..three']) {
            await expect(
                authorizeEtsySentryCredential(access as never, credential)
            ).rejects.toMatchObject({ code: 'unauthenticated' });
        }

        expect(access.apiKeyAccess.authorize).not.toHaveBeenCalled();
        expect(access.oauthAccess.authorize).not.toHaveBeenCalled();
        expect(access.sessionAccess.authorize).not.toHaveBeenCalled();
    });
});
