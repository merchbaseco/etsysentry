import cors from '@fastify/cors';
import { ServiceAccessError } from '@merchbaseco/access';
import { TRPCError } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';
import { z } from 'zod';
import { createTrpcContext } from './api/context';
import { rootRouter } from './api/root';
import { env } from './config/env';
import { testDbConnection } from './db';
import { runMigrations } from './db/migrate';
import { startServerJobs, stopServerJobs } from './jobs/run-server-jobs';
import {
    assertEtsySentryDevelopmentTarget,
    configureEtsySentryAccess,
    createEtsySentryAccess,
    ETSYSENTRY_INTERNAL_HOST,
    ETSYSENTRY_INTERNAL_SNAPSHOT_PATH,
    ETSYSENTRY_UI_HOST,
    type EtsySentryAccess,
    isEtsySentryDevelopmentHost,
} from './services/access/etsysentry-access';
import { renderOAuthErrorHtml, renderOAuthSuccessHtml } from './services/etsy/oauth-html';
import { completeEtsyOAuthFlow } from './services/etsy/oauth-service';
import { startWebsocketRuntime } from './services/realtime/start-websocket-runtime';

const callbackQuerySchema = z.object({
    code: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
    state: z.string().optional(),
});

interface BuildServerOptions {
    access?: EtsySentryAccess;
    completeOAuthFlow?: typeof completeEtsyOAuthFlow;
    logger?: boolean;
}

const getSingleHeader = (value: string | string[] | undefined): string | undefined =>
    typeof value === 'string' ? value : undefined;

const getSessionFailureStatus = (error: unknown): number => {
    if (error instanceof ServiceAccessError && error.code === 'access_unavailable') {
        return 503;
    }
    if (error instanceof ServiceAccessError && error.code === 'access_denied') {
        return 403;
    }
    return 401;
};

export const buildServer = async (options: BuildServerOptions = {}) => {
    const completeOAuthFlow = options.completeOAuthFlow ?? completeEtsyOAuthFlow;
    const access = configureEtsySentryAccess(options.access ?? (await createEtsySentryAccess()));
    const logger =
        options.logger === undefined
            ? {
                  level: env.NODE_ENV === 'development' ? 'info' : 'warn',
                  redact: {
                      paths: [
                          'req.headers.authorization',
                          'req.headers.cookie',
                          'req.headers.cf-access-client-secret',
                          'req.headers.cf-access-jwt-assertion',
                      ],
                      censor: '[redacted]',
                  },
              }
            : options.logger;

    const server = Fastify({
        logger,
    });

    await server.register(cors, {
        credentials: true,
        origin: [env.ETSYSENTRY_APP_ORIGIN],
    });

    await server.register(fastifyTRPCPlugin, {
        prefix: '/api',
        trpcOptions: {
            createContext: (contextOptions: CreateFastifyContextOptions) =>
                createTrpcContext(contextOptions, access),
            onError({ error, path }: { error: unknown; path: string | undefined }) {
                server.log.error({ error, path }, 'tRPC procedure failed');
            },
            router: rootRouter,
        },
    });

    const realtimeRuntime = startWebsocketRuntime({
        access,
        server,
    });

    server.post(ETSYSENTRY_INTERNAL_SNAPSHOT_PATH, async (request, reply) => {
        if (request.headers.host !== ETSYSENTRY_INTERNAL_HOST) {
            return reply.status(404).send();
        }

        const handler = access.createProjectionHandler((merchbaseUserId) =>
            realtimeRuntime.closeForUser(merchbaseUserId)
        );
        const headers = new Headers();
        const assertion = getSingleHeader(request.headers['cf-access-jwt-assertion']);
        if (assertion) {
            headers.set('cf-access-jwt-assertion', assertion);
        }
        const contentType = getSingleHeader(request.headers['content-type']);
        if (contentType) {
            headers.set('content-type', contentType);
        }
        const url = new URL(
            request.raw.url ?? ETSYSENTRY_INTERNAL_SNAPSHOT_PATH,
            `https://${ETSYSENTRY_INTERNAL_HOST}`
        );
        const webRequest = new Request(url, {
            body: JSON.stringify(request.body),
            headers,
            method: request.method,
        });
        const response = await handler(webRequest);
        return reply.status(response.status).send();
    });

    server.addHook('onClose', async () => {
        await realtimeRuntime.stop();
    });

    server.get('/healthz', () => {
        return {
            service: 'etsy-sentry-server',
            status: 'ok',
        };
    });

    server.get('/auth/session', async (request, reply) => {
        if (
            request.headers.host !== ETSYSENTRY_UI_HOST &&
            !isEtsySentryDevelopmentHost(request.headers.host)
        ) {
            return reply.status(404).send({ authenticated: false });
        }

        try {
            const authorized = await access.authorizeRequest({
                assertion: getSingleHeader(request.headers['cf-access-jwt-assertion']),
                host: request.headers.host,
                method: request.method,
                origin: request.headers.origin,
                userIdHeader: request.headers['x-merchbase-user-id'],
            });
            if (authorized.credentialKind !== 'session') {
                return reply.status(401).send({ authenticated: false });
            }
            return reply
                .header('cache-control', 'no-store')
                .send({ authenticated: true, merchbaseUserId: authorized.merchbaseUserId });
        } catch (error) {
            return reply
                .status(getSessionFailureStatus(error))
                .header('cache-control', 'no-store')
                .send({ authenticated: false });
        }
    });

    server.get('/auth/etsy/callback', async (request, reply) => {
        const parsedQuery = callbackQuerySchema.safeParse(request.query);

        if (!parsedQuery.success) {
            return reply
                .status(400)
                .type('text/html')
                .send(
                    renderOAuthErrorHtml(
                        'OAuth callback query was invalid. Please retry from the dashboard.'
                    )
                );
        }

        const { code, error, error_description: errorDescription, state } = parsedQuery.data;

        if (error) {
            return reply
                .status(400)
                .type('text/html')
                .send(renderOAuthErrorHtml(errorDescription ?? error));
        }

        if (!(code && state)) {
            return reply
                .status(400)
                .type('text/html')
                .send(
                    renderOAuthErrorHtml('OAuth callback was missing the required code or state.')
                );
        }

        try {
            await completeOAuthFlow({
                code,
                state,
            });

            return reply.status(200).type('text/html').send(renderOAuthSuccessHtml());
        } catch (callbackError) {
            server.log.error('Etsy OAuth callback failed.');

            if (callbackError instanceof TRPCError && callbackError.code === 'BAD_REQUEST') {
                return reply
                    .status(400)
                    .type('text/html')
                    .send(renderOAuthErrorHtml(callbackError.message));
            }

            return reply
                .status(500)
                .type('text/html')
                .send(
                    renderOAuthErrorHtml(
                        'Token exchange failed. Start the Etsy connection flow again.'
                    )
                );
        }
    });

    return server;
};

