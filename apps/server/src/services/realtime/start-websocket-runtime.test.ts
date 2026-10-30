import { afterEach, describe, expect, mock, test } from 'bun:test';
import Fastify from 'fastify';
import { WebSocket } from 'ws';
import type { EtsySentryAccess } from '../access/etsysentry-access';
import { ETSYSENTRY_UI_HOST } from '../access/etsysentry-access';
import { startWebsocketRuntime } from './start-websocket-runtime';

const APP_ORIGIN = 'https://etsysentry.merchbase.co';
const TEST_ASSERTION = 'signed-websocket-fixture';
const openRuntimes: Array<{
    runtime: ReturnType<typeof startWebsocketRuntime>;
    server: ReturnType<typeof Fastify>;
}> = [];

afterEach(async () => {
    for (const { runtime, server } of openRuntimes.splice(0)) {
        await runtime.stop();
        await server.close();
    }
});

const startRuntime = async (options?: { expiresAt?: number }) => {
    const server = Fastify({ logger: false });
    const access = {
        apiAccess: {},
        authorizeRequest: mock((input: { assertion?: string; host?: string; origin?: string }) => {
            if (
                input.assertion !== TEST_ASSERTION ||
                input.host !== ETSYSENTRY_UI_HOST ||
                input.origin !== APP_ORIGIN
            ) {
                return Promise.reject(new Error('Unexpected websocket test request.'));
            }
            return Promise.resolve({
                credentialKind: 'session' as const,
                expiresAt: options?.expiresAt ?? null,
                merchbaseUserId: 'mbu_websocket_fixture',
                principal: { accountId: 'acct_websocket_fixture' },
                service: 'etsysentry' as const,
            });
        }),
        createProjectionHandler: () => () => Promise.resolve(new Response(null, { status: 404 })),
        interactiveAccess: {},
        projections: {},
    } as unknown as EtsySentryAccess;
    const runtime = startWebsocketRuntime({ access, server });
    await server.listen({ host: '127.0.0.1', port: 0 });
    const address = server.server.address();
    if (!address || typeof address === 'string') {
        throw new Error('The websocket test server did not bind a TCP port.');
    }
    openRuntimes.push({ runtime, server });
    return { access, port: address.port, runtime };
};

const connect = (port: number, path = '/ws'): WebSocket =>
    new WebSocket(`ws://127.0.0.1:${port}${path}`, {
        headers: {
            'cf-access-jwt-assertion': TEST_ASSERTION,
            host: ETSYSENTRY_UI_HOST,
            origin: APP_ORIGIN,
        },
    });

describe('websocket access lifecycle', () => {
    test('rejects query credentials before attempting authorization', async () => {
        const { access, port } = await startRuntime();
        const websocket = connect(port, '/ws?token=must-not-be-used');
        const statusCode = await new Promise<number>((resolve, reject) => {
            websocket.once('unexpected-response', (_request, response) => {
                resolve(response.statusCode ?? 0);
            });
            websocket.once('error', reject);
        });

        expect(statusCode).toBe(400);
        expect(access.authorizeRequest).not.toHaveBeenCalled();
    });

    test('authenticates from upgrade headers and disconnects at the verified deadline', async () => {
        const { access, port } = await startRuntime({ expiresAt: Date.now() + 500 });
        const websocket = connect(port);
        const closed = new Promise<number>((resolve) => {
            websocket.once('close', (code) => resolve(code));
        });
        await new Promise<void>((resolve, reject) => {
            websocket.once('open', resolve);
            websocket.once('error', reject);
        });

        expect(access.authorizeRequest).toHaveBeenCalledTimes(1);
        expect(await closed).toBe(4001);
    });

    test('closes a user websocket immediately when its access projection changes', async () => {
        const { port, runtime } = await startRuntime();
        const websocket = connect(port);
        const closed = new Promise<number>((resolve) => {
            websocket.once('close', (code) => resolve(code));
        });
        await new Promise<void>((resolve, reject) => {
            websocket.once('open', resolve);
            websocket.once('error', reject);
        });

        runtime.closeForUser('mbu_websocket_fixture');

        expect(await closed).toBe(4001);
    });
});
