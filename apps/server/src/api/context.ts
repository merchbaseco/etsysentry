import { ServiceAccessError } from '@merchbaseco/access';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { env } from '../config/env';
import { type EtsySentryAccess, getEtsySentryAccess } from '../services/access/etsysentry-access';

export type AuthType = 'access' | 'none';
export type CredentialKind = 'api_key' | 'oauth' | 'session';
export type AccessError = 'access_denied' | 'access_unavailable' | null;

export interface AuthenticatedUser {
    credentialKind: CredentialKind;
    merchbaseUserId: string;
}

export const isAdminMerchbaseUser = (
    merchbaseUserId: string,
    configuredAdminUserId = env.ADMIN_MERCHBASE_USER_ID
): boolean => {
    return Boolean(configuredAdminUserId && configuredAdminUserId === merchbaseUserId);
};

const getBearerToken = (authorization?: string): string | null => {
    if (!authorization?.startsWith('Bearer ')) {
        return null;
    }

    const token = authorization.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
};

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
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
        return {
            ...sharedContext,
            accessError: null as AccessError,
            authType: 'none' as AuthType,
            credentialKind: null,
            isAdmin: false,
            accountId: null,
            merchbaseUserId: null,
            user: null,
        };
    }

    try {
        const authorized = await access.authorize(token);
        const credentialKind = authorized.credentialKind;
        const merchbaseUserId = authorized.merchbaseUserId;

        return {
            ...sharedContext,
            accessError: null as AccessError,
            authType: 'access' as AuthType,
            credentialKind,
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
            isAdmin: false,
            accountId: null,
            merchbaseUserId: null,
            user: null,
        };
    }
};

export type TrpcContext = Awaited<ReturnType<typeof createTrpcContext>>;
