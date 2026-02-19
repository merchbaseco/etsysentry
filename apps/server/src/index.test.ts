import { afterEach, describe, expect, test } from 'bun:test';
import { TRPCError } from '@trpc/server';
import type { FastifyInstance } from 'fastify';
import { buildServer } from './index';

let server: FastifyInstance | null = null;

afterEach(async () => {
    if (!server) {
        return;
    }

    await server.close();
    server = null;
});

describe('oauth callback route', () => {
    test('escapes oauth error text from query params', async () => {
        server = await buildServer({ logger: false });

        const response = await server.inject({
            method: 'GET',
            url:
                '/auth/etsy/callback?error=access_denied&' +
                'error_description=%3Cscript%3Ealert(1)%3C%2Fscript%3E'
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(response.body).not.toContain('<script>alert(1)</script>');
    });

    test('returns 400 when oauth state is invalid', async () => {
        server = await buildServer({ logger: false });

        const response = await server.inject({
            method: 'GET',
            url: '/auth/etsy/callback?code=code-1&state=missing-state'
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
                scopes: ['listings_r']
            }),
            logger: false
        });

        const response = await server.inject({
            method: 'GET',
            url: '/auth/etsy/callback?code=code-1&state=state-1'
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toContain('Etsy connected');
    });

    test('returns 500 for non-trpc callback errors', async () => {
        server = await buildServer({
            completeOAuthFlow: async () => {
                throw new Error('network failure');
            },
            logger: false
        });

        const response = await server.inject({
            method: 'GET',
            url: '/auth/etsy/callback?code=code-1&state=state-1'
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toContain('Token exchange failed.');
    });

    test('maps BAD_REQUEST trpc errors to 400', async () => {
        server = await buildServer({
            completeOAuthFlow: async () => {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'bad state'
                });
            },
            logger: false
        });

        const response = await server.inject({
            method: 'GET',
            url: '/auth/etsy/callback?code=code-1&state=state-1'
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('bad state');
    });
});
