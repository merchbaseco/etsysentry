import { createClerkClient } from '@clerk/backend';
import type { FastifyInstance } from 'fastify';

/**
 * Mints a short-lived Clerk sign-in ticket for the one configured development
 * user, so a development session opens on a signed-in dashboard instead of a
 * sign-in form.
 *
 * The shared Merchbase development Clerk instance enables no password strategy,
 * so a development client cannot be signed in by filling a form at all. A
 * sign-in token is the supported substitute: single-use, minted server-side
 * against a fixed user id, and exchanged by the browser for a session.
 *
 * Three conditions arm this route, all checked before it is registered, so an
 * environment that fails any of them serves a 404 rather than a guarded
 * handler:
 *
 * 1. Not production.
 * 2. A configured `ETSYSENTRY_DEV_CLERK_SIGN_IN_USER_ID`.
 * 3. A loopback database.
 *
 * The third is the load-bearing one. Local development points at the LIVE
 * EtsySentry database over Tailscale, and auto sign-in there would silently
 * swap a developer's own identity for the shared development one. Only a
 * database on this machine is a seeded, disposable one — the same test the dev
 * seed itself applies. It is checked instead of the request's `Host` header
 * because a cloud session reaches the site through a port forwarder on a
 * public hostname, and unlike a header the database target cannot be forged by
 * the caller.
 *
 * The minted ticket is a credential. It is returned in the response body and
 * never logged, echoed into a URL by this server, or included in an error.
 */

export const DEV_CLERK_SIGN_IN_TOKEN_PATH = '/auth/dev/clerk-sign-in-token';

/** Long enough for one page load to spend it, short enough to be worthless if it leaks. */
const SIGN_IN_TOKEN_TTL_SECONDS = 60;

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const IPV6_BRACKETS = /^\[|\]$/gu;

export interface DevSignInRouteConditions {
    databaseHost: string;
    devSignInUserId: string | undefined;
    nodeEnv: string;
}

export interface RegisterDevSignInRouteOptions extends DevSignInRouteConditions {
    clerkSecretKey: string;
}

/** Whether a session is a seeded, disposable one that may sign itself in. */
export const isDevSignInArmed = (conditions: DevSignInRouteConditions): boolean =>
    conditions.nodeEnv !== 'production' &&
    Boolean(conditions.devSignInUserId) &&
    LOOPBACK_HOSTS.has(conditions.databaseHost.trim().replace(IPV6_BRACKETS, '').toLowerCase());

export const registerDevSignInRoute = (
    fastify: FastifyInstance,
    options: RegisterDevSignInRouteOptions
): void => {
    const devSignInUserId = options.devSignInUserId;

    if (!(isDevSignInArmed(options) && devSignInUserId)) {
        return;
    }

    const clerk = createClerkClient({ secretKey: options.clerkSecretKey });

    fastify.post(DEV_CLERK_SIGN_IN_TOKEN_PATH, async (_request, reply) => {
        const signInToken = await clerk.signInTokens.createSignInToken({
            expiresInSeconds: SIGN_IN_TOKEN_TTL_SECONDS,
            userId: devSignInUserId,
        });

        return reply.code(200).send({
            expiresInSeconds: SIGN_IN_TOKEN_TTL_SECONDS,
            ticket: signInToken.token,
        });
    });

    fastify.log.info(
        {
            devSignInUserId,
            path: DEV_CLERK_SIGN_IN_TOKEN_PATH,
            ttlSeconds: SIGN_IN_TOKEN_TTL_SECONDS,
        },
        'Development auto sign-in is armed'
    );
};
