import { verifyToken } from '@clerk/backend';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { env } from '../config/env';
import {
    type ApiKeyAuthRecord,
    authenticateApiKey,
    isPotentialApiKeyToken,
} from '../services/auth/api-keys-service';
import { resolveAccountIdFromClerk } from '../services/auth/resolve-account-id-from-clerk';

type AuthType = 'apiKey' | 'clerk' | 'none';

export interface ClerkUser {
    email?: string;
    issuer: string;
    orgId: string | null;
    sub: string;
}

export interface ApiKeyPrincipal {
    accountId: string;
    id: string;
    keyPrefix: string;
    ownerClerkUserId: string;
}

const normalizeEmail = (email: string): string => {
    return email.trim().toLowerCase();
};

const adminEmail = normalizeEmail(env.ADMIN_EMAIL);

export const isAdminEmail = (email?: string): boolean => {
    if (!email) {
        return false;
    }

    return normalizeEmail(email) === adminEmail;
};

const getBearerToken = (authorization?: string): string | null => {
    if (!authorization?.startsWith('Bearer ')) {
        return null;
    }

    const token = authorization.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
};

const getRawApiKeyHeader = (rawHeader: string | string[] | undefined): string | null => {
    if (typeof rawHeader === 'string') {
        const normalized = rawHeader.trim();
        return normalized.length > 0 ? normalized : null;
    }

    if (Array.isArray(rawHeader)) {
        for (const value of rawHeader) {
            const normalized = value.trim();

            if (normalized.length > 0) {
                return normalized;
            }
        }
    }

    return null;
};

const toApiKeyPrincipal = (record: ApiKeyAuthRecord): ApiKeyPrincipal => {
    return {
        accountId: record.accountId,
        id: record.id,
        keyPrefix: record.keyPrefix,
        ownerClerkUserId: record.ownerClerkUserId,
    };
};

export const createTrpcContext = async ({ req, res }: CreateFastifyContextOptions) => {
    const token = getBearerToken(req.headers.authorization);
    const rawApiKeyHeader = getRawApiKeyHeader(req.headers['x-api-key']);

    const apiKeyCandidate = rawApiKeyHeader ?? (isPotentialApiKeyToken(token) ? token : null);

    if (apiKeyCandidate) {
        const authenticatedApiKey = await authenticateApiKey({
            rawApiKey: apiKeyCandidate,
        });

        if (authenticatedApiKey) {
            return {
                authType: 'apiKey' as AuthType,
                isAdmin: false,
                reply: res,
                request: req,
                requestId: String(req.id),
                accountId: authenticatedApiKey.accountId,
                apiKey: toApiKeyPrincipal(authenticatedApiKey),
                apiKeyError: undefined,
                user: null,
            };
        }

        return {
            authType: 'none' as AuthType,
            isAdmin: false,
            reply: res,
            request: req,
            requestId: String(req.id),
            accountId: null,
            apiKey: null,
            apiKeyError: 'Valid API key required.',
            user: null,
        };
    }

    if (!token) {
        return {
            authType: 'none' as AuthType,
            isAdmin: false,
            reply: res,
            request: req,
            requestId: String(req.id),
            accountId: null,
            apiKey: null,
            apiKeyError: undefined,
            user: null,
        };
    }

    try {
        const payload = await verifyToken(token, {
            secretKey: env.CLERK_SECRET_KEY,
        });

        const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';
        const issuer = typeof payload.iss === 'string' ? payload.iss.trim() : '';

        if (!(subject && issuer)) {
            return {
                authType: 'none' as AuthType,
                isAdmin: false,
                reply: res,
                request: req,
                requestId: String(req.id),
                accountId: null,
                apiKey: null,
                apiKeyError: undefined,
                user: null,
            };
        }

        const orgId = typeof payload.org_id === 'string' ? payload.org_id.trim() : '';
        const email = typeof payload.email === 'string' ? payload.email : undefined;
        const accountId = await resolveAccountIdFromClerk({
            clerkIssuer: issuer,
            clerkOrgId: orgId.length > 0 ? orgId : null,
            clerkSubject: subject,
            email: email ?? null,
        });

        return {
            authType: 'clerk' as AuthType,
            isAdmin: isAdminEmail(email),
            reply: res,
            request: req,
            requestId: String(req.id),
            accountId,
            apiKey: null,
            apiKeyError: undefined,
            user: {
                email,
                issuer,
                orgId: orgId.length > 0 ? orgId : null,
                sub: subject,
            } satisfies ClerkUser,
        };
    } catch {
        return {
            authType: 'none' as AuthType,
            isAdmin: false,
            reply: res,
            request: req,
            requestId: String(req.id),
            accountId: null,
            apiKey: null,
            apiKeyError: undefined,
            user: null,
        };
    }
};

export type TrpcContext = Awaited<ReturnType<typeof createTrpcContext>>;
