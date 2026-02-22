import { verifyToken } from '@clerk/backend';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { env } from '../config/env';

type AuthType = 'clerk' | 'none';

export type ClerkUser = {
    email?: string;
    orgId: string | null;
    sub: string;
};

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
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return null;
    }

    const token = authorization.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
};

export const createTrpcContext = async ({ req, res }: CreateFastifyContextOptions) => {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
        return {
            authType: 'none' as AuthType,
            isAdmin: false,
            reply: res,
            request: req,
            requestId: String(req.id),
            tenantId: null,
            user: null
        };
    }

    try {
        const payload = await verifyToken(token, {
            secretKey: env.CLERK_SECRET_KEY
        });

        const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';

        if (!subject) {
            return {
                authType: 'none' as AuthType,
                isAdmin: false,
                reply: res,
                request: req,
                requestId: String(req.id),
                tenantId: null,
                user: null
            };
        }

        const orgId = typeof payload.org_id === 'string' ? payload.org_id.trim() : '';
        const tenantId = orgId.length > 0 ? orgId : subject;
        const email = typeof payload.email === 'string' ? payload.email : undefined;

        return {
            authType: 'clerk' as AuthType,
            isAdmin: isAdminEmail(email),
            reply: res,
            request: req,
            requestId: String(req.id),
            tenantId,
            user: {
                email,
                orgId: orgId.length > 0 ? orgId : null,
                sub: subject
            } satisfies ClerkUser
        };
    } catch {
        return {
            authType: 'none' as AuthType,
            isAdmin: false,
            reply: res,
            request: req,
            requestId: String(req.id),
            tenantId: null,
            user: null
        };
    }
};

export type TrpcContext = Awaited<ReturnType<typeof createTrpcContext>>;
