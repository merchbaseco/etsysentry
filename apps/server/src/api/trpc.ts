import { initTRPC, TRPCError } from '@trpc/server';
import type { TrpcContext } from './context';

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;

export const publicProcedure = t.procedure.use(({ ctx, next }) => {
    if (ctx.authType !== 'apiKey' || !ctx.apiKey || !ctx.accountId) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: ctx.apiKeyError ?? 'API key authentication required.',
        });
    }

    return next({
        ctx: {
            ...ctx,
            accountId: ctx.accountId,
            apiKey: ctx.apiKey,
        },
    });
});

export const appProcedure = t.procedure.use(({ ctx, next }) => {
    if (ctx.authType !== 'clerk' || !ctx.user || !ctx.accountId) {
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
