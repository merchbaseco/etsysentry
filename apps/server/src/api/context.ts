import { ServiceAccessError } from '@merchbaseco/access';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { env } from '../config/env';
import { type EtsySentryAccess, getEtsySentryAccess } from '../services/access/etsysentry-access';

type AuthType = 'apiKey' | 'clerk' | 'none';

export interface AuthenticatedUser {
    credentialKind: 'session';
    merchbaseUserId: string;
}

export interface ApiKeyPrincipal {
    credentialKind: 'api_key';
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

const getAccessErrorMessage = (error: unknown): string => {
    if (error instanceof ServiceAccessError) {
        if (error.code === 'access_denied') {
            return 'Merchbase access is not granted.';
        }

        if (error.code === 'access_unavailable') {
            return 'Merchbase access is temporarily unavailable.';
        }
    }

    return 'Valid Merchbase credential required.';
};

export const createTrpcContext = async (
    { req, res }: CreateFastifyContextOptions,
    access: EtsySentryAccess = getEtsySentryAccess()
) => {
    const sharedContext = getSharedContext({ req, res });
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
        return {
            ...sharedContext,
            authType: 'none' as AuthType,
            isAdmin: false,
            accountId: null,
            merchbaseUserId: null,
            apiKey: null,
            apiKeyError: undefined,
            user: null,
        };
    }

    try {
        const authorized = await (token.startsWith('ak_')
            ? access.apiKeyAccess
            : access.sessionAccess
        ).authorize(token);
        const isApiKey = authorized.credentialKind === 'api_key';
        const merchbaseUserId = authorized.merchbaseUserId;

        return {
            ...sharedContext,
            authType: (isApiKey ? 'apiKey' : 'clerk') as AuthType,
            isAdmin: !isApiKey && isAdminMerchbaseUser(merchbaseUserId),
            accountId: authorized.principal.accountId,
            merchbaseUserId,
            apiKey: isApiKey
                ? ({
                      credentialKind: 'api_key',
                      merchbaseUserId,
                  } satisfies ApiKeyPrincipal)
                : null,
            apiKeyError: undefined,
            user: isApiKey
                ? null
                : ({
                      credentialKind: 'session',
                      merchbaseUserId,
                  } satisfies AuthenticatedUser),
        };
    } catch (error) {
        return {
            ...sharedContext,
            authType: 'none' as AuthType,
            isAdmin: false,
            accountId: null,
            merchbaseUserId: null,
            apiKey: null,
            apiKeyError: getAccessErrorMessage(error),
            user: null,
        };
    }
};

export type TrpcContext = Awaited<ReturnType<typeof createTrpcContext>>;
