import { z } from 'zod';
import { disconnectEtsyOAuthSession } from '../../../services/etsy/oauth-service';
import { appProcedure } from '../../trpc';

export const etsyAuthDisconnectProcedure = appProcedure
    .input(z.object({}))
    .mutation(async ({ ctx }) => {
        const status = await disconnectEtsyOAuthSession({
            clerkUserId: ctx.user.sub,
            tenantId: ctx.tenantId
        });

        return {
            connected: status.connected,
            expiresAt: status.expiresAt ? status.expiresAt.toISOString() : null,
            needsRefresh: status.needsRefresh,
            scopes: status.scopes
        };
    });