if (import.meta.main) {
    assertEtsySentryDevelopmentTarget();
    await runMigrations();
    await testDbConnection();

    const server = await buildServer();
    if (env.enableServerJobs) {
        await startServerJobs({
            logger: server.log,
        });

        server.addHook('onClose', async () => {
            await stopServerJobs();
        });
    } else {
        server.log.info(
            {
                disableServerJobRunner: env.disableServerJobRunner,
                enableServerJobs: env.enableServerJobs,
            },
            'Background jobs are disabled for this server process.'
        );
    }

    server.log.info(
        {
            apiPrefix: '/api',
            adminConfigured: Boolean(env.ETSYSENTRY_ADMIN_MERCHBASE_USER_ID),
            authProvider: 'cloudflare_access',
            callbackPath: '/auth/etsy/callback',
            callbackUrl: env.ETSYSENTRY_ETSY_OAUTH_REDIRECT_URI,
            databaseHost: env.databaseHost,
            databaseName: env.databaseName,
            databasePort: env.databasePort,
            disableServerJobRunner: env.disableServerJobRunner,
            enableServerJobs: env.enableServerJobs,
            oauthScopes: env.etsyOAuthScopes,
            etsyRateLimitDefaults: {
                backoffInitialMs: env.ETSYSENTRY_ETSY_RATE_LIMIT_BACKOFF_INITIAL_MS,
                backoffMaxMs: env.ETSYSENTRY_ETSY_RATE_LIMIT_BACKOFF_MAX_MS,
                maxRetries: env.ETSYSENTRY_ETSY_RATE_LIMIT_MAX_RETRIES,
                perDay: env.ETSYSENTRY_ETSY_RATE_LIMIT_DEFAULT_PER_DAY,
                perSecond: env.ETSYSENTRY_ETSY_RATE_LIMIT_DEFAULT_PER_SECOND,
            },
            port: env.ETSYSENTRY_PORT,
        },
        'Startup status summary'
    );

    await server.listen({
        host: '0.0.0.0',
        port: env.ETSYSENTRY_PORT,
    });
}
