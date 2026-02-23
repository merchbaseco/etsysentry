import cors from '@fastify/cors';
import { TRPCError } from '@trpc/server';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';
import { z } from 'zod';
import { createTrpcContext } from './api/context';
import { rootRouter } from './api/root';
import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { testDbConnection } from './db';
import {
    startKeywordSyncJobs,
    stopKeywordSyncJobs
} from './jobs/sync-keyword-jobs';
import { completeEtsyOAuthFlow } from './services/etsy/oauth-service';
import { renderOAuthErrorHtml, renderOAuthSuccessHtml } from './services/etsy/oauth-html';

const callbackQuerySchema = z.object({
    code: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
    state: z.string().optional()
});

type BuildServerOptions = {
    completeOAuthFlow?: typeof completeEtsyOAuthFlow;
    logger?: boolean;
};

export const buildServer = async (options: BuildServerOptions = {}) => {
    const completeOAuthFlow = options.completeOAuthFlow ?? completeEtsyOAuthFlow;
    const logger =
        options.logger === undefined
            ? {
                  level: env.NODE_ENV === 'development' ? 'info' : 'warn'
              }
            : options.logger;

    const server = Fastify({
        logger
    });

    await server.register(cors, {
        credentials: true,
        origin: [env.APP_ORIGIN]
    });

    await server.register(fastifyTRPCPlugin, {
        prefix: '/api',
        trpcOptions: {
            createContext: createTrpcContext,
            onError({
                error,
                path
            }: {
                error: unknown;
                path: string | undefined;
            }) {
                server.log.error({ error, path }, 'tRPC procedure failed');
            },
            router: rootRouter
        }
    });

    server.get('/healthz', async () => {
        return {
            service: 'etsy-sentry-server',
            status: 'ok'
        };
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
            server.log.warn(
                { error, errorDescription },
                'Etsy OAuth callback returned an OAuth error'
            );

            return reply
                .status(400)
                .type('text/html')
                .send(renderOAuthErrorHtml(errorDescription ?? error));
        }

        if (!code || !state) {
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
                state
            });

            return reply.status(200).type('text/html').send(renderOAuthSuccessHtml());
        } catch (callbackError) {
            server.log.error({ callbackError }, 'Etsy OAuth callback failed');

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
    await runMigrations();
    await testDbConnection();

    const server = await buildServer();
    await startKeywordSyncJobs({
        logger: server.log
    });

    server.addHook('onClose', async () => {
        await stopKeywordSyncJobs();
    });

    server.log.info(
        {
            apiPrefix: '/api',
            adminEmail: env.ADMIN_EMAIL,
            authProvider: 'clerk',
            callbackPath: '/auth/etsy/callback',
            callbackUrl: env.ETSY_OAUTH_REDIRECT_URI,
            databaseHost: env.databaseHost,
            databaseName: env.databaseName,
            databasePort: env.databasePort,
            oauthScopes: env.etsyOAuthScopes,
            port: env.PORT
        },
        'Startup status summary'
    );

    await server.listen({
        host: '0.0.0.0',
        port: env.PORT
    });
}
