import { ServiceAccessError } from '@merchbaseco/access';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { env } from '../config/env';
import {
    type EtsySentryAccess,
    type EtsySentryCredentialKind,
    getEtsySentryAccess,
} from '../services/access/etsysentry-access';

export type AuthType = 'access' | 'none';
export type CredentialKind = EtsySentryCredentialKind;
export type AccessError = 'access_denied' | 'access_unavailable' | null;

export interface AuthenticatedUser {
    credentialKind: CredentialKind;
    merchbaseUserId: string;
}

export const isAdminMerchbaseUser = (
    merchbaseUserId: string,
    configuredAdminUserId = env.ETSYSENTRY_ADMIN_MERCHBASE_USER_ID
): boolean => Boolean(configuredAdminUserId && configuredAdminUserId === merchbaseUserId);

const singleHeader = (value: string | string[] | undefined): string | undefined =>
    typeof value === 'string' ? value : undefined;

const getSharedContext = ({
    req,
    res,
}: Pick<CreateFastifyContextOptions, 'req' | 'res'>): {
    reply: typeof res;
    request: typeof req;
    requestId: string;
} => ({
    reply: res,
    request: req,
    requestId: String(req.id),
});

export const createTrpcContext = async (
    { req, res }: CreateFastifyContextOptions,
    access: EtsySentryAccess = getEtsySentryAccess()
) => {
    const sharedContext = getSharedContext({ req, res });

    try {
        const authorized = await access.authorizeRequest({
            assertion: singleHeader(req.headers['cf-access-jwt-assertion']),
            host: req.headers.host,
            method: req.method,
            origin: req.headers.origin,
            userIdHeader: req.headers['x-merchbase-user-id'],
        });
        const credentialKind = authorized.credentialKind;
        const merchbaseUserId = authorized.merchbaseUserId;

        return {
            ...sharedContext,
            accessError: null as AccessError,
            authType: 'access' as AuthType,
            credentialKind,
            expiresAt: authorized.expiresAt,
            isAdmin: credentialKind === 'session' && isAdminMerchbaseUser(merchbaseUserId),
            accountId: authorized.principal.accountId,
            merchbaseUserId,
            user: {
                credentialKind,
                merchbaseUserId,
            } satisfies AuthenticatedUser,
        };
    } catch (error) {
        const accessError: AccessError =
            error instanceof ServiceAccessError &&
            (error.code === 'access_denied' || error.code === 'access_unavailable')
                ? error.code
                : null;

        return {
            ...sharedContext,
            accessError,
            authType: 'none' as AuthType,
            credentialKind: null,
            expiresAt: null,
            isAdmin: false,
            accountId: null,
            merchbaseUserId: null,
            user: null,
        };
    }
};

export type TrpcContext = Awaited<ReturnType<typeof createTrpcContext>>;
