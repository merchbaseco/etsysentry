import { afterEach, describe, expect, mock, test } from 'bun:test';
import { TRPCError } from '@trpc/server';
import type { FastifyInstance } from 'fastify';
import { buildServer } from './index';
import type { EtsySentryAccess } from './services/access/etsysentry-access';
import { ETSYSENTRY_INTERNAL_HOST, ETSYSENTRY_UI_HOST } from './services/access/etsysentry-access';

let server: FastifyInstance | null = null;

afterEach(async () => {
    if (!server) {
        return;
    }

    await server.close();
    server = null;
});

const createAccessFixture = (options?: {
    credentialKind?: 'api_key' | 'oauth' | 'session';
    expiresAt?: number | null;
}) => {
    const authorizeRequest = mock(async () => ({
        credentialKind: options?.credentialKind ?? 'session',
        expiresAt: options?.expiresAt ?? 1_900_000_000_000,
        merchbaseUserId: 'mbu_session_fixture',
        principal: { accountId: 'acct_session_fixture' },
        service: 'etsysentry' as const,
    }));
    const createProjectionHandler = mock(
        () => () => Promise.resolve(new Response(null, { status: 202 }))
    );

    return {
        access: {
            apiAccess: {},
            authorizeRequest,
            createProjectionHandler,
            interactiveAccess: {},
            projections: {},
        } as unknown as EtsySentryAccess,
        authorizeRequest,
        createProjectionHandler,
    };
};

describe('oauth callback route', () => {
    test('escapes oauth error text from query params', async () => {
        server = await buildServer({ logger: false });

        const response = await server.inject({
            method: 'GET',
            url:
                '/auth/etsy/callback?error=access_denied&' +
                'error_description=%3Cscript%3Ealert(1)%3C%2Fscript%3E',
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(response.body).not.toContain('<script>alert(1)</script>');
    });

    test('returns 400 when oauth state is invalid', async () => {
        server = await buildServer({ logger: false });

        const response = await server.inject({
            method: 'GET',
            url: '/auth/etsy/callback?code=code-1&state=missing-state',
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('OAuth state was invalid or expired');
    });

    test('returns success page when oauth completion succeeds', async () => {
        server = await buildServer({
            completeOAuthFlow: async () => ({
                connected: true,
                expiresAt: new Date(1_234_567_890),
                needsRefresh: false,
                scopes: ['listings_r'],
            }),
            logger: false,
        });

        const response = await server.inject({
            method: 'GET',
            url: '/auth/etsy/callback?code=code-1&state=state-1',
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toContain('Etsy connected');
    });

    test('returns 500 for non-trpc callback errors', async () => {
        server = await buildServer({
            completeOAuthFlow: () => Promise.reject(new Error('network failure')),
            logger: false,
        });

        const response = await server.inject({
            method: 'GET',
            url: '/auth/etsy/callback?code=code-1&state=state-1',
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toContain('Token exchange failed.');
    });

    test('maps BAD_REQUEST trpc errors to 400', async () => {
        server = await buildServer({
            completeOAuthFlow: () =>
                Promise.reject(
                    new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'bad state',
                    })
                ),
            logger: false,
        });

        const response = await server.inject({
            method: 'GET',
            url: '/auth/etsy/callback?code=code-1&state=state-1',
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('bad state');
    });
});

describe('Cloudflare session and internal receiver routes', () => {
    test('bootstraps only a session identity on the exact UI host without caching', async () => {
        const { access, authorizeRequest } = createAccessFixture();
        server = await buildServer({ access, logger: false });

        const response = await server.inject({
            method: 'GET',
            url: '/auth/session',
            headers: {
                'cf-access-jwt-assertion': 'signed-ui-assertion',
                host: ETSYSENTRY_UI_HOST,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(JSON.parse(response.body)).toEqual({
            authenticated: true,
            merchbaseUserId: 'mbu_session_fixture',
        });
        expect(authorizeRequest).toHaveBeenCalledTimes(1);
    });

    test('rejects API-person session bootstrap and wrong UI hosts', async () => {
        const { access, authorizeRequest } = createAccessFixture({ credentialKind: 'oauth' });
        server = await buildServer({ access, logger: false });

        const apiHost = await server.inject({
            method: 'GET',
            url: '/auth/session',
            headers: {
                'cf-access-jwt-assertion': 'signed-api-assertion',
                host: 'etsysentry-api.merchbase.co',
            },
        });
        const wrongUiHost = await server.inject({
            method: 'GET',
            url: '/auth/session',
            headers: {
                'cf-access-jwt-assertion': 'signed-ui-assertion',
                host: `${ETSYSENTRY_UI_HOST}.evil.invalid`,
            },
        });

        expect(apiHost.statusCode).toBe(404);
        expect(wrongUiHost.statusCode).toBe(404);
        expect(authorizeRequest).not.toHaveBeenCalled();
    });

    test('delivers snapshots only on the exact internal host', async () => {
        const { access, createProjectionHandler } = createAccessFixture();
        server = await buildServer({ access, logger: false });

        const accepted = await server.inject({
            method: 'POST',
            url: '/api/internal/access-snapshot',
            headers: {
                'cf-access-jwt-assertion': 'signed-internal-assertion',
                'content-type': 'application/json',
                host: ETSYSENTRY_INTERNAL_HOST,
            },
            payload: { event: 'fixture' },
        });
        const rejected = await server.inject({
            method: 'POST',
            url: '/api/internal/access-snapshot',
            headers: { host: ETSYSENTRY_UI_HOST },
            payload: { event: 'fixture' },
        });

        expect(accepted.statusCode).toBe(202);
        expect(rejected.statusCode).toBe(404);
        expect(createProjectionHandler).toHaveBeenCalledTimes(1);
    });
});
