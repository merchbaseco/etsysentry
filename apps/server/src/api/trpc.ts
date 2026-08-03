import { initTRPC, TRPCError } from '@trpc/server';
import type { TrpcContext } from './context';

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;

export const publicProcedure = t.procedure.use(({ ctx, next }) => {
    if (ctx.accessError === 'access_denied') {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Merchbase access is not granted.',
        });
    }

    if (ctx.accessError === 'access_unavailable') {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Merchbase access is temporarily unavailable.',
        });
    }

    if (
        ctx.authType !== 'access' ||
        (ctx.credentialKind !== 'api_key' && ctx.credentialKind !== 'oauth') ||
        !ctx.user ||
        !ctx.accountId ||
        !ctx.merchbaseUserId
    ) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Merchbase API key or OAuth credential required.',
        });
    }

    return next({
        ctx: {
            ...ctx,
            accountId: ctx.accountId,
            credentialKind: ctx.credentialKind,
            merchbaseUserId: ctx.merchbaseUserId,
            user: ctx.user,
        },
    });
});

export const appProcedure = t.procedure.use(({ ctx, next }) => {
    if (ctx.accessError === 'access_denied') {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Merchbase access is not granted.',
        });
    }

    if (ctx.accessError === 'access_unavailable') {
        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Merchbase access is temporarily unavailable.',
        });
    }

    if (
        ctx.authType !== 'access' ||
        ctx.credentialKind !== 'session' ||
        !ctx.user ||
        !ctx.accountId ||
        !ctx.merchbaseUserId
    ) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Clerk authentication required.',
        });
    }

    return next({
        ctx: {
            ...ctx,
            isAdmin: ctx.isAdmin,
            accountId: ctx.accountId,
            merchbaseUserId: ctx.merchbaseUserId,
            user: ctx.user,
        },
    });
});

export const adminProcedure = appProcedure.use(({ ctx, next }) => {
    if (!ctx.isAdmin) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Admin access required.',
        });
    }

    return next({
        ctx: {
            ...ctx,
            isAdmin: true,
        },
    });
});
